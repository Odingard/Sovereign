/**
 * Audit API routes (WO-002C S1-15, spec §7.3 API table).
 *
 * The service logic is covered in tests/audit-query-export.test.ts. These cover what
 * the HTTP surface adds: where the capability comes from, where the tenant comes from,
 * and whether reading the audit log leaves a trace.
 */

import { REQUIRED_AUDIENCE, SovereignClaims } from "@sovereign/adapter-identity-oidc";
import type { RequestContext } from "@sovereign/contracts";
import {
  type AuthorizationDecision,
  type AuthorizationEvaluator,
  AuthorizationOutcome,
  CanonicalCapabilities,
} from "@sovereign/domain";
import {
  type AuditAccessRecorder,
  type AuditReadPort,
  IntegrationHealthTracker,
  TenantRateLimiter,
  buildGateway,
  registerAuditRoutes,
} from "@sovereign/gateway";
import type { FastifyInstance } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey, KeyLike } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ISSUER = "http://localhost:8081/realms/sovereign-local";
const SECRET = "synthetic-per-environment-hmac-secret";
const NOW = new Date("2026-09-22T12:00:00Z");
const TENANT_A = "TENANT-SYN-ROUTE-A";
const TENANT_B = "TENANT-SYN-ROUTE-B";

let privateKey: KeyLike;
let jwks: JWTVerifyGetKey;
let app: FastifyInstance;

/** Records what the routes asked for, so a test can assert on the request, not the reply. */
let capabilitiesRequested: string[] = [];
let tenantsQueried: string[] = [];
let recorded: { tenantId: string; action: string }[] = [];
let exportCalls: { requestedBy: string; approvals: unknown[] }[] = [];

const evaluator: AuthorizationEvaluator = {
  evaluate: async (request) => {
    capabilitiesRequested.push(String(request.requestedCapability));
    return {
      decisionId: "DEC",
      outcome: AuthorizationOutcome.PERMIT,
      reasonCode: "SYN",
    } as unknown as AuthorizationDecision;
  },
};

const denyingEvaluator: AuthorizationEvaluator = {
  evaluate: async (request) => {
    capabilitiesRequested.push(String(request.requestedCapability));
    return {
      decisionId: "DEC",
      outcome: AuthorizationOutcome.DENY,
      reasonCode: "SYN",
    } as unknown as AuthorizationDecision;
  },
};

const audit: AuditReadPort = {
  async query(tenantId) {
    tenantsQueried.push(tenantId);
    return { rows: [{ eventId: "EVT-1" }], truncated: true, nextAfterSeq: 42n };
  },
  async verify(tenantId) {
    tenantsQueried.push(tenantId);
    return { verified: true, eventsChecked: 3 };
  },
  async export(request) {
    exportCalls.push({ requestedBy: request.requestedBy, approvals: request.approvals });
    return { manifest: { rowCount: 1 }, signature: "sig:synthetic", body: "{}\n" };
  },
};

const recorder: AuditAccessRecorder = {
  async record(context: RequestContext, action) {
    recorded.push({ tenantId: context.tenantId, action });
  },
};

async function tokenFor(tenantId: string) {
  const iat = Math.floor(NOW.getTime() / 1000);
  return new SignJWT({
    [SovereignClaims.TENANT_ID]: tenantId,
    [SovereignClaims.USER_ID]: `USER-${tenantId}`,
    [SovereignClaims.SESSION_ID]: `SESSION-${tenantId}`,
    [SovereignClaims.ROLES]: ["auditor"],
    [SovereignClaims.SITE_IDS]: [`SITE-${tenantId}`],
    [SovereignClaims.MFA]: true,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 900)
    .setIssuer(ISSUER)
    .setAudience(REQUIRED_AUDIENCE)
    .sign(privateKey);
}

async function buildWith(evaluatorToUse: AuthorizationEvaluator): Promise<FastifyInstance> {
  const health = new IntegrationHealthTracker(() => NOW);
  health.record("db", true);
  const instance = buildGateway({
    jwks,
    issuer: ISSUER,
    contextSecret: SECRET,
    revocations: { isRevoked: () => false },
    health,
    limiter: new TenantRateLimiter({ now: () => NOW.getTime() }),
    now: () => NOW,
  });
  registerAuditRoutes(instance, { evaluator: evaluatorToUse, audit, recorder });
  await instance.ready();
  return instance;
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] });
  app = await buildWith(evaluator);
});

beforeEach(() => {
  capabilitiesRequested = [];
  tenantsQueried = [];
  recorded = [];
  exportCalls = [];
});

afterAll(async () => {
  await app?.close();
});

describe("audit API routes (S1-15, spec §7.3)", () => {
  it("rejects an unauthenticated request", async () => {
    const response = await app.inject({ method: "GET", url: "/audit/events" });
    expect(response.statusCode).toBe(401);
    expect(recorded).toEqual([]);
  });

  it("resolves the capability from the route, not from the request", async () => {
    // Doctrine 18: the requester does not define the security requirements for its
    // own request. A `capability` parameter must change nothing.
    await app.inject({
      method: "GET",
      url: "/audit/events?capability=clinical_state:read",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(capabilitiesRequested).toEqual([CanonicalCapabilities.AUDIT_QUERY]);
  });

  it("asks for a different capability on each endpoint", async () => {
    // Querying returns a page, verifying returns a boolean, exporting produces a file
    // that leaves the platform. One capability for all three would mean anyone who can
    // read the log can also walk out with it.
    const auth = { authorization: `Bearer ${await tokenFor(TENANT_A)}` };
    await app.inject({ method: "GET", url: "/audit/events", headers: auth });
    await app.inject({ method: "GET", url: "/audit/verify", headers: auth });
    await app.inject({
      method: "POST",
      url: "/audit/exports",
      headers: auth,
      payload: { approvals: [] },
    });
    expect(capabilitiesRequested).toEqual([
      CanonicalCapabilities.AUDIT_QUERY,
      CanonicalCapabilities.AUDIT_VERIFY,
      CanonicalCapabilities.AUDIT_EXPORT,
    ]);
  });

  it("takes the tenant from the verified context, not from a parameter", async () => {
    // A tenant id in a query string is a suggestion.
    await app.inject({
      method: "GET",
      url: `/audit/events?tenant_id=${TENANT_B}&tenantId=${TENANT_B}`,
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(tenantsQueried).toEqual([TENANT_A]);
  });

  it("records the query in the log it just read", async () => {
    // The point of the endpoint's own audit row: the log records who read it.
    await app.inject({
      method: "GET",
      url: "/audit/events",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(recorded).toEqual([{ tenantId: TENANT_A, action: "audit.query" }]);
  });

  it("records a verify and an export too", async () => {
    const auth = { authorization: `Bearer ${await tokenFor(TENANT_A)}` };
    await app.inject({ method: "GET", url: "/audit/verify", headers: auth });
    await app.inject({
      method: "POST",
      url: "/audit/exports",
      headers: auth,
      payload: { approvals: [] },
    });
    expect(recorded.map((r) => r.action)).toEqual(["audit.verify", "audit.export"]);
  });

  it("records nothing when authorization is refused", async () => {
    // A refused read is not an access. Recording it as one would fill the log with
    // rows that say somebody saw something they did not see.
    const denying = await buildWith(denyingEvaluator);
    const response = await denying.inject({
      method: "GET",
      url: "/audit/events",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(response.statusCode).toBe(403);
    expect(recorded).toEqual([]);
    await denying.close();
  });

  it("passes the truncation flag through instead of hiding it", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/audit/events",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    const payload = response.json();
    expect(payload.truncated).toBe(true);
    // A bigint cursor has to survive JSON. Dropping it silently would strand the
    // caller on page one while telling them there is more.
    expect(payload.nextAfterSeq).toBe("42");
  });

  it("takes the export requester from the context, never from the body", async () => {
    // Otherwise the requester and one approver can be the same person wearing two
    // names in one JSON document.
    await app.inject({
      method: "POST",
      url: "/audit/exports",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
      payload: { requestedBy: "SOMEBODY-ELSE", approvals: [] },
    });
    expect(exportCalls[0]?.requestedBy).toBe(`USER-${TENANT_A}`);
  });

  it("drops a malformed approval rather than counting it", async () => {
    // A half-parsed approval that still counts toward the two is dual control
    // satisfied by a typo.
    await app.inject({
      method: "POST",
      url: "/audit/exports",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
      payload: {
        approvals: [
          { approverId: "USER-SYN-1", approvedAt: "2026-09-22T09:00:00Z" },
          { approverId: "USER-SYN-2" },
          { approvedAt: "2026-09-22T09:00:00Z" },
          { approverId: 42, approvedAt: "not-a-date" },
        ],
      },
    });
    expect(exportCalls[0]?.approvals).toHaveLength(1);
  });

  it("gives a refusal its real status, not a 500", async () => {
    // The gateway error handler read `statusCode`; a SovereignError carries
    // `httpStatus`, so every refusal used to leave as 500 E_INTERNAL. That collapsed
    // 403 and 404 into one status — and the 404-not-403 asymmetry across tenants is
    // the single rule this surface exists to defend.
    const denying = await buildWith(denyingEvaluator);
    const response = await denying.inject({
      method: "GET",
      url: "/audit/events",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(response.json()).toEqual({ error: { code: "E_FORBIDDEN" } });
    await denying.close();
  });

  it("puts only a code on the wire, never the reason", async () => {
    const denying = await buildWith(denyingEvaluator);
    const response = await denying.inject({
      method: "GET",
      url: "/audit/events",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(response.body).not.toContain("audit:query");
    expect(response.body).not.toContain("Authorization outcome");
    await denying.close();
  });

  it("returns only verified-or-not, never where the chain broke", async () => {
    // The failing sequence tells whoever broke the chain exactly what to repair.
    const response = await app.inject({
      method: "GET",
      url: "/audit/verify",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A)}` },
    });
    expect(response.json()).toEqual({ verified: true, eventsChecked: 3 });
  });
});
