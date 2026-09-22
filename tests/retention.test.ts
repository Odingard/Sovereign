import { readFileSync } from "node:fs";
import {
  ErasureRefusedError,
  type LegalHold,
  RETENTION_RULES,
  type RetentionClass,
  blockingHolds,
  erasureMethodFor,
  isPastRetention,
  issueDestructionCertificate,
  mayRowDelete,
  planErasure,
} from "@sovereign/service-retention";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const NOW = new Date("2026-09-22T00:00:00Z");

const baseRequest = {
  requestId: "ERA-1",
  tenantId: "TENANT-SYN-A",
  scope: "tenant" as const,
  subjectId: null,
  reason: "Contract terminated 2026-08-01",
  requestedBy: "ACTOR-1",
  approvedBy: "ACTOR-2",
  contractTerminationVerified: true,
};

const activeTenantHold: LegalHold = {
  holdId: "HOLD-1",
  scope: "tenant",
  subjectId: null,
  reason: "Litigation hold, matter 2026-114",
  releasedAt: null,
};

describe("retention rules (S1-16)", () => {
  it("agrees with config/retention.yaml", () => {
    // The YAML is the reviewable source of truth for humans; this module is what the
    // code reads. Drift must break the build rather than quietly change how long
    // clinical data is kept.
    const yaml = parse(readFileSync("config/retention.yaml", "utf8")) as {
      classes: Record<string, { retain_days: number; erasure: string; minimum: boolean }>;
    };
    for (const [name, rule] of Object.entries(RETENTION_RULES)) {
      const fromYaml = yaml.classes[name];
      expect(fromYaml, `${name} missing from retention.yaml`).toBeDefined();
      expect(rule.retainDays, `${name} retainDays`).toBe(fromYaml?.retain_days);
      expect(rule.erasure, `${name} erasure`).toBe(fromYaml?.erasure);
      expect(rule.minimum, `${name} minimum`).toBe(fromYaml?.minimum);
    }
    expect(Object.keys(yaml.classes).sort()).toEqual(Object.keys(RETENTION_RULES).sort());
  });

  it("keeps clinical data for ten years and audit for seven", () => {
    expect(RETENTION_RULES.legal_clinical.retainDays).toBe(3650);
    expect(RETENTION_RULES.audit.retainDays).toBe(2555);
  });

  it("marks legal minimums as minimums", () => {
    expect(RETENTION_RULES.legal_clinical.minimum).toBe(true);
    expect(RETENTION_RULES.audit.minimum).toBe(true);
    expect(RETENTION_RULES.operational.minimum).toBe(false);
  });

  it("never permits row deletion of clinical or audit data", () => {
    // Deleting one audit event breaks hash verification for every event after it —
    // the record would be destroyed along with the data.
    expect(mayRowDelete("audit")).toBe(false);
    expect(mayRowDelete("legal_clinical")).toBe(false);
    expect(mayRowDelete("operational")).toBe(true);
  });

  it("crypto-shreds clinical and audit data rather than purging it", () => {
    expect(erasureMethodFor("legal_clinical")).toBe("crypto_shred");
    expect(erasureMethodFor("audit")).toBe("crypto_shred");
    expect(erasureMethodFor("operational")).toBe("purge");
  });

  it("reports expiry without implying deletion is required", () => {
    // A ten-year minimum is a floor. Nothing obliges destruction the instant it
    // expires, and a job that did so would destroy data a clinician may still need.
    const old = new Date("2010-01-01T00:00:00Z");
    expect(isPastRetention("legal_clinical", old, NOW)).toBe(true);
    expect(mayRowDelete("legal_clinical")).toBe(false);
  });

  it("does not expire data inside its window", () => {
    expect(isPastRetention("operational", new Date("2026-09-10T00:00:00Z"), NOW)).toBe(false);
    expect(isPastRetention("operational", new Date("2026-07-01T00:00:00Z"), NOW)).toBe(true);
  });

  it("covers every class named in the schedule", () => {
    const expected: RetentionClass[] = [
      "analytics",
      "audit",
      "generated_draft",
      "legal_clinical",
      "operational",
      "recording",
      "support",
      "synthetic",
    ];
    expect(Object.keys(RETENTION_RULES).sort()).toEqual(expected);
  });
});

describe("legal hold (S1-16)", () => {
  it("blocks an erasure outright", () => {
    expect(() => planErasure(baseRequest, [activeTenantHold])).toThrow(ErasureRefusedError);
  });

  it("checks the hold before approval, so two approvals cannot override it", () => {
    // Order matters. An approved erasure that runs under a hold is a spoliation
    // problem, not a bug — it cannot be undone.
    try {
      planErasure({ ...baseRequest, approvedBy: null }, [activeTenantHold]);
    } catch (error) {
      // Refused for the hold, NOT for the missing approver.
      expect((error as ErasureRefusedError).refusal).toBe("legal_hold_active");
    }
  });

  it("ignores a released hold", () => {
    const released: LegalHold = { ...activeTenantHold, releasedAt: new Date("2026-09-01") };
    expect(planErasure(baseRequest, [released]).action).toBe("destroy_key_version");
  });

  it("lets a tenant hold block a single-patient erasure", () => {
    // A hold over an entire tenant must not be circumvented by erasing its patients
    // one at a time.
    const patientErasure = { ...baseRequest, scope: "patient" as const, subjectId: "PAT-1" };
    expect(blockingHolds(patientErasure, [activeTenantHold])).toHaveLength(1);
  });

  it("scopes a patient hold to that patient only", () => {
    const patientHold: LegalHold = {
      holdId: "HOLD-2",
      scope: "patient",
      subjectId: "PAT-1",
      reason: "Subject access request",
      releasedAt: null,
    };
    expect(blockingHolds({ scope: "patient", subjectId: "PAT-1" }, [patientHold])).toHaveLength(1);
    expect(blockingHolds({ scope: "patient", subjectId: "PAT-2" }, [patientHold])).toHaveLength(0);
  });
});

describe("erasure authorisation (S1-16)", () => {
  it("requires a second approver", () => {
    expect(() => planErasure({ ...baseRequest, approvedBy: null }, [])).toThrow(
      ErasureRefusedError,
    );
  });

  it("refuses self-approval", () => {
    expect(() => planErasure({ ...baseRequest, approvedBy: "ACTOR-1" }, [])).toThrow(
      ErasureRefusedError,
    );
  });

  it("requires verified contract termination for a tenant erasure", () => {
    expect(() => planErasure({ ...baseRequest, contractTerminationVerified: false }, [])).toThrow(
      ErasureRefusedError,
    );
  });

  it("does not require contract termination for a single patient", () => {
    const plan = planErasure(
      {
        ...baseRequest,
        scope: "patient",
        subjectId: "PAT-1",
        contractTerminationVerified: false,
      },
      [],
    );
    expect(plan.auditAction).toBe("patient.erased");
  });

  it("requires a reason", () => {
    expect(() => planErasure({ ...baseRequest, reason: "   " }, [])).toThrow(ErasureRefusedError);
  });

  it("crypto-shreds and tombstones rather than deleting", () => {
    const plan = planErasure(baseRequest, []);
    expect(plan.action).toBe("destroy_key_version");
    expect(plan.tombstoneRetains).toEqual(["identifiers", "hashes"]);
  });
});

describe("certificate of destruction (S1-16)", () => {
  it("names both the requester and the approver", () => {
    // A certificate recording only "erased" proves nothing about who authorised it,
    // and that is the question asked afterwards.
    const plan = planErasure(baseRequest, []);
    const cert = issueDestructionCertificate(plan, 3, "ACTOR-1", "ACTOR-2", NOW);
    expect(cert.requestedBy).toBe("ACTOR-1");
    expect(cert.approvedBy).toBe("ACTOR-2");
    expect(cert.destroyedKeyVersion).toBe(3);
  });

  it("is hashed over its own content so it cannot be altered afterwards", () => {
    const plan = planErasure(baseRequest, []);
    const a = issueDestructionCertificate(plan, 3, "ACTOR-1", "ACTOR-2", NOW);
    const b = issueDestructionCertificate(plan, 3, "ACTOR-1", "ACTOR-2", NOW);
    const different = issueDestructionCertificate(plan, 4, "ACTOR-1", "ACTOR-2", NOW);
    expect(a.certificateHash).toBe(b.certificateHash);
    expect(a.certificateHash).not.toBe(different.certificateHash);
    expect(a.certificateHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
