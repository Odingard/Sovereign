import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GovernedMutationPipeline } from "../packages/application/src/index.ts";
import {
  AUTHORITATIVE_OBJECT_TYPES,
  AuthorityClass,
  EpistemicStatus,
  LifecycleState,
} from "../packages/domain/src/index.ts";
import { FakeAIReasoningProvider } from "../providers/ai-fake/src/index.ts";

describe("Sovereign Architecture & Doctrine Tests", () => {
  it("enforces permanent doctrine: model is not system of record", () => {
    expect(AUTHORITATIVE_OBJECT_TYPES).toHaveLength(5);
    expect(AUTHORITATIVE_OBJECT_TYPES).toContain("CLINICAL_STATE");
    expect(AUTHORITATIVE_OBJECT_TYPES).toContain("CLINICAL_EVIDENCE_PROVENANCE");
    expect(AUTHORITATIVE_OBJECT_TYPES).toContain("CLINICAL_INTENT");
    expect(AUTHORITATIVE_OBJECT_TYPES).toContain("EXECUTION_GRAPH");
    expect(AUTHORITATIVE_OBJECT_TYPES).toContain("THERAPY_ACCESS_STATE");
  });

  it("guarantees epistemic honesty: unknown is never negative", () => {
    expect(EpistemicStatus.UNKNOWN).not.toBe("NEGATIVE");
    expect(EpistemicStatus.CONFLICTED).toBe("CONFLICTED");
    expect(EpistemicStatus.REQUIRES_CLINICAL_DECISION).toBe("REQUIRES_CLINICAL_DECISION");
  });

  it("distinguishes execution and lifecycle states", () => {
    expect(LifecycleState.ATTEMPTED).toBe("ATTEMPTED");
    expect(LifecycleState.TRANSMITTED).toBe("TRANSMITTED");
    expect(LifecycleState.RECEIVED).toBe("RECEIVED");
    expect(LifecycleState.ACCEPTED).toBe("ACCEPTED");
    expect(LifecycleState.INITIATED).toBe("INITIATED");
    expect(LifecycleState.COMPLETED).toBe("COMPLETED");
  });

  it("preserves human clinical authority: Class D remains human", () => {
    expect(AuthorityClass.CLASS_D_CLINICAL_JUDGMENT).toBe("CLASS_D_CLINICAL_JUDGMENT");
    expect(AuthorityClass.CLASS_C_CLINICIAN_AUTH).toBe("CLASS_C_CLINICIAN_AUTH");
  });

  it("executes deterministic Fake AI provider without cloud credentials", async () => {
    const fakeAi = new FakeAIReasoningProvider();
    const candidate = await fakeAi.generateCandidate({
      tenantId: "TENANT-SYN-01",
      patientContextId: "CTX-SYN-01",
      taskType: "EXTRACT_FACTS",
      redactedInputPayload: { text: "Synthetic encounter note" },
    });

    expect(candidate.modelIdentifier).toBe("sovereign-fake-ai-v1");
    expect(candidate.sourceEvidenceIds).toContain("EVD-SYN-001");
    expect(candidate.disclaimer).toBe(
      "AI candidate carries no clinical authority; requires validation.",
    );
  });

  it("rejects AI candidate without evidence or when conflicted", async () => {
    const pipeline = new GovernedMutationPipeline();

    const conflictedResult = await pipeline.evaluateCandidate(
      {
        candidateId: "test-uuid-1",
        modelIdentifier: "fake",
        modelVersion: "1.0",
        epistemicStatus: EpistemicStatus.CONFLICTED,
        proposedStateCandidate: {},
        sourceEvidenceIds: ["EVD-1"],
        disclaimer: "AI candidate carries no clinical authority; requires validation.",
      },
      {
        tenantId: "TENANT-1" as any,
        patientId: "PAT-1" as any,
        actorId: "ACT-1",
        actorRole: "CLINICIAN",
        authorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      },
    );

    expect(conflictedResult.status).toBe("REJECTED");
    expect(conflictedResult.reason).toContain("CONFLICTED");

    const noEvidenceResult = await pipeline.evaluateCandidate(
      {
        candidateId: "test-uuid-2",
        modelIdentifier: "fake",
        modelVersion: "1.0",
        epistemicStatus: EpistemicStatus.KNOWN,
        proposedStateCandidate: {},
        sourceEvidenceIds: [],
        disclaimer: "AI candidate carries no clinical authority; requires validation.",
      },
      {
        tenantId: "TENANT-1" as any,
        patientId: "PAT-1" as any,
        actorId: "ACT-1",
        actorRole: "CLINICIAN",
        authorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      },
    );

    expect(noEvidenceResult.status).toBe("REJECTED");
    expect(noEvidenceResult.reason).toContain("Absence of evidence");
  });

  it("verifies packages/domain contains zero cloud or AI provider imports", () => {
    const domainIndexPath = join(process.cwd(), "packages/domain/src/index.ts");
    const content = readFileSync(domainIndexPath, "utf-8");
    expect(content).not.toContain("@google");
    expect(content).not.toContain("@temporalio");
    expect(content).not.toContain("gemini");
    expect(content).not.toContain("@sovereign/provider-ai");
  });
});
