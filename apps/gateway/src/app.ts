/**
 * @file Gateway application (WO-002B S1-11)
 * @description Fastify app wiring authentication, tenancy, rate limiting and headers.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.4, §5.1, §4.2.
 *
 * Request order matters and is fixed:
 *
 *   security headers  ->  health routes (unauthenticated)
 *                     ->  verify token        (identity)
 *                     ->  session revocation  (is this session still alive)
 *                     ->  rate limit          (per tenant, needs the tenant)
 *                     ->  sign internal context
 *
 * Rate limiting comes AFTER authentication on purpose. The limiter is keyed by tenant,
 * and the tenant is only known once the token is verified. Limiting before
 * authentication would have to key on IP, which throttles a whole clinic behind one
 * NAT as though it were an attacker.
 */

import { randomUUID } from "node:crypto";
import { type TokenRejectedError, verifyAccessToken } from "@sovereign/adapter-identity-oidc";
import { CORRELATION_ID_HEADER, SIGNED_CONTEXT_HEADER } from "@sovereign/contracts";
import type { RequestContext } from "@sovereign/contracts";
import { signContext } from "@sovereign/kernel";
import { ErrorCode, SovereignError } from "@sovereign/kernel";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { JWTVerifyGetKey } from "jose";
import type { IntegrationHealthTracker } from "./health.js";
import { TenantRateLimiter } from "./rate-limit.js";
import { MAX_REQUEST_BYTES, cspNonce, securityHeaders } from "./security-headers.js";

/** Revoked sessions, refreshed periodically by services/identity (§4.2). */
export interface SessionRevocationCache {
  isRevoked(sessionId: string): boolean;
}

export interface GatewayOptions {
  readonly jwks: JWTVerifyGetKey;
  readonly issuer: string;
  /** Per-environment HMAC secret for the internal signed context. */
  readonly contextSecret: string;
  readonly revocations: SessionRevocationCache;
  readonly health: IntegrationHealthTracker;
  readonly limiter?: TenantRateLimiter;
  readonly now?: () => Date;
}

declare module "fastify" {
  interface FastifyRequest {
    sovereignContext?: RequestContext;
  }
}

export function buildGateway(options: GatewayOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: MAX_REQUEST_BYTES,
    // Never reflect an internal error message to a client (§8.7).
    disableRequestLogging: true,
    genReqId: () => randomUUID(),
  });
  const limiter = options.limiter ?? new TenantRateLimiter();
  const now = options.now ?? (() => new Date());

  app.addHook("onSend", async (_request, reply, payload) => {
    for (const [header, value] of Object.entries(securityHeaders(cspNonce()))) {
      reply.header(header, value);
    }
    return payload;
  });

  // Health is unauthenticated by necessity: a load balancer has no token. It exposes
  // a bounded enum and two timestamps, nothing else.
  app.get("/health/live", async () => ({ status: "live" }));
  app.get("/health/ready", async (_request, reply) => {
    const ready = options.health.isReady();
    return reply.code(ready ? 200 : 503).send({ status: ready ? "ready" : "not-ready" });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url.startsWith("/health/")) {
      return;
    }

    const correlationId =
      typeof request.headers[CORRELATION_ID_HEADER.toLowerCase()] === "string"
        ? (request.headers[CORRELATION_ID_HEADER.toLowerCase()] as string)
        : randomUUID();

    const authorization = request.headers.authorization;
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      return reply.code(401).send({ error: { code: ErrorCode.UNAUTHENTICATED } });
    }

    let context: RequestContext;
    try {
      context = await verifyAccessToken(
        authorization.slice("Bearer ".length),
        options.jwks,
        { issuer: options.issuer, now: now() },
        correlationId,
      );
    } catch (error) {
      // The reason is for the audit row and the log, never the client (§4.2).
      request.log.warn({ errorCode: (error as TokenRejectedError).reason }, "token rejected");
      return reply.code(401).send({ error: { code: ErrorCode.UNAUTHENTICATED } });
    }

    // Revocation is checked before anything else acts on the identity. A token can be
    // cryptographically valid and belong to a session that was killed 10s ago (§4.2).
    if (options.revocations.isRevoked(context.sessionId)) {
      return reply.code(401).send({ error: { code: ErrorCode.UNAUTHENTICATED } });
    }

    const decision = limiter.consume(context.tenantId);
    if (!decision.allowed) {
      reply.header("Retry-After", String(decision.retryAfterSeconds));
      return reply.code(429).send({ error: { code: "E_RATE_LIMITED" } });
    }

    request.sovereignContext = context;
    // Services verify this rather than re-deriving identity, and reject it without a
    // bound service identity (S1-D17).
    request.headers[SIGNED_CONTEXT_HEADER.toLowerCase()] = signContext(
      options.contextSecret,
      context,
      now(),
    );
    request.headers[CORRELATION_ID_HEADER.toLowerCase()] = correlationId;
  });

  app.get("/v1/integration-health", async (request, reply) => {
    if (request.sovereignContext === undefined) {
      return reply.code(401).send({ error: { code: ErrorCode.UNAUTHENTICATED } });
    }
    return options.health.snapshot();
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    // One shape out, always. An unhandled error must not become a stack trace on the
    // wire (§8.7).
    //
    // A SovereignError carries its own status and code, and is matched FIRST. It used
    // to fall through to the branch below, because that branch reads `statusCode` and
    // a SovereignError carries `httpStatus` — so every authorization refusal left the
    // gateway as a 500. That is not a cosmetic mismatch: it collapsed 403 and 404 into
    // one status, and the 404-not-403 asymmetry across tenants is the single rule this
    // whole surface exists to defend (spec §10 test 1). Nothing caught it because no
    // authorized route existed until the audit API.
    if (error instanceof SovereignError) {
      request.log.warn({ errorCode: error.code }, "request refused");
      return reply.code(error.httpStatus).send(error.toWireResponse());
    }

    request.log.error({ errorCode: "E_INTERNAL" }, error.message);
    const status = error.statusCode ?? 500;
    const code = status === 413 ? "E_PAYLOAD_TOO_LARGE" : ErrorCode.INTERNAL;
    return reply.code(status).send({ error: { code } });
  });

  return app;
}
