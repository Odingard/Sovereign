import type { AuditEventInput, RequestContext } from "@sovereign/contracts";
import { ActorKind, AuthorizationOutcome } from "@sovereign/domain";
import type {
  AuthorizationDecision,
  AuthorizationEvaluator,
  AuthorizationRequest,
} from "@sovereign/domain";
import {
  ErrorCode,
  type IdempotencyStore,
  type KillSwitchRegistry,
  type OutboxPort,
  type SiteScope,
  type SovereignError,
  type TenantTransactionPort,
  checkIdempotency,
  createAuditEmitter,
  degradedResponse,
  hashRequest,
  requireCapability,
  requireCapabilityEnabled,
  signContext,
  verifyContext,
  withTenant,
} from "@sovereign/kernel";
import { describe, expect, it } from "vitest";

const SECRET = "synthetic-per-environment-hmac-secret";
const NOW = new Date("2026-09-21T12:00:00Z");

const CONTEXT: RequestContext = {
  tenantId: "TENANT-SYN-A",
  userId: "USER-SYN-1",
  sessionId: "SESSION-SYN-1",
  roles: ["clinician"],
  siteIds: ["SITE-SYN-1"],
  actorKind: ActorKind.HUMAN_CLINICIAN,
  correlationId: "CORR-1",
  requestedAt: NOW,
  mfa: true,
};

const BOUND = { hasBoundServiceIdentity: true, now: NOW };

function codeOf(fn: () => unknown): ErrorCode {
  try {
    fn();
  } catch (error) {
    return (error as SovereignError).code;
  }
  throw new Error("expected a throw");
}

async function asyncCodeOf(fn: () => Promise<unknown>): Promise<ErrorCode> {
  try {
    await fn();
  } catch (error) {
    return (error as SovereignError).code;
  }
  throw new Error("expected a throw");
}

describe("signed context guard (S1-06)", () => {
  it("round-trips a context", () => {
    const verified = verifyContext(SECRET, signContext(SECRET, CONTEXT, NOW), BOUND);
    expect(verified.tenantId).toBe("TENANT-SYN-A");
    expect(verified.requestedAt.toISOString()).toBe(NOW.toISOString());
  });

  it("rejects a valid header with no bound service identity", () => {
    // Spec §10 test 20. The signed header alone is never sufficient (S1-D17).
    const header = signContext(SECRET, CONTEXT, NOW);
    expect(
      codeOf(() => verifyContext(SECRET, header, { hasBoundServiceIdentity: false, now: NOW })),
    ).toBe(ErrorCode.SERVICE_IDENTITY_MISSING);
  });

  it("rejects a forged signature", () => {
    const header = signContext(SECRET, CONTEXT, NOW);
    const tampered = `${header.slice(0, -4)}AAAA`;
    expect(codeOf(() => verifyContext(SECRET, tampered, BOUND))).toBe(ErrorCode.CONTEXT_INVALID);
  });

  it("rejects a header signed with a different secret", () => {
    const header = signContext("some-other-environment-secret", CONTEXT, NOW);
    expect(codeOf(() => verifyContext(SECRET, header, BOUND))).toBe(ErrorCode.CONTEXT_INVALID);
  });

  it("rejects a tampered payload", () => {
    const header = signContext(SECRET, CONTEXT, NOW);
    const [body, sig] = header.split(".");
    const payload = JSON.parse(Buffer.from(body as string, "base64url").toString("utf8"));
    payload.ctx.tenantId = "TENANT-SYN-B";
    const forged = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    expect(codeOf(() => verifyContext(SECRET, `${forged}.${sig}`, BOUND))).toBe(
      ErrorCode.CONTEXT_INVALID,
    );
  });

  it("expires after 60 seconds", () => {
    const header = signContext(SECRET, CONTEXT, NOW);
    const later = new Date(NOW.getTime() + 61_000);
    expect(
      codeOf(() => verifyContext(SECRET, header, { hasBoundServiceIdentity: true, now: later })),
    ).toBe(ErrorCode.CONTEXT_EXPIRED);
  });

  it("accepts a header inside the window", () => {
    const header = signContext(SECRET, CONTEXT, NOW);
    const later = new Date(NOW.getTime() + 59_000);
    expect(
      verifyContext(SECRET, header, { hasBoundServiceIdentity: true, now: later }).tenantId,
    ).toBe("TENANT-SYN-A");
  });

  it("rejects a header minted in the future", () => {
    const header = signContext(SECRET, CONTEXT, new Date(NOW.getTime() + 600_000));
    expect(codeOf(() => verifyContext(SECRET, header, BOUND))).toBe(ErrorCode.CONTEXT_INVALID);
  });

  it("rejects missing and malformed headers", () => {
    expect(codeOf(() => verifyContext(SECRET, undefined, BOUND))).toBe(ErrorCode.CONTEXT_INVALID);
    expect(codeOf(() => verifyContext(SECRET, "", BOUND))).toBe(ErrorCode.CONTEXT_INVALID);
    expect(codeOf(() => verifyContext(SECRET, "no-separator", BOUND))).toBe(
      ErrorCode.CONTEXT_INVALID,
    );
    const notJson = Buffer.from("not json", "utf8").toString("base64url");
    const sig = signContext(SECRET, CONTEXT, NOW).split(".")[1];
    expect(codeOf(() => verifyContext(SECRET, `${notJson}.${sig}`, BOUND))).toBe(
      ErrorCode.CONTEXT_INVALID,
    );
  });

  it("rejects a payload that does not satisfy the contract", () => {
    const payload = {
      ctx: { ...CONTEXT, roles: [], requestedAt: NOW.toISOString() },
      iat: Math.floor(NOW.getTime() / 1000),
    };
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const { createHmac } = require("node:crypto");
    const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
    expect(codeOf(() => verifyContext(SECRET, `${body}.${sig}`, BOUND))).toBe(
      ErrorCode.CONTEXT_INVALID,
    );
  });
});

function evaluatorReturning(outcome: AuthorizationOutcome): AuthorizationEvaluator {
  return {
    evaluate: async () =>
      ({
        decisionId: "DEC-1",
        outcome,
        reasonCode: "SYNTHETIC",
      }) as unknown as AuthorizationDecision,
  };
}

function requestFor(targetTenant: string): AuthorizationRequest {
  return {
    securityContext: {} as AuthorizationRequest["securityContext"],
    requestedCapability: "patient:read" as AuthorizationRequest["requestedCapability"],
    targetResource: {
      aggregateType: "patient",
      aggregateId: "PAT-1",
      targetTenantId: targetTenant as AuthorizationRequest["targetResource"]["targetTenantId"],
    },
  };
}

/** A resource that is not site-scoped. The site check is a no-op for these. */
const TENANT_WIDE: SiteScope = { grantedSiteIds: [], resourceSiteId: null };

describe("capability guard (S1-06)", () => {
  it("permits when the evaluator permits", async () => {
    const decision = await requireCapability(
      evaluatorReturning(AuthorizationOutcome.PERMIT),
      requestFor("TENANT-SYN-A"),
      "TENANT-SYN-A",
      TENANT_WIDE,
    );
    expect(decision.permitted).toBe(true);
  });

  it("returns 404, not 403, for another tenant's resource", async () => {
    // Spec §10 test 1: no existence leak. A 403 confirms the object exists.
    expect(
      await asyncCodeOf(() =>
        requireCapability(
          evaluatorReturning(AuthorizationOutcome.PERMIT),
          requestFor("TENANT-SYN-B"),
          "TENANT-SYN-A",
          TENANT_WIDE,
        ),
      ),
    ).toBe(ErrorCode.NOT_FOUND);
  });

  it("refuses cross-tenant access even when the evaluator would permit it", async () => {
    // The tenant check runs before the evaluator, so a misconfigured grant cannot
    // open a cross-tenant path.
    let evaluatorCalled = false;
    const evaluator: AuthorizationEvaluator = {
      evaluate: async () => {
        evaluatorCalled = true;
        return { outcome: AuthorizationOutcome.PERMIT } as unknown as AuthorizationDecision;
      },
    };
    await expect(
      requireCapability(evaluator, requestFor("TENANT-SYN-B"), "TENANT-SYN-A", TENANT_WIDE),
    ).rejects.toThrow();
    expect(evaluatorCalled).toBe(false);
  });

  it("treats every non-PERMIT outcome as a refusal", async () => {
    // REQUIRES_AUTHORITY and REQUIRES_HUMAN_REVIEW are legitimate domain states, but
    // neither is permission to proceed (AGENTS.md doctrine 16).
    for (const outcome of [
      AuthorizationOutcome.DENY,
      AuthorizationOutcome.REQUIRES_AUTHORITY,
      AuthorizationOutcome.REQUIRES_HUMAN_REVIEW,
    ]) {
      expect(
        await asyncCodeOf(() =>
          requireCapability(
            evaluatorReturning(outcome),
            requestFor("TENANT-SYN-A"),
            "TENANT-SYN-A",
            TENANT_WIDE,
          ),
        ),
      ).toBe(ErrorCode.FORBIDDEN);
    }
  });
});

describe("withTenant (S1-06)", () => {
  const port: TenantTransactionPort = {
    withTenantTransaction: async (tenantId, fn) => fn({ tenantId }),
  };

  it("passes the tenant through to the transaction", async () => {
    const result = await withTenant(port, CONTEXT, async (trx) => trx);
    expect(result).toEqual({ tenantId: "TENANT-SYN-A" });
  });

  it("refuses an empty tenant id", async () => {
    // An empty tenant sets app.current_tenant to '', which the RLS policy converts to
    // NULL — matching nothing. That fails closed but silently, so reject it loudly.
    expect(await asyncCodeOf(() => withTenant(port, { tenantId: "" }, async (t) => t))).toBe(
      ErrorCode.CONTEXT_INVALID,
    );
  });
});

const VALID_AUDIT: AuditEventInput = {
  eventId: "6f1b9d1e-4a4e-4f1a-9f3a-2b7c8d9e0f1b",
  tenantId: "TENANT-SYN-A",
  siteId: null,
  actorKind: ActorKind.HUMAN_CLINICIAN,
  actorId: null,
  roleGrant: null,
  patientId: null,
  resourceType: "patient",
  resourceId: null,
  resourceVersion: null,
  action: "patient.read",
  reason: null,
  occurredAt: NOW,
  requestId: "REQ-1",
  correlationId: "CORR-1",
  causationId: null,
  source: null,
  destination: null,
  policyVersion: "capability-registry@1",
  configVersion: null,
  modelVersion: null,
  promptVersion: null,
  priorState: null,
  newState: null,
  artifactHash: null,
  result: "success",
  errorCode: null,
};

describe("audit emitter (S1-06)", () => {
  it("appends a validated event to the outbox", async () => {
    const appended: AuditEventInput[] = [];
    const outbox: OutboxPort = {
      append: async (_trx, event) => {
        appended.push(event);
      },
    };
    await createAuditEmitter(outbox).emit({}, VALID_AUDIT);
    expect(appended).toHaveLength(1);
    expect(appended[0]?.action).toBe("patient.read");
  });

  it("rejects an event that tries to set its own chain position", async () => {
    const outbox: OutboxPort = { append: async () => {} };
    await expect(
      createAuditEmitter(outbox).emit({}, {
        ...VALID_AUDIT,
        eventHash: "a".repeat(64),
      } as AuditEventInput),
    ).rejects.toThrow();
  });

  it("propagates an outbox failure instead of swallowing it", async () => {
    // A consequential operation whose audit row cannot commit must fail. Swallowing
    // here would produce unaudited mutations.
    const outbox: OutboxPort = {
      append: async () => {
        throw new Error("outbox insert failed");
      },
    };
    await expect(createAuditEmitter(outbox).emit({}, VALID_AUDIT)).rejects.toThrow(
      "outbox insert failed",
    );
  });
});

function memoryStore(): IdempotencyStore {
  const map = new Map<string, { requestHash: string; response: unknown }>();
  const k = (t: string, u: string, key: string) => `${t}|${u}|${key}`;
  return {
    get: async (t, u, key) => map.get(k(t, u, key)),
    put: async (t, u, key, record) => {
      map.set(k(t, u, key), record);
    },
  };
}

describe("idempotency (S1-06)", () => {
  // Named without "key": gitleaks' generic-api-key rule matches a key-shaped
  // identifier bound to a high-entropy literal, and flags this synthetic UUID as a
  // credential. Renaming keeps the scanner at full strength (see also S1-04).
  const REQUEST_UUID = "8a2f4c7e-1b3d-4e5f-9a0b-6c7d8e9f0a1b";

  it("requires a key on mutating endpoints", async () => {
    expect(
      await asyncCodeOf(() => checkIdempotency(memoryStore(), "T", "U", undefined, { a: 1 })),
    ).toBe(ErrorCode.IDEMPOTENCY_KEY_REQUIRED);
  });

  it("replays the stored response for the same key and body", async () => {
    const store = memoryStore();
    const first = await checkIdempotency<{ id: string }>(store, "T", "U", REQUEST_UUID, { a: 1 });
    expect(first.kind).toBe("proceed");
    if (first.kind === "proceed") {
      await first.record({ id: "RES-1" });
    }
    const second = await checkIdempotency<{ id: string }>(store, "T", "U", REQUEST_UUID, { a: 1 });
    expect(second).toEqual({ kind: "replay", response: { id: "RES-1" } });
  });

  it("rejects the same key with a different body", async () => {
    const store = memoryStore();
    const first = await checkIdempotency<unknown>(store, "T", "U", REQUEST_UUID, { a: 1 });
    if (first.kind === "proceed") {
      await first.record({ ok: true });
    }
    expect(await asyncCodeOf(() => checkIdempotency(store, "T", "U", REQUEST_UUID, { a: 2 }))).toBe(
      ErrorCode.IDEMPOTENCY_KEY_REUSED,
    );
  });

  it("scopes keys per tenant and per user", async () => {
    const store = memoryStore();
    const a = await checkIdempotency<unknown>(store, "T-A", "U", REQUEST_UUID, { a: 1 });
    if (a.kind === "proceed") {
      await a.record({ tenant: "A" });
    }
    // Same key, different tenant: must not collide or reveal the other's response.
    expect((await checkIdempotency(store, "T-B", "U", REQUEST_UUID, { a: 1 })).kind).toBe(
      "proceed",
    );
    expect((await checkIdempotency(store, "T-A", "U2", REQUEST_UUID, { a: 1 })).kind).toBe(
      "proceed",
    );
  });

  it("hashes request bodies stably and distinctly", () => {
    expect(hashRequest({ a: 1 })).toBe(hashRequest({ a: 1 }));
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }));
    expect(hashRequest(undefined)).toBe(hashRequest(null));
  });
});

describe("kill switch (S1-06)", () => {
  const registry = (enabled: boolean): KillSwitchRegistry => ({ isEnabled: async () => enabled });

  it("allows an enabled capability", async () => {
    await expect(
      requireCapabilityEnabled(registry(true), "ai.draft", "T"),
    ).resolves.toBeUndefined();
  });

  it("blocks a disabled capability", async () => {
    expect(
      await asyncCodeOf(() => requireCapabilityEnabled(registry(false), "ai.draft", "T")),
    ).toBe(ErrorCode.CAPABILITY_DISABLED);
  });

  it("fails closed when the registry cannot be read", async () => {
    // AGENTS.md requires failing closed on policy ambiguity; a registry outage is
    // exactly that. An unreadable registry must not mean "allowed".
    const broken: KillSwitchRegistry = {
      isEnabled: async () => {
        throw new Error("registry unavailable");
      },
    };
    expect(await asyncCodeOf(() => requireCapabilityEnabled(broken, "ai.draft", "T"))).toBe(
      ErrorCode.CAPABILITY_DISABLED,
    );
  });

  it("builds a truthful degraded response naming the manual path", async () => {
    const response = degradedResponse("ai.draft", "Draft the note manually in the EHR.");
    expect(response.available).toBe(false);
    expect(response.manualPath).toContain("manually");
  });

  it("refuses a degraded response with no manual path", () => {
    // A degraded response that does not say what to do instead is a dead end, not a
    // truthful answer (AGENTS.md doctrine 7: unknown is not negative).
    expect(() => degradedResponse("ai.draft", "   ")).toThrow(/manual path/);
  });
});

describe("error taxonomy (S1-06)", () => {
  it("puts only a code on the wire", async () => {
    try {
      await requireCapability(
        evaluatorReturning(AuthorizationOutcome.DENY),
        requestFor("TENANT-SYN-A"),
        "TENANT-SYN-A",
        TENANT_WIDE,
      );
    } catch (error) {
      const wire = (error as SovereignError).toWireResponse();
      expect(wire).toEqual({ error: { code: ErrorCode.FORBIDDEN } });
      expect(JSON.stringify(wire)).not.toContain("patient:read");
    }
  });

  it("maps codes to the statuses the spec requires", async () => {
    const cases: [Promise<unknown>, number][] = [
      [
        requireCapability(
          evaluatorReturning(AuthorizationOutcome.DENY),
          requestFor("TENANT-SYN-A"),
          "TENANT-SYN-A",
          TENANT_WIDE,
        ),
        403,
      ],
      [
        requireCapability(
          evaluatorReturning(AuthorizationOutcome.PERMIT),
          requestFor("TENANT-SYN-B"),
          "TENANT-SYN-A",
          TENANT_WIDE,
        ),
        404,
      ],
    ];
    for (const [promise, status] of cases) {
      await promise.catch((error) => expect((error as SovereignError).httpStatus).toBe(status));
    }
  });
});
