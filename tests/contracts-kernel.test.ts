import {
  AUDIT_HASH_EXCLUDED_FIELDS,
  AuditEventInputSchema,
  AuditEventRecordSchema,
  LOG_FIELD_ALLOWLIST,
  LOG_FIELD_PROHIBITED,
  RequestContextSchema,
  RoleSchema,
  STAGE1_DISABLED_ROLES,
  STAGE1_MINIMUM_AUDITED_ACTIONS,
  isAllowedLogField,
  isProhibitedLogField,
} from "@sovereign/contracts";
import { ActorKind } from "@sovereign/domain";
import { describe, expect, it } from "vitest";

// Hoisted rather than inlined: gitleaks' generic-api-key rule matches a key-like
// property name followed immediately by a quoted string, so an inline idempotency-key
// assignment reads as a leaked credential. This is synthetic test data, not a secret.
// Binding both values to non-key-shaped identifiers keeps the scanner at full
// strength instead of suppressing the rule or widening .gitleaks.toml.
const SYNTHETIC_UUID = "6f1b9d1e-4a4e-4f1a-9f3a-2b7c8d9e0f1a";
const MALFORMED_UUID = "not-a-uuid";

const validContext = {
  tenantId: "TENANT-SYN-A",
  userId: "USER-SYN-1",
  sessionId: "SESSION-SYN-1",
  roles: ["clinician" as const],
  siteIds: ["SITE-SYN-1"],
  actorKind: ActorKind.HUMAN_CLINICIAN,
  correlationId: "CORR-SYN-1",
  requestedAt: new Date("2026-09-21T12:00:00Z"),
  mfa: true,
};

const validAuditInput = {
  eventId: SYNTHETIC_UUID,
  tenantId: "TENANT-SYN-A",
  actorKind: ActorKind.HUMAN_CLINICIAN,
  resourceType: "patient",
  action: "patient.read",
  occurredAt: new Date("2026-09-21T12:00:00Z"),
  requestId: "REQ-SYN-1",
  correlationId: "CORR-SYN-1",
  policyVersion: "capability-registry@1",
  result: "success" as const,
};

describe("RequestContext contract (S1-04)", () => {
  it("accepts a well-formed context", () => {
    expect(RequestContextSchema.parse(validContext).tenantId).toBe("TENANT-SYN-A");
  });

  it("rejects unknown keys so a caller cannot smuggle extra context", () => {
    // .strict() matters here: AGENTS.md doctrine 18 — the requester does not define
    // the security requirements for its own request.
    const result = RequestContextSchema.safeParse({
      ...validContext,
      isAdmin: true,
      tenant_id: "TENANT-SYN-B",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty tenantId", () => {
    expect(RequestContextSchema.safeParse({ ...validContext, tenantId: "" }).success).toBe(false);
  });

  it("requires at least one role", () => {
    expect(RequestContextSchema.safeParse({ ...validContext, roles: [] }).success).toBe(false);
  });

  it("requires idempotencyKey to be a UUID when present", () => {
    expect(
      RequestContextSchema.safeParse({ ...validContext, idempotencyKey: MALFORMED_UUID }).success,
    ).toBe(false);
    expect(
      RequestContextSchema.safeParse({
        ...validContext,
        idempotencyKey: SYNTHETIC_UUID,
      }).success,
    ).toBe(true);
  });

  it("registers the patient role but disables it for Stage 1", () => {
    expect(RoleSchema.options).toContain("patient");
    expect(STAGE1_DISABLED_ROLES).toContain("patient");
  });

  it("uses the domain ActorKind rather than a parallel enum", () => {
    // One source of truth for actor kind (ADR-0010). In particular AI_AGENT_RUNTIME
    // must remain expressible, because the evaluator denies it Class C/D authority.
    expect(RequestContextSchema.safeParse({ ...validContext, actorKind: "user" }).success).toBe(
      false,
    );
    expect(
      RequestContextSchema.safeParse({ ...validContext, actorKind: ActorKind.AI_AGENT_RUNTIME })
        .success,
    ).toBe(true);
  });
});

describe("AuditEvent contract (S1-04)", () => {
  it("accepts a well-formed emitted event and defaults optional fields to null", () => {
    const parsed = AuditEventInputSchema.parse(validAuditInput);
    expect(parsed.patientId).toBeNull();
    expect(parsed.siteId).toBeNull();
    expect(parsed.result).toBe("success");
  });

  it("refuses to let an emitter set chain position or hashes", () => {
    // The whole point of the two-schema split. If a service could set eventHash or
    // seq, it could forge its position in the tamper-evident chain (S1-D11, NFR-006).
    for (const forged of [
      { seq: 1n },
      { prevHash: "a".repeat(64) },
      { eventHash: "b".repeat(64) },
      { recordedAt: new Date() },
    ]) {
      expect(AuditEventInputSchema.safeParse({ ...validAuditInput, ...forged }).success).toBe(
        false,
      );
    }
  });

  it("accepts chain fields on the stored record", () => {
    const record = AuditEventRecordSchema.parse({
      ...validAuditInput,
      recordedAt: new Date("2026-09-21T12:00:01Z"),
      seq: 42n,
      prevHash: "a".repeat(64),
      eventHash: "b".repeat(64),
    });
    expect(record.seq).toBe(42n);
  });

  it("requires hashes to be lowercase hex sha256", () => {
    const base = {
      ...validAuditInput,
      recordedAt: new Date(),
      seq: 1n,
      prevHash: "a".repeat(64),
      eventHash: "b".repeat(64),
    };
    expect(AuditEventRecordSchema.safeParse({ ...base, eventHash: "B".repeat(64) }).success).toBe(
      false,
    );
    expect(AuditEventRecordSchema.safeParse({ ...base, eventHash: "b".repeat(63) }).success).toBe(
      false,
    );
  });

  it("rejects a non-hex artifactHash", () => {
    expect(
      AuditEventInputSchema.safeParse({ ...validAuditInput, artifactHash: "zz" }).success,
    ).toBe(false);
  });

  it("excludes derived fields from the hash preimage", () => {
    expect([...AUDIT_HASH_EXCLUDED_FIELDS].sort()).toEqual(
      ["eventHash", "prevHash", "recordedAt"].sort(),
    );
  });

  it("names the denied result as a first-class outcome", () => {
    // Denied authorization decisions are audited, not swallowed (§7.3).
    expect(AuditEventInputSchema.safeParse({ ...validAuditInput, result: "denied" }).success).toBe(
      true,
    );
    expect(STAGE1_MINIMUM_AUDITED_ACTIONS).toContain("authz.denied");
  });
});

describe("Log field allowlist (S1-04)", () => {
  it("never allows a field that is explicitly prohibited", () => {
    // The single most important assertion in this file. If these two sets ever
    // intersect, the redacting logger has a hole in it.
    const overlap = LOG_FIELD_ALLOWLIST.filter((f) => isProhibitedLogField(f));
    expect(overlap).toEqual([]);
  });

  it("prohibits patientId despite it being an internal identifier", () => {
    // A log stream keyed by patient reconstructs who was treated and when, which is
    // PHI regardless of whether a name appears. Patient linkage lives in the audit
    // chain, which is access-controlled and hash-chained. Logs are neither.
    expect(isAllowedLogField("patientId")).toBe(false);
    expect(isProhibitedLogField("patientId")).toBe(true);
  });

  it("denies unregistered fields by default", () => {
    for (const unknown of ["somethingNew", "diagnosis", "freeText", ""]) {
      expect(isAllowedLogField(unknown)).toBe(false);
    }
  });

  it("allows correlation and transport fields needed to operate the system", () => {
    for (const field of ["correlationId", "tenantId", "route", "statusCode", "errorCode"]) {
      expect(isAllowedLogField(field)).toBe(true);
    }
  });

  it("prohibits every field that could carry a credential or free text", () => {
    for (const field of ["authorization", "token", "password", "requestBody", "stack", "note"]) {
      expect(isProhibitedLogField(field)).toBe(true);
      expect(isAllowedLogField(field)).toBe(false);
    }
  });

  it("keeps both lists free of duplicates", () => {
    expect(new Set(LOG_FIELD_ALLOWLIST).size).toBe(LOG_FIELD_ALLOWLIST.length);
    expect(new Set(LOG_FIELD_PROHIBITED).size).toBe(LOG_FIELD_PROHIBITED.length);
  });
});
