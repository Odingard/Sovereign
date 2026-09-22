import {
  BACKOFF_INITIAL_MS,
  BACKOFF_MAX_MS,
  DEAD_LETTER_AFTER_MS,
  NEVER_EXPORTED_FIELDS,
  backoffMs,
  ecsCategory,
  ecsOutcome,
  nextDeliveryDecision,
  shouldDisableExport,
  shouldRetry,
  signPayload,
  toEcs,
  verifySignature,
} from "@sovereign/adapter-siem-export";
import type { AuditEventInput } from "@sovereign/contracts";
import { ActorKind } from "@sovereign/domain";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-09-22T12:00:00Z");

const EVENT: AuditEventInput = {
  eventId: "6f1b9d1e-4a4e-4f1a-9f3a-2b7c8d9e0f1c",
  tenantId: "TENANT-SYN-A",
  siteId: "SITE-1",
  actorKind: ActorKind.HUMAN_CLINICIAN,
  actorId: "ACTOR-1",
  roleGrant: "GRANT-1",
  patientId: "PAT-SENSITIVE-1",
  resourceType: "patient",
  resourceId: "RES-SENSITIVE-1",
  resourceVersion: "3",
  action: "patient.read",
  reason: "Reviewing chart before infusion appointment",
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
  priorState: { demographics: "sensitive prior state" },
  newState: { demographics: "sensitive new state" },
  artifactHash: "a".repeat(64),
  result: "success",
  errorCode: null,
};

describe("ECS mapping (S1-17)", () => {
  it("emits the ECS fields a SIEM expects", () => {
    const ecs = toEcs(EVENT);
    expect(ecs["@timestamp"]).toBe(NOW.toISOString());
    expect(ecs["event.action"]).toBe("patient.read");
    expect(ecs["event.category"]).toBe("database");
    expect(ecs["event.outcome"]).toBe("success");
    expect(ecs["organization.id"]).toBe("TENANT-SYN-A");
    expect(ecs["trace.id"]).toBe("CORR-1");
    expect(ecs["service.name"]).toBe("sovereign");
  });

  it("excludes PHI by default", () => {
    const serialized = JSON.stringify(toEcs(EVENT));
    expect(serialized).not.toContain("PAT-SENSITIVE-1");
    expect(serialized).not.toContain("RES-SENSITIVE-1");
  });

  it("includes identifiers only when the tenant has opted in", () => {
    const ecs = toEcs(EVENT, { includePhi: true });
    expect(ecs["sovereign.patient_id"]).toBe("PAT-SENSITIVE-1");
    expect(ecs["sovereign.resource_id"]).toBe("RES-SENSITIVE-1");
  });

  it("never exports state, reason or hashes even with PHI enabled", () => {
    // These can carry clinical content. include_phi widens the identifier set; it
    // does not open the event body.
    const serialized = JSON.stringify(toEcs(EVENT, { includePhi: true }));
    expect(serialized).not.toContain("sensitive prior state");
    expect(serialized).not.toContain("sensitive new state");
    expect(serialized).not.toContain("infusion appointment");
    expect(serialized).not.toContain("a".repeat(64));
    for (const field of NEVER_EXPORTED_FIELDS) {
      expect(serialized).not.toContain(field);
    }
  });

  it("emits only named fields, so a new audit field cannot leak silently", () => {
    // Allowlist by construction: nothing is copied wholesale from the source event.
    const withNewField = { ...EVENT, someFutureField: "must not appear" } as AuditEventInput;
    expect(JSON.stringify(toEcs(withNewField, { includePhi: true }))).not.toContain(
      "must not appear",
    );
  });

  it("maps a denial to failure, not unknown", () => {
    // A denial is a definite outcome. Mapping it to "unknown" would hide exactly the
    // events a security team most wants to alert on.
    expect(ecsOutcome("denied")).toBe("failure");
    expect(ecsOutcome("error")).toBe("failure");
    expect(ecsOutcome("success")).toBe("success");
  });

  it("categorises the action namespaces", () => {
    expect(ecsCategory("auth.login.success")).toBe("authentication");
    expect(ecsCategory("authz.denied")).toBe("iam");
    expect(ecsCategory("grant.created")).toBe("iam");
    expect(ecsCategory("patient.merged")).toBe("database");
    expect(ecsCategory("killswitch.changed")).toBe("configuration");
  });

  it("keeps an unrecognised action rather than dropping it", () => {
    // An unfamiliar category is still an event a security team should see. Silently
    // discarding it creates a gap neither side notices.
    expect(ecsCategory("something.new")).toBe("process");
    expect(toEcs({ ...EVENT, action: "something.new" })["event.action"]).toBe("something.new");
  });

  it("omits absent optional fields rather than emitting nulls", () => {
    const ecs = toEcs({ ...EVENT, actorId: null, siteId: null, errorCode: null });
    expect(ecs["user.id"]).toBeUndefined();
    expect(ecs["sovereign.site_id"]).toBeUndefined();
    expect(ecs["error.code"]).toBeUndefined();
  });

  it("carries chain sequence when supplied", () => {
    expect(toEcs(EVENT, { sequence: 42n })["event.sequence"]).toBe("42");
  });
});

describe("delivery signing (S1-17)", () => {
  const SECRET = "synthetic-per-tenant-siem-secret";

  it("round-trips a signature", () => {
    const body = JSON.stringify(toEcs(EVENT));
    expect(verifySignature(SECRET, body, NOW, signPayload(SECRET, body, NOW))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = signPayload(SECRET, "original", NOW);
    expect(verifySignature(SECRET, "tampered", NOW, signature)).toBe(false);
  });

  it("covers the timestamp, so a capture cannot be replayed forever", () => {
    // Signing the body alone lets an attacker replay one delivery indefinitely.
    const signature = signPayload(SECRET, "body", NOW);
    const later = new Date(NOW.getTime() + 3_600_000);
    expect(verifySignature(SECRET, "body", later, signature)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const signature = signPayload("other-tenant-secret", "body", NOW);
    expect(verifySignature(SECRET, "body", NOW, signature)).toBe(false);
  });

  it("rejects a malformed signature without throwing", () => {
    expect(verifySignature(SECRET, "body", NOW, "short")).toBe(false);
  });
});

describe("backoff and dead-lettering (S1-17)", () => {
  it("starts at one minute and doubles", () => {
    expect(backoffMs(1)).toBe(BACKOFF_INITIAL_MS);
    expect(backoffMs(2)).toBe(120_000);
    expect(backoffMs(3)).toBe(240_000);
  });

  it("caps at one hour", () => {
    expect(backoffMs(20)).toBe(BACKOFF_MAX_MS);
  });

  it("retries for 24 hours then dead-letters", () => {
    const firstFailed = new Date("2026-09-22T00:00:00Z");
    expect(shouldRetry(firstFailed, new Date("2026-09-22T23:00:00Z"))).toBe(true);
    expect(shouldRetry(firstFailed, new Date("2026-09-23T01:00:00Z"))).toBe(false);
  });

  it("bounds the retry window by elapsed time, not attempt count", () => {
    // With a one-hour ceiling an attempt-count bound would mean wildly different real
    // durations. "We tried for 24 hours" is what a tenant needs to hear.
    const attempt = { eventId: "E1", attempt: 50, firstFailedAt: new Date(NOW.getTime() - 1000) };
    expect(nextDeliveryDecision(attempt, NOW).kind).toBe("retry");
  });

  it("dead-letters once the window is exhausted", () => {
    const attempt = {
      eventId: "E1",
      attempt: 3,
      firstFailedAt: new Date(NOW.getTime() - DEAD_LETTER_AFTER_MS - 1000),
    };
    const decision = nextDeliveryDecision(attempt, NOW);
    expect(decision).toEqual({ kind: "dead_letter", reason: "retry_window_exhausted" });
  });

  it("disables an export that fails persistently", () => {
    // Events are not lost — they dead-letter — but hammering a broken endpoint turns
    // one tenant's misconfiguration into load on everyone.
    expect(shouldDisableExport(99)).toBe(false);
    expect(shouldDisableExport(100)).toBe(true);
  });
});
