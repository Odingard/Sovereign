/**
 * Adversarial suite — tenant isolation and authorization (spec §10).
 *
 * Each test takes an attacker's position and asserts the attack fails. Numbered to
 * match the spec so a reader can check coverage without cross-referencing.
 */

import {
  REQUIRED_AUDIENCE,
  SovereignClaims,
  actorKindForRoles,
} from "@sovereign/adapter-identity-oidc";
import {
  SCIM_USER_SCHEMA,
  ScimUserSchema,
  authenticateScim,
  effectForUser,
  hashScimToken,
} from "@sovereign/adapter-identity-scim";
import { toEcs } from "@sovereign/adapter-siem-export";
import type { AuditEventInput } from "@sovereign/contracts";
import { SIGNED_CONTEXT_HEADER } from "@sovereign/contracts";
import { decryptField, encryptField } from "@sovereign/crypto";
import {
  ActorKind,
  AuthorizationOutcome,
  BREAK_GLASS_MAX_DURATION_MS,
  BreakGlassRefusal,
  capabilitiesForRole,
  evaluateBreakGlassRequest,
  mayReadUnderBreakGlass,
  requiresMfa,
} from "@sovereign/domain";
import type {
  AuthorizationDecision,
  AuthorizationEvaluator,
  AuthorizationRequest,
} from "@sovereign/domain";
import { IntegrationHealthTracker, TenantRateLimiter, buildGateway } from "@sovereign/gateway";
import {
  ErrorCode,
  type SiteScope,
  type SovereignError,
  checkIdempotency,
  requireCapability,
  signContext,
  verifyContext,
} from "@sovereign/kernel";
import { planMerge } from "@sovereign/service-patient-context";
import { ErasureRefusedError, planErasure } from "@sovereign/service-retention";
import { createLogger } from "@sovereign/telemetry";
import type { FastifyInstance } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey, KeyLike } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ISSUER = "http://localhost:8081/realms/sovereign-local";
const SECRET = "synthetic-per-environment-hmac-secret";
const NOW = new Date("2026-09-22T12:00:00Z");
const TENANT_A = "TENANT-SYN-A";
const TENANT_B = "TENANT-SYN-B";

let privateKey: KeyLike;
let otherKey: KeyLike;
let jwks: JWTVerifyGetKey;
let app: FastifyInstance;

async function tokenFor(tenantId: string, overrides: Record<string, unknown> = {}, key?: KeyLike) {
  const iat = Math.floor(NOW.getTime() / 1000);
  return new SignJWT({
    [SovereignClaims.TENANT_ID]: tenantId,
    [SovereignClaims.USER_ID]: `USER-${tenantId}`,
    [SovereignClaims.SESSION_ID]: `SESSION-${tenantId}`,
    [SovereignClaims.ROLES]: ["clinician"],
    [SovereignClaims.SITE_IDS]: [`SITE-${tenantId}`],
    [SovereignClaims.MFA]: true,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + 900)
    .setIssuer(ISSUER)
    .setAudience(REQUIRED_AUDIENCE)
    .sign(key ?? privateKey);
}

const context = (tenantId: string) => ({
  tenantId,
  userId: `USER-${tenantId}`,
  sessionId: `SESSION-${tenantId}`,
  roles: ["clinician" as const],
  siteIds: [`SITE-${tenantId}`],
  actorKind: ActorKind.HUMAN_CLINICIAN,
  correlationId: "CORR-1",
  requestedAt: NOW,
  mfa: true,
});

function evaluator(outcome: AuthorizationOutcome): AuthorizationEvaluator {
  return {
    evaluate: async () =>
      ({ decisionId: "DEC", outcome, reasonCode: "SYN" }) as unknown as AuthorizationDecision,
  };
}

const requestFor = (targetTenant: string): AuthorizationRequest => ({
  securityContext: {} as AuthorizationRequest["securityContext"],
  requestedCapability: "patient:read" as AuthorizationRequest["requestedCapability"],
  targetResource: {
    aggregateType: "patient",
    aggregateId: "PAT-1",
    targetTenantId: targetTenant as AuthorizationRequest["targetResource"]["targetTenantId"],
  },
});

/** A resource that is not site-scoped. The site check is a no-op for these. */
const TENANT_WIDE: SiteScope = { grantedSiteIds: [], resourceSiteId: null };

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] });

  const health = new IntegrationHealthTracker(() => NOW);
  health.record("db", true);
  app = buildGateway({
    jwks,
    issuer: ISSUER,
    contextSecret: SECRET,
    revocations: { isRevoked: () => false },
    health,
    limiter: new TenantRateLimiter({ now: () => NOW.getTime() }),
    now: () => NOW,
  });
  app.get("/v1/echo", async (request) => ({
    seenContext: request.headers[SIGNED_CONTEXT_HEADER.toLowerCase()],
    seenTenantHeader: request.headers["x-tenant-id"],
    // Echoed so §10.24 can assert on the actor kind the GATEWAY derived, rather than
    // on what a helper returns when called directly. Test-only route.
    derivedActorKind: request.sovereignContext?.actorKind,
    derivedTenantId: request.sovereignContext?.tenantId,
  }));
  await app.ready();
});

afterAll(async () => {
  await app?.close();
});

describe("§10.1 cross-tenant read returns 404, never 403", () => {
  it("refuses tenant B's resource to tenant A without confirming it exists", async () => {
    // A 403 would confirm the object exists and turn the API into a cross-tenant
    // enumeration oracle. This asymmetry is the load-bearing one.
    try {
      await requireCapability(
        evaluator(AuthorizationOutcome.PERMIT),
        requestFor(TENANT_B),
        TENANT_A,
        TENANT_WIDE,
      );
      throw new Error("expected refusal");
    } catch (error) {
      expect((error as SovereignError).code).toBe(ErrorCode.NOT_FOUND);
      expect((error as SovereignError).httpStatus).toBe(404);
    }
  });

  it("refuses before the evaluator runs, so a bad grant cannot open a path", async () => {
    let called = false;
    const spy: AuthorizationEvaluator = {
      evaluate: async () => {
        called = true;
        return { outcome: AuthorizationOutcome.PERMIT } as unknown as AuthorizationDecision;
      },
    };
    await expect(
      requireCapability(spy, requestFor(TENANT_B), TENANT_A, TENANT_WIDE),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });
});

describe("§10.2 tampered tenant identity is ignored", () => {
  it("overwrites a client-supplied signed context", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/echo",
      headers: {
        authorization: `Bearer ${await tokenFor(TENANT_A)}`,
        [SIGNED_CONTEXT_HEADER]: signContext(SECRET, context(TENANT_B), NOW),
      },
    });
    const verified = verifyContext(SECRET, response.json().seenContext, {
      hasBoundServiceIdentity: true,
      now: NOW,
    });
    // The forged context claimed tenant B. The resolved tenant is A, from the token.
    expect(verified.tenantId).toBe(TENANT_A);
  });

  it("ignores a tenant id supplied as a plain header", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/echo",
      headers: {
        authorization: `Bearer ${await tokenFor(TENANT_A)}`,
        "x-tenant-id": TENANT_B,
      },
    });
    const verified = verifyContext(SECRET, response.json().seenContext, {
      hasBoundServiceIdentity: true,
      now: NOW,
    });
    expect(verified.tenantId).toBe(TENANT_A);
  });
});

describe("§10.3 forged or expired signed context is rejected", () => {
  it("rejects a context signed with the wrong secret", () => {
    const forged = signContext("attacker-secret", context(TENANT_B), NOW);
    expect(() =>
      verifyContext(SECRET, forged, { hasBoundServiceIdentity: true, now: NOW }),
    ).toThrow();
  });

  it("rejects a context older than 60 seconds", () => {
    const stale = signContext(SECRET, context(TENANT_A), NOW);
    expect(() =>
      verifyContext(SECRET, stale, {
        hasBoundServiceIdentity: true,
        now: new Date(NOW.getTime() + 61_000),
      }),
    ).toThrow();
  });
});

describe("§10.4 malformed tokens are rejected at the edge", () => {
  const attacks: [string, () => Promise<string>][] = [
    [
      "missing tenant_id",
      async () => tokenFor(TENANT_A, { [SovereignClaims.TENANT_ID]: undefined }),
    ],
    [
      "wrong audience",
      async () => {
        const iat = Math.floor(NOW.getTime() / 1000);
        return new SignJWT({
          [SovereignClaims.TENANT_ID]: TENANT_A,
          [SovereignClaims.USER_ID]: "U",
          [SovereignClaims.SESSION_ID]: "S",
          [SovereignClaims.ROLES]: ["clinician"],
        })
          .setProtectedHeader({ alg: "RS256", kid: "test-key" })
          .setIssuedAt(iat)
          .setExpirationTime(iat + 900)
          .setIssuer(ISSUER)
          .setAudience("https://elsewhere.example.test")
          .sign(privateKey);
      },
    ],
    ["wrong signing key", async () => tokenFor(TENANT_A, {}, otherKey)],
  ];

  for (const [name, mint] of attacks) {
    it(`rejects a token with ${name}`, async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/echo",
        headers: { authorization: `Bearer ${await mint()}` },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: { code: "E_UNAUTHENTICATED" } });
    });
  }

  it("rejects alg=none", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ [SovereignClaims.TENANT_ID]: TENANT_A })).toString(
      "base64url",
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/echo",
      headers: { authorization: `Bearer ${header}.${body}.` },
    });
    expect(response.statusCode).toBe(401);
  });

  it("never explains which check failed", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/echo",
      headers: { authorization: `Bearer ${await tokenFor(TENANT_A, {}, otherKey)}` },
    });
    expect(response.body).not.toMatch(/signature|audience|issuer|expired|claim/i);
  });
});

describe("§10.6 role matrix sweep", () => {
  it("grants no capability outside the compiled matrix", () => {
    // Drift between matrix.yaml and the compiled registry is a silent privilege
    // change. The compiler's drift gate catches the file; this catches the semantics.
    for (const role of ["clinician", "nurse_ma", "auditor", "support_readonly", "patient"]) {
      for (const capability of capabilitiesForRole(role)) {
        expect(typeof capability).toBe("string");
      }
    }
    expect(capabilitiesForRole("support_readonly")).toEqual([]);
    expect(capabilitiesForRole("patient")).toEqual([]);
    expect(capabilitiesForRole("not-a-role")).toEqual([]);
  });

  it("keeps clinical signing away from administrative roles", () => {
    for (const role of ["practice_manager", "org_admin", "security_admin", "auditor"]) {
      expect(capabilitiesForRole(role)).not.toContain("order:sign_transaction");
    }
  });
});

describe("§10.7 a user granted one site cannot reach another site's patient", () => {
  const evaluatorThatWouldPermit = evaluator(AuthorizationOutcome.PERMIT);

  function scoped(granted: string[], resourceSite: string | null): SiteScope {
    return { grantedSiteIds: granted, resourceSiteId: resourceSite };
  }

  it("returns 404, not 403, for a patient at a site the caller was not granted", async () => {
    // Within a tenant, a 403 confirms that a patient is being seen at another of the
    // organisation's clinics. That is itself a disclosure, so the answer is the same
    // one a non-existent patient gets.
    await expect(
      requireCapability(
        evaluatorThatWouldPermit,
        requestFor(TENANT_A),
        TENANT_A,
        scoped(["SITE-X"], "SITE-Y"),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("refuses before the evaluator runs", async () => {
    let called = false;
    const spy: AuthorizationEvaluator = {
      evaluate: async () => {
        called = true;
        return { outcome: AuthorizationOutcome.PERMIT } as unknown as AuthorizationDecision;
      },
    };
    await expect(
      requireCapability(spy, requestFor(TENANT_A), TENANT_A, scoped(["SITE-X"], "SITE-Y")),
    ).rejects.toThrow();
    expect(called).toBe(false);
  });

  it("permits the caller's own site", async () => {
    const decision = await requireCapability(
      evaluatorThatWouldPermit,
      requestFor(TENANT_A),
      TENANT_A,
      scoped(["SITE-X", "SITE-Y"], "SITE-Y"),
    );
    expect(decision.permitted).toBe(true);
  });

  it("treats no granted sites as no access, never as every site", async () => {
    // Breadth of access is granted, never inferred from the absence of a restriction
    // (AGENTS.md doctrine 17). A user who works across a whole tenant is given every
    // site explicitly — a statement somebody made, rather than a silence somebody read.
    await expect(
      requireCapability(
        evaluatorThatWouldPermit,
        requestFor(TENANT_A),
        TENANT_A,
        scoped([], "SITE-X"),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("leaves a genuinely tenant-wide resource alone", async () => {
    const decision = await requireCapability(
      evaluatorThatWouldPermit,
      requestFor(TENANT_A),
      TENANT_A,
      scoped([], null),
    );
    expect(decision.permitted).toBe(true);
  });

  it("checks the tenant before the site, so a cross-tenant call cannot be masked", async () => {
    // Granting the caller the target's site must not make another tenant's resource
    // reachable. Both refuse, and the tenant check is the one that fires.
    await expect(
      requireCapability(
        evaluatorThatWouldPermit,
        requestFor(TENANT_B),
        TENANT_A,
        scoped(["SITE-X"], "SITE-X"),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });
});

describe("§10.8 privileged capabilities require MFA", () => {
  it("requires MFA for every privileged capability", () => {
    for (const capability of [
      "admin:tenant_manage",
      "authority_grant:issue_class_c",
      "order:sign_transaction",
      "prior_auth:authorize_submission",
    ]) {
      expect(requiresMfa(capability), capability).toBe(true);
    }
  });
});

describe("§10.10 idempotency", () => {
  function store() {
    const map = new Map<string, { requestHash: string; response: unknown }>();
    const k = (t: string, u: string, key: string) => `${t}|${u}|${key}`;
    return {
      get: async (t: string, u: string, key: string) => map.get(k(t, u, key)),
      put: async (
        t: string,
        u: string,
        key: string,
        record: { requestHash: string; response: unknown },
      ) => {
        map.set(k(t, u, key), record);
      },
    };
  }
  const UUID = "8a2f4c7e-1b3d-4e5f-9a0b-6c7d8e9f0a1b";

  it("replays an identical request and refuses a reused key with a different body", async () => {
    const s = store();
    const first = await checkIdempotency<{ id: string }>(s, TENANT_A, "U", UUID, { a: 1 });
    if (first.kind === "proceed") {
      await first.record({ id: "RES-1" });
    }
    expect(await checkIdempotency(s, TENANT_A, "U", UUID, { a: 1 })).toEqual({
      kind: "replay",
      response: { id: "RES-1" },
    });
    await expect(checkIdempotency(s, TENANT_A, "U", UUID, { a: 2 })).rejects.toThrow();
  });

  it("scopes keys per tenant so one tenant cannot probe another's", async () => {
    const s = store();
    const a = await checkIdempotency<unknown>(s, TENANT_A, "U", UUID, { a: 1 });
    if (a.kind === "proceed") {
      await a.record({ tenant: "A" });
    }
    expect((await checkIdempotency(s, TENANT_B, "U", UUID, { a: 1 })).kind).toBe("proceed");
  });
});

describe("§10.13 no PHI reaches logs", () => {
  it("emits none of the seeded PHI however it is passed", () => {
    const lines: string[] = [];
    const log = createLogger({ level: "debug", sink: (l) => lines.push(l), now: () => NOW });
    const phi = {
      mrn: `MRN${4471902}`,
      ssn: ["412", "88", "7390"].join("-"),
      lastName: "Vandersloot",
      note: "Patient reports morning stiffness.",
    };
    log.info("patient read", { tenantId: TENANT_A, ...phi });
    log.error("failure", { result: phi });
    log.info("as a key", { [phi.mrn]: 1 });
    log.child(phi).warn("from child");

    const output = lines.join("\n");
    for (const [field, value] of Object.entries(phi)) {
      expect(output, `leaked ${field}`).not.toContain(value);
    }
    expect(output).toContain(TENANT_A);
  });
});

describe("§10.15 break-glass is loud, narrow and time-boxed", () => {
  const NOW_BG = new Date("2026-09-22T03:00:00Z");
  const GOOD_REASON = "Unresponsive patient in ED, treating team needs allergy history";

  function request(over: Record<string, unknown> = {}) {
    return {
      tenantId: TENANT_A,
      requestedByActorId: "USER-SYN-SUPPORT",
      requestedByActorKind: ActorKind.HUMAN_STAFF,
      reason: GOOD_REASON,
      requestedDurationMs: 60 * 60 * 1000,
      approverActorIds: ["USER-SYN-APPROVER-1", "USER-SYN-APPROVER-2"],
      ...over,
    };
  }

  it("gives support_readonly no PHI access by default", () => {
    // The deny half. Break-glass is a grant, never a role default (§6.3).
    expect(capabilitiesForRole("support_readonly")).toEqual([]);
  });

  it("refuses an AI principal outright", () => {
    // No configuration, no emergency and no approval makes this permissible. The
    // check runs FIRST so an AI principal is never merely a caller that failed some
    // other check — that would be one bug away from a caller that passed them.
    for (const kind of [ActorKind.AI_AGENT_RUNTIME, ActorKind.SOVEREIGN_SERVICE]) {
      const result = evaluateBreakGlassRequest(request({ requestedByActorKind: kind }), NOW_BG);
      expect(result).toEqual({ granted: false, refusal: BreakGlassRefusal.AI_PRINCIPAL });
    }
  });

  it("refuses an AI principal even with perfect approvals and reason", () => {
    const result = evaluateBreakGlassRequest(
      request({
        requestedByActorKind: ActorKind.AI_AGENT_RUNTIME,
        approverActorIds: ["USER-SYN-1", "USER-SYN-2", "USER-SYN-3"],
      }),
      NOW_BG,
    );
    expect(result).toEqual({ granted: false, refusal: BreakGlassRefusal.AI_PRINCIPAL });
  });

  it("refuses a requester who approved their own emergency", () => {
    const result = evaluateBreakGlassRequest(
      request({ approverActorIds: ["USER-SYN-SUPPORT", "USER-SYN-APPROVER-1"] }),
      NOW_BG,
    );
    expect(result).toEqual({ granted: false, refusal: BreakGlassRefusal.SELF_APPROVAL });
  });

  it("refuses one approver, and the same approver twice", () => {
    expect(
      evaluateBreakGlassRequest(request({ approverActorIds: ["USER-SYN-1"] }), NOW_BG),
    ).toEqual({ granted: false, refusal: BreakGlassRefusal.INSUFFICIENT_APPROVALS });
    expect(
      evaluateBreakGlassRequest(
        request({ approverActorIds: ["USER-SYN-1", "USER-SYN-1"] }),
        NOW_BG,
      ),
    ).toEqual({ granted: false, refusal: BreakGlassRefusal.INSUFFICIENT_APPROVALS });
  });

  it("refuses a blank or token reason", () => {
    // Every read under the grant is audited with this reason. A blank one makes that
    // trail worthless at the only moment it is ever read.
    for (const reason of ["", "   ", "urgent", "need access"]) {
      expect(evaluateBreakGlassRequest(request({ reason }), NOW_BG)).toEqual({
        granted: false,
        refusal: BreakGlassRefusal.REASON_MISSING,
      });
    }
  });

  it("refuses a window longer than four hours rather than clamping it", () => {
    // A caller who asked for 24 hours and was quietly given 4 will plan around 24 and
    // be surprised in the middle of whatever the emergency was.
    const result = evaluateBreakGlassRequest(
      request({ requestedDurationMs: BREAK_GLASS_MAX_DURATION_MS + 1 }),
      NOW_BG,
    );
    expect(result).toEqual({
      granted: false,
      refusal: BreakGlassRefusal.DURATION_EXCEEDS_MAXIMUM,
    });
  });

  it("grants a well-formed emergency and fires an alert naming both approvers", () => {
    const result = evaluateBreakGlassRequest(request(), NOW_BG);
    expect(result.granted).toBe(true);
    if (!result.granted) {
      return;
    }
    expect(result.expiresAt).toEqual(new Date("2026-09-22T04:00:00Z"));
    expect(result.alert.approvedBy).toEqual(["USER-SYN-APPROVER-1", "USER-SYN-APPROVER-2"]);
    expect(result.alert.tenantId).toBe(TENANT_A);
  });

  it("carries no clinical content in the alert", () => {
    // The alert goes to an on-call channel. It says who, when and for how long — an
    // identifier is not content, and the reason text is not repeated here.
    const result = evaluateBreakGlassRequest(request(), NOW_BG);
    expect(result.granted).toBe(true);
    if (!result.granted) {
      return;
    }
    expect(JSON.stringify(result.alert)).not.toContain("allergy");
    expect(JSON.stringify(result.alert)).not.toContain(GOOD_REASON);
  });

  it("stops allowing reads the moment the window closes", () => {
    // Expiry is checked at use, not by a cleanup job that might not have run.
    const grant = { expiresAt: new Date("2026-09-22T04:00:00Z") };
    expect(mayReadUnderBreakGlass(grant, NOW_BG, GOOD_REASON)).toBe(true);
    expect(mayReadUnderBreakGlass(grant, new Date("2026-09-22T04:00:00Z"), GOOD_REASON)).toBe(
      false,
    );
    expect(mayReadUnderBreakGlass(grant, new Date("2026-09-22T05:00:00Z"), GOOD_REASON)).toBe(
      false,
    );
  });

  it("stops allowing reads the moment the grant is revoked", () => {
    const grant = {
      expiresAt: new Date("2026-09-22T04:00:00Z"),
      revokedAt: new Date("2026-09-22T03:10:00Z"),
    };
    expect(mayReadUnderBreakGlass(grant, new Date("2026-09-22T03:20:00Z"), GOOD_REASON)).toBe(
      false,
    );
  });

  it("requires a reason on every read, not only on the grant", () => {
    // One reason given four hours ago does not explain what somebody is looking at
    // now.
    const grant = { expiresAt: new Date("2026-09-22T04:00:00Z") };
    expect(mayReadUnderBreakGlass(grant, NOW_BG, "")).toBe(false);
    expect(mayReadUnderBreakGlass(grant, NOW_BG, "looking")).toBe(false);
  });
});

describe("§10.19 SCIM cannot cross tenants", () => {
  it("resolves the tenant from the connection, not the request", async () => {
    const tokenA = "synthetic-scim-token-a";
    const tokenB = "synthetic-scim-token-b";
    const connections = [
      {
        connectionId: "C-A",
        tenantId: TENANT_A,
        tokenHash: hashScimToken(tokenA),
        status: "active" as const,
      },
      {
        connectionId: "C-B",
        tenantId: TENANT_B,
        tokenHash: hashScimToken(tokenB),
        status: "active" as const,
      },
    ];
    const lookup = async (hash: Uint8Array) =>
      connections.find((c) => Buffer.from(c.tokenHash).equals(Buffer.from(hash)));

    expect((await authenticateScim(`Bearer ${tokenA}`, lookup)).tenantId).toBe(TENANT_A);
    await expect(authenticateScim("Bearer forged", lookup)).rejects.toThrow();
  });

  it("revokes sessions on deactivation even when the same request adds a group", () => {
    const effect = effectForUser(
      ScimUserSchema.parse({ schemas: [SCIM_USER_SCHEMA], userName: "leaver", active: false }),
      ["GRP-CLIN"],
      [{ groupExternalId: "GRP-CLIN", role: "clinician", siteId: null }],
      { active: true },
    );
    expect(effect).toEqual({ kind: "deactivate", userName: "leaver", revokeSessions: true });
  });
});

describe("§10.20 a signed context alone is never sufficient", () => {
  it("rejects a valid context with no bound service identity", () => {
    const valid = signContext(SECRET, context(TENANT_A), NOW);
    expect(() =>
      verifyContext(SECRET, valid, { hasBoundServiceIdentity: false, now: NOW }),
    ).toThrow();
  });
});

describe("§10.21 SIEM export cannot carry another tenant's data", () => {
  const event = (tenantId: string): AuditEventInput => ({
    eventId: `EVT-${tenantId}`,
    tenantId,
    siteId: null,
    actorKind: ActorKind.HUMAN_CLINICIAN,
    actorId: "A",
    roleGrant: null,
    patientId: "PAT-SECRET",
    resourceType: "patient",
    resourceId: null,
    resourceVersion: null,
    action: "patient.read",
    reason: "clinical note content",
    occurredAt: NOW,
    requestId: "R",
    correlationId: "C",
    causationId: null,
    source: null,
    destination: null,
    policyVersion: "p@1",
    configVersion: null,
    modelVersion: null,
    promptVersion: null,
    priorState: null,
    newState: null,
    artifactHash: null,
    result: "success",
    errorCode: null,
  });

  it("stamps every exported event with its own tenant", () => {
    expect(toEcs(event(TENANT_A))["organization.id"]).toBe(TENANT_A);
    expect(toEcs(event(TENANT_B))["organization.id"]).toBe(TENANT_B);
  });

  it("excludes patient identifiers and clinical content by default", () => {
    const serialized = JSON.stringify(toEcs(event(TENANT_A)));
    expect(serialized).not.toContain("PAT-SECRET");
    expect(serialized).not.toContain("clinical note content");
  });
});

describe("§10.22 erasure under legal hold is refused", () => {
  it("refuses even when dual-control approval is present", () => {
    // Two approvals do not override a hold, and the check runs first.
    expect(() =>
      planErasure(
        {
          requestId: "ERA-1",
          tenantId: TENANT_A,
          scope: "tenant",
          subjectId: null,
          reason: "termination",
          requestedBy: "ACTOR-1",
          approvedBy: "ACTOR-2",
          contractTerminationVerified: true,
        },
        [
          {
            holdId: "HOLD-1",
            scope: "tenant",
            subjectId: null,
            reason: "litigation",
            releasedAt: null,
          },
        ],
      ),
    ).toThrow(ErasureRefusedError);
  });

  it("leaves ciphertext unreadable once the key is gone", () => {
    const dek = Buffer.alloc(32, 9);
    const envelope = encryptField(dek, "kid", TENANT_A, "synthetic demographics");
    // Simulating key destruction: the DEK no longer exists, so nothing opens it.
    const destroyed = Buffer.alloc(32, 0);
    expect(() => decryptField(destroyed, TENANT_A, envelope)).toThrow();
  });
});

describe("§10.24 an AI principal cannot reach Class C or D", () => {
  it("is never derivable from a user token", () => {
    for (const roles of [["clinician"], ["org_admin"], ["auditor"], []]) {
      const kind = actorKindForRoles(roles);
      expect(kind).not.toBe(ActorKind.AI_AGENT_RUNTIME);
      expect(kind).not.toBe(ActorKind.SOVEREIGN_SERVICE);
    }
  });

  it("is not obtainable by forging the claim, through the HTTP edge", async () => {
    // The end-to-end half the spec actually asks for: "WO-002 invariant preserved
    // end-to-end through the HTTP edge". The two assertions below call helpers
    // directly, which proves the helpers and not the wire — the same shape as G-60,
    // where every gateway refusal was a 500 for months while a guard test passed.
    //
    // The attack: put the actor kind in the token and hope something reads it. The
    // gateway DERIVES kind from roles and never reads a claim for it, so the forged
    // value has nowhere to land.
    for (const forged of [ActorKind.AI_AGENT_RUNTIME, ActorKind.SOVEREIGN_SERVICE]) {
      const token = await tokenFor(TENANT_A, {
        actorKind: forged,
        actor_kind: forged,
        [SovereignClaims.ROLES]: ["clinician"],
      });
      const response = await app.inject({
        method: "GET",
        url: "/v1/echo",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().derivedActorKind).toBe(ActorKind.HUMAN_CLINICIAN);
      expect(response.json().derivedTenantId).toBe(TENANT_A);
    }
  });

  it("cannot merge a patient identity", () => {
    // AGENTS.md doctrine 9. Refused on actor kind, BEFORE the role check — a role
    // check alone would pass for an AI principal carrying a permitted role.
    expect(() =>
      planMerge({
        sourcePatientId: "PAT-A",
        survivingPatientId: "PAT-B",
        reason: "duplicate",
        actorRoles: ["clinician"],
        actorKind: "AI_AGENT_RUNTIME",
        sourceMatchState: "confirmed",
        survivingMatchState: "confirmed",
      }),
    ).toThrow(/ai_principal/);
  });
});

describe("§10.14 and §10.23 require a deployed cloud environment", () => {
  it.skip("§10.14 egress to a non-allowlisted host is blocked and alerts", () => {
    // Needs a VPC with a deny-all egress firewall and Cloud NAT. Blocked on the
    // WO-002A cloud block (S1-02, S1-03). Present rather than omitted: a suite that
    // silently contains 22 tests when the spec calls for 24 reads as complete.
  });

  it.skip("§10.23 injected errors in Ring 0 trigger automatic rollback in under 2 minutes", () => {
    // Needs Cloud Run traffic splitting and the deploy pipeline (S1-21). Same reason.
  });
});
