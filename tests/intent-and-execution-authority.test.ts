import {
  type ActorId,
  AuthorityClass,
  ClinicalIntentAggregate,
  ClinicalIntentStage,
  DataProvenanceOrigin,
  DataSensitivityClassification,
  type EvidenceId,
  type ExecutionAttemptId,
  ExecutionGraphAggregate,
  type ExecutionGraphId,
  type ExecutionNodeId,
  ExecutionNodeState,
  ExternalAttemptState,
  IntentActionCategory,
  type IntentId,
  InvariantViolationError,
  PatientIsolationError,
  type ProvenanceTemporalContext,
  TemporalPrecision,
  TenantIsolationError,
  assertStrictTenantAndPatientMatch,
  createTenantPatientContext,
} from "@sovereign/domain";
import { describe, expect, it } from "vitest";

describe("Sovereign Clinical Intent vs. Execution Authority Boundaries", () => {
  const ctxTenantA = createTenantPatientContext("TENANT-HEALTH-01", "PATIENT-SYN-100");
  const ctxTenantB = createTenantPatientContext("TENANT-HEALTH-02", "PATIENT-SYN-100");
  const ctxPatient2 = createTenantPatientContext("TENANT-HEALTH-01", "PATIENT-SYN-200");
  const clinicianActorId = "ACTOR-CLINICIAN-001" as ActorId;

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

  // Test A: DECIDED can create work without granting transaction authority
  it("Scenario A: DECIDED intent allows graph construction and preparatory work without granting transaction authority", () => {
    // 1. Clinician reaches DECIDED stage
    const decidedIntent = ClinicalIntentAggregate.create(
      "INTENT-DECIDED-01" as IntentId,
      ctxTenantA,
      ClinicalIntentStage.DECIDED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "INITIATE",
        targetConcept: { code: "905148", codeSystem: "RxNorm", displayName: "Infliximab 100mg IV" },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-01" as EvidenceId],
    );

    // Intent is eligible for execution planning
    expect(decidedIntent.isEligibleForExecutionPlanning()).toBe(true);

    // 2. Execution Graph is legitimately created from DECIDED intent
    let graph = ExecutionGraphAggregate.create("GRAPH-DECIDED-01" as ExecutionGraphId, ctxTenantA, [
      decidedIntent.props.intentId,
    ]);

    // 3. Preparatory administrative work (Class A) proceeds
    graph = graph.addNode({
      nodeId: "NODE-PREP-PA" as ExecutionNodeId,
      actionType: "GATHER_PRIOR_AUTH_REQUISITES",
      authorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiredDependencies: [],
      state: ExecutionNodeState.READY_FOR_EXECUTION,
      attempts: [],
    });

    // 4. Clinical external transaction (Class C) remains BLOCKED / AWAITING_AUTHORITY
    graph = graph.addNode({
      nodeId: "NODE-TX-SUBMIT-ORDER" as ExecutionNodeId,
      actionType: "TRANSMIT_SPECIALTY_RX_ORDER",
      authorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiredDependencies: ["NODE-PREP-PA" as ExecutionNodeId],
      state: ExecutionNodeState.AWAITING_AUTHORITY, // Waiting on transaction authority
      attempts: [],
    });

    const prepNode = graph.getNode("NODE-PREP-PA" as ExecutionNodeId);
    const txNode = graph.getNode("NODE-TX-SUBMIT-ORDER" as ExecutionNodeId);

    expect(prepNode?.state).toBe(ExecutionNodeState.READY_FOR_EXECUTION);
    expect(txNode?.state).toBe(ExecutionNodeState.AWAITING_AUTHORITY);

    // INVARIANT: Transaction node CANNOT execute solely because the intent is DECIDED
    expect(txNode?.state).not.toBe(ExecutionNodeState.READY_FOR_EXECUTION);
    expect(txNode?.authorityGrantReference).toBeUndefined();
  });

  // Test B: ORDERED does not bypass policy/authority
  it("Scenario B: ORDERED stage alone does not constitute unrestricted execution authority", () => {
    const orderedIntent = ClinicalIntentAggregate.create(
      "INTENT-ORDERED-01" as IntentId,
      ctxTenantA,
      ClinicalIntentStage.ORDERED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "ORDER",
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
      ["EVD-01" as EvidenceId],
    );

    expect(orderedIntent.props.stage).toBe(ClinicalIntentStage.ORDERED);
    expect(orderedIntent.props.authorityReference).toBeUndefined();

    // Node in graph requires policy and authority verification before execution
    let graph = ExecutionGraphAggregate.create("GRAPH-ORDERED-01" as ExecutionGraphId, ctxTenantA, [
      orderedIntent.props.intentId,
    ]);

    graph = graph.addNode({
      nodeId: "NODE-DISPENSE" as ExecutionNodeId,
      actionType: "DISPENSE_SPECIALTY_BIOLOGIC",
      authorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiredDependencies: [],
      state: ExecutionNodeState.AWAITING_AUTHORITY,
      attempts: [],
    });

    const dispenseNode = graph.getNode("NODE-DISPENSE" as ExecutionNodeId);
    // INVARIANT: ORDERED alone does not make the node READY_FOR_EXECUTION
    expect(dispenseNode?.state).toBe(ExecutionNodeState.AWAITING_AUTHORITY);
    expect(dispenseNode?.state).not.toBe(ExecutionNodeState.READY_FOR_EXECUTION);
  });

  // Test C: AUTHORIZED does not bypass other safeguards
  it("Scenario C: AUTHORIZED does not bypass evidence, identity, isolation, or dependency safeguards", () => {
    const authorizedIntent = ClinicalIntentAggregate.create(
      "INTENT-AUTH-01" as IntentId,
      ctxTenantA,
      ClinicalIntentStage.AUTHORIZED,
      {
        category: IntentActionCategory.PROCEDURE,
        actionVerb: "PERFORM",
        targetConcept: {
          code: "JOINT-INJECTION",
          codeSystem: "CPT",
          displayName: "Arthrocentesis",
        },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-01" as EvidenceId],
      "AUTH-SIG-CLINICIAN-998811",
    );

    // Safeguard 1: Cross-tenant isolation must still fail closed even when AUTHORIZED
    expect(() => {
      assertStrictTenantAndPatientMatch(ctxTenantA, ctxTenantB, "AuthorizedIntent");
    }).toThrow(TenantIsolationError);

    // Safeguard 2: Cross-patient isolation must still fail closed even when AUTHORIZED
    expect(() => {
      assertStrictTenantAndPatientMatch(ctxTenantA, ctxPatient2, "AuthorizedIntent");
    }).toThrow(PatientIsolationError);

    // Safeguard 3: Dependencies must still be satisfied before execution
    let graph = ExecutionGraphAggregate.create("GRAPH-AUTH-01" as ExecutionGraphId, ctxTenantA, [
      authorizedIntent.props.intentId,
    ]);

    graph = graph.addNode({
      nodeId: "NODE-CONSENT" as ExecutionNodeId,
      actionType: "VERIFY_INFORMED_CONSENT",
      authorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiredDependencies: [],
      state: ExecutionNodeState.IN_PROGRESS,
      attempts: [],
    });

    graph = graph.addNode({
      nodeId: "NODE-PROCEDURE" as ExecutionNodeId,
      actionType: "EXECUTE_JOINT_INJECTION",
      authorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiredDependencies: ["NODE-CONSENT" as ExecutionNodeId],
      state: ExecutionNodeState.WAITING_ON_DEPENDENCIES, // Blocked by dependency even though intent is AUTHORIZED
      attempts: [],
    });

    const procedureNode = graph.getNode("NODE-PROCEDURE" as ExecutionNodeId);
    expect(procedureNode?.state).toBe(ExecutionNodeState.WAITING_ON_DEPENDENCIES);
    expect(procedureNode?.state).not.toBe(ExecutionNodeState.READY_FOR_EXECUTION);

    // Safeguard 4: External attempt does not complete node; structured completion confirmation required
    graph = graph.recordAttempt("NODE-CONSENT" as ExecutionNodeId, {
      attemptId: "ATTEMPT-01" as ExecutionAttemptId,
      attemptedAt: new Date(),
      state: ExternalAttemptState.ACCEPTED,
    });

    const consentNodeAfterAttempt = graph.getNode("NODE-CONSENT" as ExecutionNodeId);
    expect(consentNodeAfterAttempt?.state).not.toBe(ExecutionNodeState.COMPLETED);

    // Cannot complete node without verified evidence ID
    expect(() => {
      graph.completeNode("NODE-CONSENT" as ExecutionNodeId, {
        confirmationId: "CONF-01" as any,
        confirmedAt: new Date(),
        externalReferenceId: "REF-001",
        verifyingEvidenceId: "" as any,
      });
    }).toThrow(InvariantViolationError);
  });

  // Test D: Discussion does not become clinical execution
  it("Scenario D: DISCUSSED and CONSIDERED cannot create executable work or bypass decision gates", () => {
    const discussedIntent = ClinicalIntentAggregate.create(
      "INTENT-DISCUSS-01" as IntentId,
      ctxTenantA,
      ClinicalIntentStage.DISCUSSED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "DISCUSS_OPTIONS",
        targetConcept: {
          code: "RITUXIMAB",
          codeSystem: "RxNorm",
          displayName: "Rituximab infusion",
        },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_D_CLINICAL_JUDGMENT,
      ["EVD-01" as EvidenceId],
    );

    // Discussion is NOT eligible for execution planning
    expect(discussedIntent.isEligibleForExecutionPlanning()).toBe(false);

    // Discussion cannot jump directly to AUTHORIZED
    expect(() => {
      discussedIntent.transitionStage(ClinicalIntentStage.AUTHORIZED, clinicianActorId);
    }).toThrow(InvariantViolationError);

    // Considered is also NOT eligible for execution planning
    const consideredIntent = discussedIntent.transitionStage(
      ClinicalIntentStage.CONSIDERED,
      clinicianActorId,
    );
    expect(consideredIntent.isEligibleForExecutionPlanning()).toBe(false);
  });

  // Test E: Graph may contain blocked nodes while safe preparatory work advances
  it("Scenario E: graph advances safe preparatory work while an authority-dependent node remains blocked", () => {
    const decidedIntent = ClinicalIntentAggregate.create(
      "INTENT-DECIDED-02" as IntentId,
      ctxTenantA,
      ClinicalIntentStage.DECIDED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "INITIATE",
        targetConcept: {
          code: "tocilizumab",
          codeSystem: "RxNorm",
          displayName: "Tocilizumab 162mg SubQ",
        },
        actionNamespace: "sovereign.core",
      },
      validTemporal,
      clinicianActorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-01" as EvidenceId],
    );

    let graph = ExecutionGraphAggregate.create("GRAPH-MULTI-01" as ExecutionGraphId, ctxTenantA, [
      decidedIntent.props.intentId,
    ]);

    // Node 1: Administrative benefit verification (Class A) - safe to execute
    graph = graph.addNode({
      nodeId: "NODE-BENEFIT-CHECK" as ExecutionNodeId,
      actionType: "CHECK_PAYER_BENEFITS",
      authorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiredDependencies: [],
      state: ExecutionNodeState.READY_FOR_EXECUTION,
      attempts: [],
    });

    // Node 2: Clinical prior auth submission (Class C) - blocked awaiting explicit clinician authority
    graph = graph.addNode({
      nodeId: "NODE-PA-SUBMIT" as ExecutionNodeId,
      actionType: "SUBMIT_PA_PACKET",
      authorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiredDependencies: ["NODE-BENEFIT-CHECK" as ExecutionNodeId],
      state: ExecutionNodeState.AWAITING_AUTHORITY,
      attempts: [],
    });

    // Node 1 advances and completes
    graph = graph.completeNode("NODE-BENEFIT-CHECK" as ExecutionNodeId, {
      confirmationId: "CONF-BENEFIT-01" as any,
      confirmedAt: new Date(),
      externalReferenceId: "AVAILITY-ELIG-992211",
      verifyingEvidenceId: "EVD-01" as EvidenceId,
    });

    expect(graph.getNode("NODE-BENEFIT-CHECK" as ExecutionNodeId)?.state).toBe(
      ExecutionNodeState.COMPLETED,
    );

    // Node 2 is still blocked in AWAITING_AUTHORITY
    expect(graph.getNode("NODE-PA-SUBMIT" as ExecutionNodeId)?.state).toBe(
      ExecutionNodeState.AWAITING_AUTHORITY,
    );

    // Clinician later provides explicit signed authorization
    graph = graph.grantNodeAuthority(
      "NODE-PA-SUBMIT" as ExecutionNodeId,
      "CLINICIAN-AUTH-SIG-4411",
    );

    const paNodeAfterAuth = graph.getNode("NODE-PA-SUBMIT" as ExecutionNodeId);
    expect(paNodeAfterAuth?.authorityGrantReference).toBe("CLINICIAN-AUTH-SIG-4411");
    // Now eligible for execution
    expect(paNodeAfterAuth?.state).toBe(ExecutionNodeState.READY_FOR_EXECUTION);
  });
});
