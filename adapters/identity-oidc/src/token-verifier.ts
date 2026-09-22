/**
 * @file Access-token verification (WO-002B S1-08)
 * @description Verifies an IdP access token and builds a RequestContext from it.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §4.1, §4.2, ADR-0010, ADR-0012.
 *
 * This is the only place a RequestContext is created from anything the client sent,
 * and every field comes from a SIGNATURE-VERIFIED claim. Nothing is read from the
 * body, the query string, or an unsigned header. §5.1: "Any code path that reads
 * `tenant_id` from user-controlled input fails review."
 *
 * Port-neutral by construction: Keycloak locally and Cloud Identity Platform in the
 * cloud both issue RS256 tokens with a JWKS endpoint, so one verifier serves both
 * (ADR-0012). Implementing against two providers from day one is what proves the
 * port is real rather than aspirational.
 */

import type { RequestContext } from "@sovereign/contracts";
import { ActorKind } from "@sovereign/domain";
import { type JWTPayload, type JWTVerifyGetKey, jwtVerify } from "jose";
import {
  MAX_ACCESS_TOKEN_LIFETIME_SECONDS,
  REQUIRED_AUDIENCE,
  SovereignClaims,
  SovereignClaimsSchema,
} from "./claims.js";

export class TokenRejectedError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "TokenRejectedError";
  }
}

export interface VerifyTokenOptions {
  /** Expected issuer. A token from another realm or project is not ours. */
  readonly issuer: string;
  readonly audience?: string;
  /** Clock, injectable for tests. */
  readonly now?: Date;
  /** Seconds of clock skew tolerated. Keep small; this widens the replay window. */
  readonly clockToleranceSeconds?: number;
}

/**
 * Map an authenticated principal to a domain ActorKind.
 *
 * Deliberately conservative. An unrecognised role set yields HUMAN_STAFF — the least
 * privileged human kind — rather than throwing or guessing upward. AI_AGENT_RUNTIME
 * and SOVEREIGN_SERVICE are never derived from a user token: a service identity is
 * established by a bound service credential (S1-D17), not by a claim a user's token
 * happens to carry.
 */
export function actorKindForRoles(roles: readonly string[]): ActorKind {
  if (roles.includes("clinician") || roles.includes("app")) {
    return ActorKind.HUMAN_CLINICIAN;
  }
  if (roles.includes("org_admin") || roles.includes("security_admin")) {
    return ActorKind.HUMAN_ADMIN;
  }
  return ActorKind.HUMAN_STAFF;
}

/**
 * Verify a token and produce a RequestContext.
 *
 * Throws TokenRejectedError on any failure, with a short machine reason. The reason
 * is for the audit row and the log, never for the client — §4.2 requires a bare 401.
 */
export async function verifyAccessToken(
  token: string,
  jwks: JWTVerifyGetKey,
  options: VerifyTokenOptions,
  correlationId: string,
): Promise<RequestContext> {
  const now = options.now ?? new Date();

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: options.issuer,
      audience: options.audience ?? REQUIRED_AUDIENCE,
      // RS256 only. Pinning the algorithm is what makes `alg: none` and HS256
      // confusion attacks impossible rather than merely unlikely
      // (spec §10 test 4).
      algorithms: ["RS256"],
      clockTolerance: options.clockToleranceSeconds ?? 5,
      currentDate: now,
    }));
  } catch (error) {
    throw new TokenRejectedError("signature_or_claims", `Token verification failed: ${error}`);
  }

  // A token with an implausibly long life is rejected even when its signature is
  // good. §4.1 caps the access token at 15 minutes; a 24-hour token means the IdP is
  // misconfigured, and honouring it would quietly extend the blast radius of a theft.
  if (typeof payload.exp === "number" && typeof payload.iat === "number") {
    if (payload.exp - payload.iat > MAX_ACCESS_TOKEN_LIFETIME_SECONDS) {
      throw new TokenRejectedError("lifetime_too_long", "Access token lifetime exceeds 15 minutes");
    }
  }

  const claims = SovereignClaimsSchema.safeParse(payload);
  if (!claims.success) {
    // Missing tenant_id, user_id or session_id lands here (§4.2).
    throw new TokenRejectedError("missing_claims", "Token lacks required Sovereign claims");
  }

  const roles = claims.data[SovereignClaims.ROLES];
  return {
    tenantId: claims.data[SovereignClaims.TENANT_ID],
    userId: claims.data[SovereignClaims.USER_ID],
    sessionId: claims.data[SovereignClaims.SESSION_ID],
    roles,
    siteIds: claims.data[SovereignClaims.SITE_IDS],
    actorKind: actorKindForRoles(roles),
    correlationId,
    // Trusted server time, never a client timestamp.
    requestedAt: now,
    mfa: claims.data[SovereignClaims.MFA],
  };
}
