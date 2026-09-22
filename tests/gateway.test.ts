import { REQUIRED_AUDIENCE, SovereignClaims } from "@sovereign/adapter-identity-oidc";
import { SIGNED_CONTEXT_HEADER } from "@sovereign/contracts";
import {
  IntegrationHealthTracker,
  TRACKED_DEPENDENCIES,
  TenantRateLimiter,
  buildGateway,
} from "@sovereign/gateway";
import { verifyContext } from "@sovereign/kernel";
import type { FastifyInstance } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey, KeyLike } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ISSUER = "http://localhost:8081/realms/sovereign-local";
const CONTEXT_SECRET = "synthetic-per-environment-hmac-secret";
const NOW = new Date("2026-09-21T12:00:00Z");

let privateKey: KeyLike;
let jwks: JWTVerifyGetKey;
let revoked: Set<string>;
let health: IntegrationHealthTracker;
let app: FastifyInstance;

async function token(overrides: Record<string, unknown> = {}): Promise<string> {
  const iat = Math.floor(NOW.getTime() / 1000);
  return new SignJWT({
    [SovereignClaims.TENANT_ID]: "TENANT-SYN-A",
    [SovereignClaims.USER_ID]: "USER-SYN-A-1",
    [SovereignClaims.SESSION_ID]: "SESSION-SYN-1",
    [SovereignClaims.ROLES]: ["clinician"],
    [SovereignClaims.SITE_IDS]: ["SITE-SYN-A-1"],
    [SovereignClaims.MFA]: true,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 900)
    .setIssuer(ISSUER)
    .setAudience(REQUIRED_AUDIENCE)
    .sign(privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] });
  revoked = new Set<string>();
  health = new IntegrationHealthTracker(() => NOW);
  app = buildGateway({
    jwks,
    issuer: ISSUER,
    contextSecret: CONTEXT_SECRET,
    revocations: { isRevoked: (id) => revoked.has(id) },
    health,
    limiter: new TenantRateLimiter({ ratePerSecond: 50, burst: 200, now: () => NOW.getTime() }),
    now: () => NOW,
  });
  await app.ready();
});

afterAll(async () => {
  await app?.close();
});

describe("gateway authentication (S1-11)", () => {
  it("rejects a request with no bearer token", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/integration-health" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: { code: "E_UNAUTHENTICATED" } });
  });

  it("rejects a malformed authorization header", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/v1/integration-health",
      headers: { authorization: "Basic abc123" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("accepts a valid token", async () => {
    health.record("db", true);
    const res = await app.inject({
      method: "GET",
      url: "/v1/integration-health",
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("never explains why a token was rejected", async () => {
    // §4.2: a bare 401. Distinguishing "expired" from "wrong audience" from "bad
    // signature" tells an attacker which guess was closer.
    const res = await app.inject({
      method: "GET",
      url: "/v1/integration-health",
      headers: { authorization: "Bearer not-a-jwt" },
    });
    expect(res.json()).toEqual({ error: { code: "E_UNAUTHENTICATED" } });
    expect(res.body).not.toMatch(/signature|audience|issuer|expired|jwt/i);
  });

  it("rejects a cryptographically valid token whose session was revoked", async () => {
    // A token can be perfectly valid and belong to a session killed 10 seconds ago.
    revoked.add("SESSION-SYN-1");
    const res = await app.inject({
      method: "GET",
      url: "/v1/integration-health",
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.statusCode).toBe(401);
    revoked.delete("SESSION-SYN-1");
  });

  it("signs an internal context a service can verify", async () => {
    let captured: string | undefined;
    const probe = buildGateway({
      jwks,
      issuer: ISSUER,
      contextSecret: CONTEXT_SECRET,
      revocations: { isRevoked: () => false },
      health,
      now: () => NOW,
    });
    probe.get("/v1/echo", async (request) => {
      captured = request.headers[SIGNED_CONTEXT_HEADER.toLowerCase()] as string;
      return { ok: true };
    });
    await probe.ready();
    await probe.inject({
      method: "GET",
      url: "/v1/echo",
      headers: { authorization: `Bearer ${await token()}` },
    });
    await probe.close();

    expect(captured).toBeDefined();
    const verified = verifyContext(CONTEXT_SECRET, captured, {
      hasBoundServiceIdentity: true,
      now: NOW,
    });
    // Tenancy came from the verified token, not from anything the client set.
    expect(verified.tenantId).toBe("TENANT-SYN-A");
    expect(verified.roles).toEqual(["clinician"]);
  });

  it("ignores a client-supplied context header", async () => {
    // AGENTS.md doctrine 18. A caller must not be able to hand the gateway its own
    // security context and have it survive.
    let captured: string | undefined;
    const probe = buildGateway({
      jwks,
      issuer: ISSUER,
      contextSecret: CONTEXT_SECRET,
      revocations: { isRevoked: () => false },
      health,
      now: () => NOW,
    });
    probe.get("/v1/echo", async (request) => {
      captured = request.headers[SIGNED_CONTEXT_HEADER.toLowerCase()] as string;
      return { ok: true };
    });
    await probe.ready();
    await probe.inject({
      method: "GET",
      url: "/v1/echo",
      headers: {
        authorization: `Bearer ${await token()}`,
        [SIGNED_CONTEXT_HEADER]: "forged.context",
      },
    });
    await probe.close();
    expect(captured).not.toBe("forged.context");
    expect(
      verifyContext(CONTEXT_SECRET, captured, { hasBoundServiceIdentity: true, now: NOW }).tenantId,
    ).toBe("TENANT-SYN-A");
  });
});

describe("gateway security headers (S1-11)", () => {
  it("sets the documented headers on every response", async () => {
    const res = await app.inject({ method: "GET", url: "/health/live" });
    expect(res.headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    // A response may describe a patient; none may sit in a shared cache.
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("uses a fresh CSP nonce per response", async () => {
    const first = await app.inject({ method: "GET", url: "/health/live" });
    const second = await app.inject({ method: "GET", url: "/health/live" });
    expect(first.headers["content-security-policy"]).not.toBe(
      second.headers["content-security-policy"],
    );
  });

  it("sets headers on error responses too", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/integration-health" });
    expect(res.statusCode).toBe(401);
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });
});

describe("per-tenant rate limiting (S1-11)", () => {
  it("allows traffic within the burst", () => {
    const limiter = new TenantRateLimiter({ ratePerSecond: 10, burst: 5, now: () => 0 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.consume("T-A").allowed).toBe(true);
    }
  });

  it("throttles one tenant without affecting another", () => {
    // The noisy-neighbour guarantee. Spec §10 rate-limit test.
    const limiter = new TenantRateLimiter({ ratePerSecond: 1, burst: 2, now: () => 0 });
    limiter.consume("T-A");
    limiter.consume("T-A");
    expect(limiter.consume("T-A").allowed).toBe(false);
    expect(limiter.consume("T-B").allowed).toBe(true);
  });

  it("refills over time and reports a retry hint", () => {
    let clock = 0;
    const limiter = new TenantRateLimiter({ ratePerSecond: 2, burst: 2, now: () => clock });
    limiter.consume("T-A");
    limiter.consume("T-A");
    const denied = limiter.consume("T-A");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    clock = 2000;
    expect(limiter.consume("T-A").allowed).toBe(true);
  });

  it("evicts idle tenants so the map cannot grow without bound", () => {
    let clock = 0;
    const limiter = new TenantRateLimiter({ now: () => clock });
    limiter.consume("T-A");
    expect(limiter.trackedTenants).toBe(1);
    clock = 20 * 60 * 1000;
    limiter.evictIdle();
    expect(limiter.trackedTenants).toBe(0);
  });
});

describe("integration health (S1-11)", () => {
  it("starts every dependency as misconfigured, not healthy", () => {
    // An unprobed dependency must never read as working.
    const tracker = new IntegrationHealthTracker(() => NOW);
    for (const dependency of TRACKED_DEPENDENCIES) {
      expect(tracker.snapshot()[dependency].status).toBe("misconfigured");
    }
  });

  it("is not ready until the database is healthy", () => {
    const tracker = new IntegrationHealthTracker(() => NOW);
    expect(tracker.isReady()).toBe(false);
    tracker.record("db", true);
    expect(tracker.isReady()).toBe(true);
  });

  it("stays ready when a non-critical dependency fails", () => {
    // A Pub/Sub outage degrades features; it must not take down the audit reads an
    // incident responder needs.
    const tracker = new IntegrationHealthTracker(() => NOW);
    tracker.record("db", true);
    tracker.record("pubsub", false);
    expect(tracker.isReady()).toBe(true);
    expect(tracker.snapshot().pubsub.status).toBe("unavailable");
  });

  it("keeps the last success timestamp after a failure", () => {
    const tracker = new IntegrationHealthTracker(() => NOW);
    tracker.record("kms", true);
    tracker.record("kms", false);
    const kms = tracker.snapshot().kms;
    expect(kms.lastSuccessAt).toBe(NOW.toISOString());
    expect(kms.lastFailureAt).toBe(NOW.toISOString());
  });

  it("exposes no field that could carry a message or secret", () => {
    const tracker = new IntegrationHealthTracker(() => NOW);
    tracker.record("db", false);
    const keys = Object.keys(tracker.snapshot().db).sort();
    expect(keys).toEqual(["lastFailureAt", "lastSuccessAt", "status"]);
  });

  it("requires authentication to read integration health", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/integration-health" });
    expect(res.statusCode).toBe(401);
  });
});
