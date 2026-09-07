import {
  type ActorId,
  AssertionCategory,
  AuthorityClass,
  ClinicalEvidenceAggregate,
  ClinicalIntentAggregate,
  ClinicalIntentStage,
  ClinicalStateAggregate,
  type ClinicalStateId,
  DataProvenanceOrigin,
  DataSensitivityClassification,
  EpistemicStatus,
  type EvidenceId,
  type ExecutionAttemptId,
  ExecutionGraphAggregate,
  type ExecutionGraphId,
  type ExecutionNodeId,
  ExecutionNodeState,
  ExternalAttemptState,
  GenericTherapyAccessStage,
  IntentActionCategory,
  type IntentId,
  InvariantViolationError,
  PatientIsolationError,
  type ProvenanceTemporalContext,
  TemporalPrecision,
  TenantIsolationError,
  type TherapyAccessCaseId,
  TherapyAccessStateAggregate,
  assertStrictTenantAndPatientMatch,
  createTenantPatientContext,
} from "@sovereign/domain";
import { describe, expect, it } from "vitest";

describe("Sovereign WO-001 Domain Invariant Tests", () => {
  const ctx = createTenantPatientContext("TENANT-CORP-01", "PATIENT-SYN-100");
  const clinicianActorId = "ACTOR-CLINICIAN-DR-SMITH" as ActorId;

  const validTemporal: ProvenanceTemporalContext = {
    effectiveClinicalTime: {
      precision: TemporalPrecision.EXACT,
      timestamp: new Date("2026-09-01T10:00:00Z"),
    },
    sourceRecordedTime: {
      precision: TemporalPrecision.EXACT,
      timestamp: new Date("2026-09-01T10:05:00Z"),
    },
    sovereignIngestionTime: new Date("2026-09-01T10:10:00Z"),
  };

  // Invariant 1: Unknown does not imply negative
  it("enforces Invariant 1: unknown is never negative (epistemic honesty)", () => {
    expect(EpistemicStatus.UNKNOWN).not.toBe("NEGATIVE");

    const state = ClinicalStateAggregate.create("STATE-001" as ClinicalStateId, ctx);

    // Asserting negative presence when epistemic status is UNKNOWN must throw InvariantViolationError
    expect(() => {
      state.appendAssertion({
        assertionId: "ASSERT-001",
        category: AssertionCategory.CONDITION,
        concept: { code: "M05.79", codeSystem: "ICD-10-CM", displayName: "Rheumatoid arthritis" },
        value: { kind: "PRESENCE_ABSENCE", isPresent: false },
        validity: { status: EpistemicStatus.UNKNOWN },
        effectiveTime: {
          precision: TemporalPrecision.UNKNOWN,
          reason: "No prior clinical note found",
        },
        recordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
        supportingEvidenceIds: ["EVD-001" as EvidenceId],
      });
    }).toThrow(InvariantViolationError);

    // Asserting honest UNKNOWN value when epistemic status is UNKNOWN is accepted
    const honestState = state.appendAssertion({
      assertionId: "ASSERT-002",
      category: AssertionCategory.CONDITION,
      concept: { code: "M05.79", codeSystem: "ICD-10-CM", displayName: "Rheumatoid arthritis" },
      value: { kind: "UNKNOWN", reason: "Diagnostic testing not yet performed" },
      validity: { status: EpistemicStatus.UNKNOWN },
      effectiveTime: { precision: TemporalPrecision.UNKNOWN, reason: "Pending workup" },
      recordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      supportingEvidenceIds: ["EVD-001" as EvidenceId],
    });

    expect(honestState.getAssertion("ASSERT-002")?.validity.status).toBe(EpistemicStatus.UNKNOWN);
    expect(honestState.getAssertion("ASSERT-002")?.value.kind).toBe("UNKNOWN");
  });

  // Invariant 2: Conflict remains representable
  it("enforces Invariant 2: conflict remains representable and preserves conflicting evidence", () => {
    const state = ClinicalStateAggregate.create("STATE-002" as ClinicalStateId, ctx);

    const conflictedState = state.appendAssertion({
      assertionId: "ASSERT-CONFLICT-01",
      category: AssertionCategory.LABORATORY_RESULT,
      concept: {
        code: "11580-8",
        codeSystem: "LOINC",
        displayName: "Anti-cyclic citrullinated peptide Ab",
      },
      value: { kind: "QUANTITY", quantity: { value: 65, unit: "U/mL", referenceRangeHigh: 20 } },
      validity: {
        status: EpistemicStatus.CONFLICTED,
        clinicalRationale:
          "Local laboratory assay showed positive CCP (65 U/mL) while external reference lab reported negative (<5 U/mL).",
        conflictingEvidenceIds: ["EVD-LAB-LOCAL-01", "EVD-LAB-REF-02"],
      },
      effectiveTime: { precision: TemporalPrecision.DATE_ONLY, year: 2026, month: 8, day: 25 },
      recordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      supportingEvidenceIds: ["EVD-LAB-LOCAL-01" as EvidenceId],
    });

    const assertion = conflictedState.getAssertion("ASSERT-CONFLICT-01");
    expect(assertion?.validity.status).toBe(EpistemicStatus.CONFLICTED);
    expect(assertion?.validity.conflictingEvidenceIds).toHaveLength(2);
    expect(assertion?.validity.conflictingEvidenceIds).toContain("EVD-LAB-LOCAL-01");
    expect(assertion?.validity.conflictingEvidenceIds).toContain("EVD-LAB-REF-02");
  });

  // Invariant 3: Clinical ambiguity requires human clinical decision
  it("enforces Invariant 3: clinical ambiguity requires clinical decision, never AI inference", () => {
    const evidence = ClinicalEvidenceAggregate.create(
      "EVD-NOTE-001" as EvidenceId,
      ctx,
      {
        sourceSystem: "AMBULATORY_EHR",
        sourceLocator: "encounters/20260901/note-771",
        contentSha256: "a".repeat(64),
        contentMimeType: "text/plain",
        extractionLineage: "RAW_INGESTION",
      },
      validTemporal,
      {
        sensitivity: DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI,
        origin: DataProvenanceOrigin.SYNTHETIC_SIMULATION,
      },
    );

    const assessedEvidence = evidence.appendAssessment(
      clinicianActorId,
      EpistemicStatus.REQUIRES_CLINICAL_DECISION,
      "Ambiguous reference to biologic therapy history. Cannot confirm prior TNF-inhibitor exposure without clinical chart review.",
    );

    expect(assessedEvidence.latestAssessment?.epistemicStatus).toBe(
      EpistemicStatus.REQUIRES_CLINICAL_DECISION,
    );
    expect(assessedEvidence.latestAssessment?.clinicalInterpretationSummary).toContain("Ambiguous");
  });

  // Invariant 4: Supersession preserves lineage and history
  it("enforces Invariant 4: supersession preserves lineage and historical records", () => {
    const initialIntent = ClinicalIntentAggregate.create(
      "INTENT-001" as IntentId,
      ctx,
      ClinicalIntentStage.DECIDED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "INITIATE",
        targetConcept: {
          code: "1158-9",
          codeSystem: "RxNorm",
          displayName: "Methotrexate 15mg weekly",
        },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-001" as EvidenceId],
    );

    expect(initialIntent.props.aggregateVersion).toBe(1);
    expect(initialIntent.props.stage).toBe(ClinicalIntentStage.DECIDED);

    // Supersede with updated dosage
    const supersededIntent = initialIntent.supersede(
      "INTENT-002" as IntentId,
      clinicianActorId,
      new Date("2026-09-05T12:00:00Z"),
    );

    expect(supersededIntent.props.stage).toBe(ClinicalIntentStage.SUPERSEDED);
    expect(supersededIntent.props.supersededByIntentId).toBe("INTENT-002");
    expect(supersededIntent.props.aggregateVersion).toBe(2);
    expect(supersededIntent.props.temporal.supersessionTime).toBeDefined();

    // Re-superseding an already superseded intent must fail
    expect(() => {
      supersededIntent.supersede("INTENT-003" as IntentId, clinicianActorId);
    }).toThrow(InvariantViolationError);
  });

  // Invariant 5: Cross-tenant linkage fails closed
  it("enforces Invariant 5: cross-tenant linkage fails closed with TenantIsolationError", () => {
    const tenantA = createTenantPatientContext("TENANT-HOSPITAL-ALPHA", "PATIENT-001");
    const tenantB = createTenantPatientContext("TENANT-CLINIC-BETA", "PATIENT-001");

    expect(() => {
      assertStrictTenantAndPatientMatch(tenantA, tenantB, "ClinicalEvidence");
    }).toThrow(TenantIsolationError);
  });

  // Invariant 6: Cross-patient linkage fails closed
  it("enforces Invariant 6: cross-patient linkage fails closed with PatientIsolationError", () => {
    const patient1 = createTenantPatientContext("TENANT-HOSPITAL-ALPHA", "PATIENT-001");
    const patient2 = createTenantPatientContext("TENANT-HOSPITAL-ALPHA", "PATIENT-002");

    expect(() => {
      assertStrictTenantAndPatientMatch(patient1, patient2, "ClinicalIntent");
    }).toThrow(PatientIsolationError);
  });

  // Invariant 7: Complete 12-state intent lifecycle
  it("enforces Invariant 7: complete 12-state lifecycle and valid/invalid transitions", () => {
    const intent = ClinicalIntentAggregate.create(
      "INTENT-LIFECYCLE-01" as IntentId,
      ctx,
      ClinicalIntentStage.DISCUSSED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "CONSIDER",
        targetConcept: {
          code: "adalimumab-40mg",
          codeSystem: "RxNorm",
          displayName: "Adalimumab 40mg",
        },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-001" as EvidenceId],
    );

    // Discussion is not eligible for execution planning
    expect(intent.isEligibleForExecutionPlanning()).toBe(false);

    // DISCUSSED directly to AUTHORIZED must fail
    expect(() => {
      intent.transitionStage(ClinicalIntentStage.AUTHORIZED, clinicianActorId);
    }).toThrow(InvariantViolationError);

    // Step-by-step valid transitions
    const considered = intent.transitionStage(ClinicalIntentStage.CONSIDERED, clinicianActorId);
    expect(considered.props.stage).toBe(ClinicalIntentStage.CONSIDERED);
    expect(considered.isEligibleForExecutionPlanning()).toBe(false);

    const recommended = considered.transitionStage(
      ClinicalIntentStage.RECOMMENDED,
      clinicianActorId,
    );
    expect(recommended.props.stage).toBe(ClinicalIntentStage.RECOMMENDED);
    expect(recommended.isEligibleForExecutionPlanning()).toBe(false);

    const decided = recommended.transitionStage(ClinicalIntentStage.DECIDED, clinicianActorId);
    expect(decided.props.stage).toBe(ClinicalIntentStage.DECIDED);
    // DECIDED intent is eligible for execution planning (graph construction), but does NOT grant transaction authority
    expect(decided.isEligibleForExecutionPlanning()).toBe(true);

    const ordered = decided.transitionStage(ClinicalIntentStage.ORDERED, clinicianActorId);
    expect(ordered.props.stage).toBe(ClinicalIntentStage.ORDERED);
    expect(ordered.isEligibleForExecutionPlanning()).toBe(true);

    const authorized = ordered.transitionStage(
      ClinicalIntentStage.AUTHORIZED,
      clinicianActorId,
      "AUTH-REF-9988",
    );
    expect(authorized.props.stage).toBe(ClinicalIntentStage.AUTHORIZED);
    expect(authorized.props.authorityReference).toBe("AUTH-REF-9988");
    expect(authorized.isEligibleForExecutionPlanning()).toBe(true);

    // From AUTHORIZED to CANCELLED is allowed
    const cancelled = authorized.transitionStage(ClinicalIntentStage.CANCELLED, clinicianActorId);
    expect(cancelled.props.stage).toBe(ClinicalIntentStage.CANCELLED);

    // Cancelled is terminal and cannot transition back to active
    expect(() => {
      cancelled.transitionStage(ClinicalIntentStage.AUTHORIZED, clinicianActorId);
    }).toThrow(InvariantViolationError);
  });

  // Invariant 8: Execution Graph requires traceable intent and valid DAG
  it("enforces Invariant 8: execution graph requires traceable intent and forbids self-cycles", () => {
    // Cannot create graph without traceable intent IDs
    expect(() => {
      ExecutionGraphAggregate.create("GRAPH-001" as ExecutionGraphId, ctx, []);
    }).toThrow(InvariantViolationError);

    const graph = ExecutionGraphAggregate.create("GRAPH-001" as ExecutionGraphId, ctx, [
      "INTENT-001" as IntentId,
    ]);
    expect(graph.props.traceableIntentIds).toContain("INTENT-001");

    // Self-dependency cycle throws InvariantViolationError
    expect(() => {
      graph.addNode({
        nodeId: "NODE-001" as ExecutionNodeId,
        nodeType: "TRANSMIT_PA_PACKET",
        state: ExecutionNodeState.READY,
        requiredDependencies: ["NODE-001" as ExecutionNodeId],
        attempts: [],
      });
    }).toThrow(InvariantViolationError);
  });

  // Invariant 9: External attempt does NOT complete execution node
  it("enforces Invariant 9: external execution attempt does not complete node without confirmation", () => {
    let graph = ExecutionGraphAggregate.create("GRAPH-002" as ExecutionGraphId, ctx, [
      "INTENT-001" as IntentId,
    ]);
    graph = graph.addNode({
      nodeId: "NODE-PA-SUBMIT" as ExecutionNodeId,
      nodeType: "SUBMIT_PRIOR_AUTH",
      state: ExecutionNodeState.READY,
      requiredDependencies: [],
      attempts: [],
    });

    // Record an external attempt that was accepted by payer gateway
    graph = graph.recordAttempt("NODE-PA-SUBMIT" as ExecutionNodeId, {
      attemptId: "ATTEMPT-001" as ExecutionAttemptId,
      attemptedAt: new Date(),
      state: ExternalAttemptState.ACCEPTED,
      externalTransactionId: "PAYER-TX-998811",
    });

    const nodeAfterAttempt = graph.getNode("NODE-PA-SUBMIT" as ExecutionNodeId);
    // Invariant: Node is IN_PROGRESS, NOT COMPLETED!
    expect(nodeAfterAttempt?.state).toBe(ExecutionNodeState.IN_PROGRESS);
    expect(nodeAfterAttempt?.state).not.toBe(ExecutionNodeState.COMPLETED);

    // Completion strictly requires structured CompletionConfirmation
    graph = graph.completeNode("NODE-PA-SUBMIT" as ExecutionNodeId, {
      confirmationId: "CONF-001" as any,
      confirmedAt: new Date(),
      externalReferenceId: "PAYER-AUTH-APPROVAL-12345",
      verifyingEvidenceId: "EVD-PAYER-LETTER-001" as EvidenceId,
      verifyingArtifactHash: "b".repeat(64),
    });

    const completedNode = graph.getNode("NODE-PA-SUBMIT" as ExecutionNodeId);
    expect(completedNode?.state).toBe(ExecutionNodeState.COMPLETED);
    expect(completedNode?.completionConfirmation?.externalReferenceId).toBe(
      "PAYER-AUTH-APPROVAL-12345",
    );
    expect(completedNode?.completionConfirmation?.verifyingEvidenceId).toBe("EVD-PAYER-LETTER-001");
  });

  // Invariant 10: Domain runs without credentials
  it("enforces Invariant 10: domain runs completely in-memory with zero credentials", () => {
    // Create all 5 aggregates in memory without touching any external service or reading any credential
    const evidence = ClinicalEvidenceAggregate.create(
      "EVD-MEM-01" as EvidenceId,
      ctx,
      {
        sourceSystem: "SYNTHETIC_SIM",
        sourceLocator: "loc://synth/01",
        contentSha256: "c".repeat(64),
        contentMimeType: "application/json",
        extractionLineage: "SYNTHETIC_GENERATION",
      },
      validTemporal,
      {
        sensitivity: DataSensitivityClassification.DEIDENTIFIED_CLINICAL,
        origin: DataProvenanceOrigin.SYNTHETIC_SIMULATION,
      },
    );

    const state = ClinicalStateAggregate.create("STATE-MEM-01" as ClinicalStateId, ctx);
    const intent = ClinicalIntentAggregate.create(
      "INTENT-MEM-01" as IntentId,
      ctx,
      ClinicalIntentStage.AUTHORIZED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "PRESCRIBE",
        targetConcept: { code: "905148", codeSystem: "RxNorm", displayName: "Infliximab 100mg IV" },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      [evidence.props.evidenceId],
    );

    const graph = ExecutionGraphAggregate.create("GRAPH-MEM-01" as ExecutionGraphId, ctx, [
      intent.props.intentId,
    ]);
    const therapyAccess = TherapyAccessStateAggregate.create(
      "CASE-MEM-01" as TherapyAccessCaseId,
      ctx,
      [intent.props.intentId],
      validTemporal,
      [graph.props.graphId],
    );

    expect(evidence.props.evidenceId).toBe("EVD-MEM-01");
    expect(state.props.stateId).toBe("STATE-MEM-01");
    expect(intent.props.intentId).toBe("INTENT-MEM-01");
    expect(graph.props.graphId).toBe("GRAPH-MEM-01");
    expect(therapyAccess.props.caseId).toBe("CASE-MEM-01");
    expect(therapyAccess.props.stage).toBe(GenericTherapyAccessStage.CASE_INITIATED);
  });
});
