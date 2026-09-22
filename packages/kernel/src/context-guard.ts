/**
 * @file Signed request-context guard (WO-002C S1-06)
 * @description Signs and verifies the internal X-Sovereign-Context header.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.1, S1-D17, §8.1.
 *
 * The gateway resolves a RequestContext from verified JWT claims once, signs it, and
 * services verify the signature rather than re-deriving identity. Two rules the spec
 * is emphatic about:
 *
 *   1. The signed header is carried IN ADDITION TO a bound service identity (a
 *      Google-signed ID token plus mTLS). Services reject a request presenting only
 *      one. The header alone is never sufficient — AGENTS.md doctrine 18.
 *   2. It is valid for 60 seconds. A captured header is not a durable credential.
 *
 * HMAC-SHA256 with a per-environment secret. Symmetric is adequate because both ends
 * are Sovereign services inside one trust boundary; the bound service identity is
 * what proves *which* service is calling.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { RequestContextSchema, SIGNED_CONTEXT_MAX_AGE_SECONDS } from "@sovereign/contracts";
import type { RequestContext } from "@sovereign/contracts";
import { contextExpired, contextInvalid, serviceIdentityMissing } from "./errors.js";

interface SignedPayload {
  readonly ctx: Record<string, unknown>;
  /** Seconds since epoch when the header was minted. */
  readonly iat: number;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** Produce the header value. Called by the gateway, once per request. */
export function signContext(
  secret: string,
  context: RequestContext,
  now: Date = new Date(),
): string {
  const payload: SignedPayload = {
    ctx: { ...context, requestedAt: context.requestedAt.toISOString() },
    iat: Math.floor(now.getTime() / 1000),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

export interface VerifyOptions {
  /**
   * Whether the caller presented a bound service identity (ID token / mTLS).
   *
   * Not something the kernel can check itself — it is established by the Cloud Run
   * ingress and the ID-token middleware. Passing `true` without that in place
   * defeats S1-D17, so the parameter is required rather than defaulted.
   */
  readonly hasBoundServiceIdentity: boolean;
  readonly now?: Date;
  readonly maxAgeSeconds?: number;
}

/**
 * Verify a signed context header.
 *
 * Throws rather than returning a result: a caller that forgets to check a boolean
 * gets an unauthenticated request through, and this is the wrong place for that
 * failure mode.
 */
export function verifyContext(
  secret: string,
  header: string | undefined,
  options: VerifyOptions,
): RequestContext {
  if (!options.hasBoundServiceIdentity) {
    // Spec §10 test 20: a valid user-context header without a bound service identity
    // must be rejected.
    throw serviceIdentityMissing("No bound service identity accompanied the signed context");
  }
  if (header === undefined || header.length === 0) {
    throw contextInvalid("Missing signed context header");
  }

  const separator = header.lastIndexOf(".");
  if (separator <= 0) {
    throw contextInvalid("Malformed signed context header");
  }
  const body = header.slice(0, separator);
  const provided = Buffer.from(header.slice(separator + 1), "base64url");
  const expected = Buffer.from(sign(secret, body), "base64url");

  // Constant-time: a fast-fail comparison leaks the signature byte by byte.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw contextInvalid("Signed context failed signature verification");
  }

  let payload: SignedPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedPayload;
  } catch {
    throw contextInvalid("Signed context payload is not valid JSON");
  }

  const now = options.now ?? new Date();
  const maxAge = options.maxAgeSeconds ?? SIGNED_CONTEXT_MAX_AGE_SECONDS;
  const ageSeconds = Math.floor(now.getTime() / 1000) - payload.iat;
  if (ageSeconds > maxAge) {
    throw contextExpired(`Signed context is ${ageSeconds}s old, limit ${maxAge}s`);
  }
  if (ageSeconds < -maxAge) {
    // Clock skew in the other direction. A header minted in the future is either a
    // misconfigured clock or a forgery attempt; both fail closed.
    throw contextInvalid("Signed context was minted in the future");
  }

  const raw = payload.ctx as Record<string, unknown>;
  const parsed = RequestContextSchema.safeParse({
    ...raw,
    requestedAt: typeof raw.requestedAt === "string" ? new Date(raw.requestedAt) : raw.requestedAt,
  });
  if (!parsed.success) {
    throw contextInvalid("Signed context does not match the RequestContext contract");
  }
  return parsed.data;
}
