import {
  type ActorId,
  AssertionCategory,
  AuthorityClass,
  ClinicalEvidenceAggregate,
  ClinicalIntentAggregate,
  ClinicalIntentStage,
  ClinicalStateAggregate,
  type ClinicalStateId,
  ConcurrencyConflictError,
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
  type ProvenanceTemporalContext,
  type SovereignDomainEvent,
  TemporalPrecision,
  type TherapyAccessCaseId,
  TherapyAccessStateAggregate,
  createTenantPatientContext,
} from "@sovereign/domain";
import {
  PostgresClinicalEvidenceRepository,
  PostgresClinicalIntentRepository,
  PostgresClinicalStateRepository,
  PostgresExecutionGraphRepository,
  PostgresOutboxRepository,
  PostgresTherapyAccessRepository,
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsDown,
  runMigrationsUp,
} from "@sovereign/persistence";
import type { Kysely } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TEST_DB_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

describe("Sovereign PostgreSQL Canonical Persistence Integration Tests", () => {
  let db: Kysely<SovereignPostgresDatabase>;
  let evidenceRepo: PostgresClinicalEvidenceRepository;
  let stateRepo: PostgresClinicalStateRepository;
  let intentRepo: PostgresClinicalIntentRepository;
  let executionRepo: PostgresExecutionGraphRepository;
  let therapyAccessRepo: PostgresTherapyAccessRepository;
  let outboxRepo: PostgresOutboxRepository;

  const tenantA = createTenantPatientContext("TENANT-HEALTH-SYSTEM-A", "PATIENT-SYN-001");
  const tenantB = createTenantPatientContext("TENANT-HEALTH-SYSTEM-B", "PATIENT-SYN-001");
  const patient2InTenantA = createTenantPatientContext("TENANT-HEALTH-SYSTEM-A", "PATIENT-SYN-002");
  const clinicianActor = "ACTOR-CLINICIAN-123" as ActorId;

  const standardTemporal: ProvenanceTemporalContext = {
    effectiveClinicalTime: { precision: TemporalPrecision.MONTH_ONLY, year: 2026, month: 8 },
    sourceRecordedTime: { precision: TemporalPrecision.DATE_ONLY, year: 2026, month: 8, day: 20 },
    sovereignIngestionTime: new Date("2026-08-20T14:00:00Z"),
  };

  beforeAll(async () => {
    db = createPostgresKysely(TEST_DB_URL);
    evidenceRepo = new PostgresClinicalEvidenceRepository(db);
    stateRepo = new PostgresClinicalStateRepository(db);
    intentRepo = new PostgresClinicalIntentRepository(db);
    executionRepo = new PostgresExecutionGraphRepository(db);
    therapyAccessRepo = new PostgresTherapyAccessRepository(db);
    outboxRepo = new PostgresOutboxRepository(db);

    // Reset and apply initial canonical migration
    await runMigrationsDown(db);
    await runMigrationsUp(db);
  });

  afterAll(async () => {
    if (db) {
      await db.destroy();
    }
  });

  it("verifies canonical database tables and schema migrations", async () => {
    // Check that all canonical tables exist and can be queried
    const evidenceCount = await db
      .selectFrom("clinical_evidence")
      .select(db.fn.countAll().as("c"))
      .executeTakeFirstOrThrow();
    const statesCount = await db
      .selectFrom("clinical_states")
      .select(db.fn.countAll().as("c"))
      .executeTakeFirstOrThrow();
    const intentsCount = await db
      .selectFrom("clinical_intents")
      .select(db.fn.countAll().as("c"))
      .executeTakeFirstOrThrow();
    const graphsCount = await db
      .selectFrom("execution_graphs")
      .select(db.fn.countAll().as("c"))
      .executeTakeFirstOrThrow();
    const casesCount = await db
      .selectFrom("therapy_access_cases")
      .select(db.fn.countAll().as("c"))
      .executeTakeFirstOrThrow();
    const outboxCount = await db
      .selectFrom("domain_outbox_events")
      .select(db.fn.countAll().as("c"))
      .executeTakeFirstOrThrow();

    expect(Number(evidenceCount.c)).toBe(0);
    expect(Number(statesCount.c)).toBe(0);
    expect(Number(intentsCount.c)).toBe(0);
    expect(Number(graphsCount.c)).toBe(0);
    expect(Number(casesCount.c)).toBe(0);
    expect(Number(outboxCount.c)).toBe(0);
  });

  // 1. Clinical Evidence persistence and round-trip
  it("persists and hydrates ClinicalEvidenceAggregate with temporal uncertainty and assessments", async () => {
    const evidence = ClinicalEvidenceAggregate.create(
      "EVD-TEST-001" as EvidenceId,
      tenantA,
      {
        sourceSystem: "AMBULATORY_EHR_CLINICAL_NOTE",
        sourceLocator: "ehr://notes/encounter-991",
        contentSha256: "1".repeat(64),
        contentMimeType: "text/markdown",
        extractionLineage: "SYNTHETIC_GENERATION",
      },
      standardTemporal,
      {
        sensitivity: DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI,
        origin: DataProvenanceOrigin.SYNTHETIC_SIMULATION,
      },
    );

    await evidenceRepo.insert(evidence);

    const loaded = await evidenceRepo.findById(tenantA, "EVD-TEST-001" as EvidenceId);
    expect(loaded).not.toBeNull();
    expect(loaded?.props.evidenceId).toBe("EVD-TEST-001");
    expect(loaded?.props.aggregateVersion).toBe(1);
    expect(loaded?.props.schemaVersion).toBe(1);
    expect(loaded?.props.temporal.effectiveClinicalTime.precision).toBe(
      TemporalPrecision.MONTH_ONLY,
    );
    expect(loaded?.props.classification.sensitivity).toBe(
      DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI,
    );
    expect(loaded?.props.classification.origin).toBe(DataProvenanceOrigin.SYNTHETIC_SIMULATION);

    // Append assessment and save with optimistic locking
    const assessed = loaded?.appendAssessment(
      clinicianActor,
      EpistemicStatus.KNOWN,
      "Confirmed synthetic clinical documentation of inflammatory polyarthritis.",
      0.98,
    );
    expect(assessed.props.aggregateVersion).toBe(2);

    await evidenceRepo.updateWithOptimisticLock(assessed, 1);

    const reloaded = await evidenceRepo.findById(tenantA, "EVD-TEST-001" as EvidenceId);
    expect(reloaded?.props.aggregateVersion).toBe(2);
    expect(reloaded?.props.assessments).toHaveLength(1);
    expect(reloaded?.latestAssessment?.epistemicStatus).toBe(EpistemicStatus.KNOWN);
  });

  // 2. Clinical State persistence and round-trip
  it("persists and hydrates ClinicalStateAggregate with multiple epistemic statuses", async () => {
    let state = ClinicalStateAggregate.create("STATE-TEST-001" as ClinicalStateId, tenantA);

    // Assertion 1: Confirmed condition (KNOWN)
    state = state.appendAssertion({
      assertionId: "AST-001",
      category: AssertionCategory.CONDITION,
      concept: {
        code: "M05.79",
        codeSystem: "ICD-10-CM",
        displayName: "Seropositive rheumatoid arthritis",
      },
      value: { kind: "PRESENCE_ABSENCE", isPresent: true },
      validity: { status: EpistemicStatus.KNOWN },
      effectiveTime: { precision: TemporalPrecision.YEAR_ONLY, year: 2025 },
      recordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      supportingEvidenceIds: ["EVD-TEST-001" as EvidenceId],
    });

    // Assertion 2: Unknown screening (UNKNOWN)
    state = state.appendAssertion({
      assertionId: "AST-002",
      category: AssertionCategory.SAFETY_SCREENING,
      concept: {
        code: "TB-SCREEN",
        codeSystem: "LOINC",
        displayName: "Interferon-gamma release assay",
      },
      value: { kind: "UNKNOWN", reason: "Pre-biologic TB screening pending" },
      validity: { status: EpistemicStatus.UNKNOWN },
      effectiveTime: { precision: TemporalPrecision.UNKNOWN, reason: "Pending lab order" },
      recordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      supportingEvidenceIds: ["EVD-TEST-001" as EvidenceId],
    });

    await stateRepo.insert(state);

    const loaded = await stateRepo.findById(tenantA, "STATE-TEST-001" as ClinicalStateId);
    expect(loaded).not.toBeNull();
    expect(loaded?.props.aggregateVersion).toBe(3); // Initial 1 + 2 appends
    expect(loaded?.getAllAssertions()).toHaveLength(2);

    const ast1 = loaded?.getAssertion("AST-001");
    expect(ast1?.validity.status).toBe(EpistemicStatus.KNOWN);

    const ast2 = loaded?.getAssertion("AST-002");
    expect(ast2?.validity.status).toBe(EpistemicStatus.UNKNOWN);
    expect(ast2?.value.kind).toBe("UNKNOWN");
  });

  // 3. Clinical Intent persistence, lifecycle transitions, and supersession
  it("persists and hydrates ClinicalIntentAggregate with lifecycle transitions and supersession", async () => {
    const intent = ClinicalIntentAggregate.create(
      "INTENT-TEST-001" as IntentId,
      tenantA,
      ClinicalIntentStage.DECIDED,
      {
        category: IntentActionCategory.MEDICATION,
        actionVerb: "INITIATE",
        targetConcept: {
          code: "214159",
          codeSystem: "RxNorm",
          displayName: "Methotrexate 15 mg weekly",
        },
        actionNamespace: "sovereign.core",
        valueSpecification: { kind: "QUANTITY", quantity: { value: 15, unit: "mg/week" } },
      },
      standardTemporal,
      clinicianActor,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-TEST-001" as EvidenceId],
      "CLINICIAN-DECISION-MEMO-441",
    );

    await intentRepo.insert(intent);

    // Transition to ORDERED then AUTHORIZED
    let loaded = await intentRepo.findById(tenantA, "INTENT-TEST-001" as IntentId);
    expect(loaded?.props.stage).toBe(ClinicalIntentStage.DECIDED);
    expect(loaded?.props.aggregateVersion).toBe(1);

    const ordered = loaded?.transitionStage(ClinicalIntentStage.ORDERED, clinicianActor);
    const authorized = ordered.transitionStage(
      ClinicalIntentStage.AUTHORIZED,
      clinicianActor,
      "AUTH-PASS-8877",
    );

    await intentRepo.updateWithOptimisticLock(authorized, 1);

    loaded = await intentRepo.findById(tenantA, "INTENT-TEST-001" as IntentId);
    expect(loaded?.props.stage).toBe(ClinicalIntentStage.AUTHORIZED);
    expect(loaded?.props.aggregateVersion).toBe(3);
    expect(loaded?.props.authorityReference).toBe("AUTH-PASS-8877");

    // Supersede intent
    const superseded = loaded?.supersede("INTENT-TEST-002" as IntentId, clinicianActor);
    await intentRepo.updateWithOptimisticLock(superseded, 3);

    const reloaded = await intentRepo.findById(tenantA, "INTENT-TEST-001" as IntentId);
    expect(reloaded?.props.stage).toBe(ClinicalIntentStage.SUPERSEDED);
    expect(reloaded?.props.supersededByIntentId).toBe("INTENT-TEST-002");
    expect(reloaded?.props.aggregateVersion).toBe(4);
    expect(reloaded?.props.temporal.supersessionTime).toBeDefined();
  });

  // 4. Execution Graph persistence, node attempts, and completion confirmation
  it("persists and hydrates ExecutionGraphAggregate with external attempt and completion confirmation", async () => {
    let graph = ExecutionGraphAggregate.create("GRAPH-TEST-001" as ExecutionGraphId, tenantA, [
      "INTENT-TEST-001" as IntentId,
    ]);

    graph = graph.addNode({
      nodeId: "NODE-PRIOR-AUTH-SUBMIT" as ExecutionNodeId,
      nodeType: "SUBMIT_ELECTRONIC_PA",
      state: ExecutionNodeState.READY,
      requiredDependencies: [],
      attempts: [],
    });

    await executionRepo.insert(graph);

    const loaded = await executionRepo.findById(tenantA, "GRAPH-TEST-001" as ExecutionGraphId);
    expect(loaded?.props.aggregateVersion).toBe(2);

    // Record an attempt
    const attemptRecorded = loaded?.recordAttempt("NODE-PRIOR-AUTH-SUBMIT" as ExecutionNodeId, {
      attemptId: "ATTEMPT-01" as ExecutionAttemptId,
      attemptedAt: new Date(),
      state: ExternalAttemptState.ACCEPTED,
      externalTransactionId: "COVERMYMEDS-TX-99001",
    });

    // Node is in-progress, not completed
    expect(attemptRecorded.getNode("NODE-PRIOR-AUTH-SUBMIT" as ExecutionNodeId)?.state).toBe(
      ExecutionNodeState.IN_PROGRESS,
    );

    // Complete node with structured confirmation
    const completedGraph = attemptRecorded.completeNode(
      "NODE-PRIOR-AUTH-SUBMIT" as ExecutionNodeId,
      {
        confirmationId: "CONF-01" as any,
        confirmedAt: new Date(),
        externalReferenceId: "PAYER-AUTH-PA-554433",
        verifyingEvidenceId: "EVD-TEST-001" as EvidenceId,
        verifyingArtifactHash: "2".repeat(64),
      },
    );

    await executionRepo.updateWithOptimisticLock(completedGraph, 2);

    const reloaded = await executionRepo.findById(tenantA, "GRAPH-TEST-001" as ExecutionGraphId);
    expect(reloaded?.props.aggregateVersion).toBe(4);
    const completedNode = reloaded?.getNode("NODE-PRIOR-AUTH-SUBMIT" as ExecutionNodeId);
    expect(completedNode?.state).toBe(ExecutionNodeState.COMPLETED);
    expect(completedNode?.completionConfirmation?.externalReferenceId).toBe("PAYER-AUTH-PA-554433");
    expect(completedNode?.completionConfirmation?.verifyingEvidenceId).toBe("EVD-TEST-001");
  });

  // 5. Therapy Access Case persistence and stage advancement
  it("persists and hydrates TherapyAccessStateAggregate across longitudinal stages", async () => {
    const therapyCase = TherapyAccessStateAggregate.create(
      "CASE-TEST-001" as TherapyAccessCaseId,
      tenantA,
      ["INTENT-TEST-001" as IntentId],
      standardTemporal,
      ["GRAPH-TEST-001" as ExecutionGraphId],
    );

    await therapyAccessRepo.insert(therapyCase);

    const loaded = await therapyAccessRepo.findById(
      tenantA,
      "CASE-TEST-001" as TherapyAccessCaseId,
    );
    expect(loaded?.props.stage).toBe(GenericTherapyAccessStage.CASE_INITIATED);
    expect(loaded?.props.aggregateVersion).toBe(1);

    const advanced = loaded?.advanceStage(
      GenericTherapyAccessStage.ACCESS_AUTHORIZED,
      "EVD-TEST-001" as EvidenceId,
    );

    await therapyAccessRepo.updateWithOptimisticLock(advanced, 1);

    const reloaded = await therapyAccessRepo.findById(
      tenantA,
      "CASE-TEST-001" as TherapyAccessCaseId,
    );
    expect(reloaded?.props.stage).toBe(GenericTherapyAccessStage.ACCESS_AUTHORIZED);
    expect(reloaded?.props.verifiedMilestoneEvidenceIds).toContain("EVD-TEST-001");
    expect(reloaded?.props.aggregateVersion).toBe(2);
  });

  // 6. Optimistic Concurrency Conflict Detection
  it("fails with ConcurrencyConflictError when optimistic concurrency version check fails", async () => {
    const loaded = await evidenceRepo.findById(tenantA, "EVD-TEST-001" as EvidenceId);
    expect(loaded).not.toBeNull();

    // Mutate state
    const assessed = loaded?.appendAssessment(
      clinicianActor,
      EpistemicStatus.KNOWN,
      "Second assessment.",
    );

    // Stale version: database is currently at aggregateVersion 2, but we pass expectedVersion 1
    await expect(evidenceRepo.updateWithOptimisticLock(assessed, 1)).rejects.toThrow(
      ConcurrencyConflictError,
    );
  });

  // 7. Negative Test: Cross-Tenant Isolation
  it("enforces Cross-Tenant Isolation: Tenant-B cannot read or access Tenant-A data", async () => {
    // Querying with Tenant-B credentials returns null for all 5 aggregates
    const evidence = await evidenceRepo.findById(tenantB, "EVD-TEST-001" as EvidenceId);
    expect(evidence).toBeNull();

    const state = await stateRepo.findById(tenantB, "STATE-TEST-001" as ClinicalStateId);
    expect(state).toBeNull();

    const intent = await intentRepo.findById(tenantB, "INTENT-TEST-001" as IntentId);
    expect(intent).toBeNull();

    const graph = await executionRepo.findById(tenantB, "GRAPH-TEST-001" as ExecutionGraphId);
    expect(graph).toBeNull();

    const accessCase = await therapyAccessRepo.findById(
      tenantB,
      "CASE-TEST-001" as TherapyAccessCaseId,
    );
    expect(accessCase).toBeNull();
  });

  // 8. Negative Test: Cross-Patient Isolation
  it("enforces Cross-Patient Isolation: querying with wrong Patient ID returns null", async () => {
    // Querying within Tenant-A but for Patient-2 returns null
    const evidence = await evidenceRepo.findById(patient2InTenantA, "EVD-TEST-001" as EvidenceId);
    expect(evidence).toBeNull();

    const state = await stateRepo.findById(patient2InTenantA, "STATE-TEST-001" as ClinicalStateId);
    expect(state).toBeNull();

    const intent = await intentRepo.findById(patient2InTenantA, "INTENT-TEST-001" as IntentId);
    expect(intent).toBeNull();

    const graph = await executionRepo.findById(
      patient2InTenantA,
      "GRAPH-TEST-001" as ExecutionGraphId,
    );
    expect(graph).toBeNull();

    const accessCase = await therapyAccessRepo.findById(
      patient2InTenantA,
      "CASE-TEST-001" as TherapyAccessCaseId,
    );
    expect(accessCase).toBeNull();
  });

  // 9. Transactional Outbox Integration
  it("persists and fetches domain events via Transactional Outbox", async () => {
    const domainEvent: SovereignDomainEvent = {
      eventId: "EVT-OUTBOX-001" as any,
      eventName: "ClinicalEvidenceRecorded",
      tenantId: tenantA.tenantId,
      patientId: tenantA.patientId,
      aggregateId: "EVD-TEST-001",
      aggregateVersion: 1,
      schemaVersion: 1,
      occurredAt: new Date(),
      actorId: clinicianActor,
      correlationId: "CORR-12345" as any,
      causationId: "CAUSE-67890" as any,
      payload: {
        evidenceId: "EVD-TEST-001" as EvidenceId,
        sourceLocator: "ehr://notes/encounter-991",
        sourceSystem: "AMBULATORY_EHR_CLINICAL_NOTE",
        contentHash: "1".repeat(64),
      },
    };

    await outboxRepo.insertEvent(domainEvent);

    const undispatched = await outboxRepo.fetchUndispatchedEvents(10);
    expect(undispatched.length).toBeGreaterThan(0);
    const eventRow = undispatched.find((e) => e.id === "EVT-OUTBOX-001");
    expect(eventRow).toBeDefined();
    expect(eventRow.event_name).toBe("ClinicalEvidenceRecorded");
    expect(eventRow.tenant_id).toBe(tenantA.tenantId);
    expect(eventRow.correlation_id).toBe("CORR-12345");
  });

  // 10. Schema Version Evolution without Aggregate Version increment
  it("supports schema migration / upcasting without advancing domain aggregateVersion", async () => {
    // Read current intent
    const intentBefore = await intentRepo.findById(tenantA, "INTENT-TEST-001" as IntentId);
    expect(intentBefore).not.toBeNull();
    const currentAggregateVersion = intentBefore?.props.aggregateVersion;

    // Simulate schema evolution migration: upgrade schema_version from 1 to 2 directly in DB
    await db
      .updateTable("clinical_intents")
      .set({ schema_version: 2 })
      .where("tenant_id", "=", tenantA.tenantId)
      .where("id", "=", "INTENT-TEST-001")
      .execute();

    // Reload from database
    const intentAfter = await intentRepo.findById(tenantA, "INTENT-TEST-001" as IntentId);
    expect(intentAfter?.props.schemaVersion).toBe(2);
    // INVARIANT: aggregateVersion did NOT advance!
    expect(intentAfter?.props.aggregateVersion).toBe(currentAggregateVersion);
  });
});
