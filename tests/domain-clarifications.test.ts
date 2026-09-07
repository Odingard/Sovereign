import {
  type ActorId,
  AuthorityClass,
  CANONICAL_SCHEMA_VERSION,
  ClinicalEvidenceAggregate,
  type ClinicalEvidenceRecordedEvent,
  ClinicalIntentAggregate,
  ClinicalIntentStage,
  ClinicalStateAggregate,
  type ClinicalTime,
  DataProvenanceOrigin,
  DataSensitivityClassification,
  type EvidenceId,
  type ExtensibleActionConcept,
  IntentActionCategory,
  type IntentId,
  type ProvenanceTemporalContext,
  TemporalPrecision,
  createTenantPatientContext,
} from "@sovereign/domain";
import { describe, expect, it } from "vitest";

describe("Sovereign WO-001 Mandatory Clarification Tests", () => {
  const ctx = createTenantPatientContext("TENANT-001", "PATIENT-001");
  const actorId = "ACTOR-CLINICIAN-01" as ActorId;

  // Clarification 1: Data classification must remain orthogonal
  it("enforces Clarification 1: data sensitivity is strictly orthogonal to provenance origin", () => {
    // 1. DataSensitivityClassification and DataProvenanceOrigin are distinct orthogonal enums
    expect(DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI).toBe(
      "RESTRICTED_IDENTIFIABLE_PHI",
    );
    expect(DataProvenanceOrigin.SYNTHETIC_SIMULATION).toBe("SYNTHETIC_SIMULATION");

    const temporal: ProvenanceTemporalContext = {
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

    // 2. Synthetic origin with PHI classification (e.g., realistic synthetic PHI for security testing)
    const syntheticEvidence = ClinicalEvidenceAggregate.create(
      "EVD-SYNTH-01" as EvidenceId,
      ctx,
      {
        sourceSystem: "SYNTHETIC_SIM",
        sourceLocator: "sim://001",
        contentSha256: "d".repeat(64),
        contentMimeType: "text/plain",
        extractionLineage: "SYNTHETIC_FIXTURE",
      },
      temporal,
      {
        sensitivity: DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI,
        origin: DataProvenanceOrigin.SYNTHETIC_SIMULATION,
      },
    );
    expect(syntheticEvidence.props.classification.sensitivity).toBe(
      DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI,
    );
    expect(syntheticEvidence.props.classification.origin).toBe(
      DataProvenanceOrigin.SYNTHETIC_SIMULATION,
    );

    // 3. Clinical domain allows EHR origin when authorized (governance gate G0-A enforces environment policy, not permanent domain rule)
    const ehrEvidence = ClinicalEvidenceAggregate.create(
      "EVD-EHR-01" as EvidenceId,
      ctx,
      {
        sourceSystem: "EPIC_EHR",
        sourceLocator: "ehr://patient/123/doc/456",
        contentSha256: "e".repeat(64),
        contentMimeType: "text/plain",
        extractionLineage: "RAW_FHIR_EXTRACT",
      },
      temporal,
      {
        sensitivity: DataSensitivityClassification.RESTRICTED_IDENTIFIABLE_PHI,
        origin: DataProvenanceOrigin.EHR_DIRECT_EXTRACTION,
      },
    );
    expect(ehrEvidence.props.classification.origin).toBe(
      DataProvenanceOrigin.EHR_DIRECT_EXTRACTION,
    );
  });

  // Clarification 2: Clinical time must support uncertainty without manufacturing precision
  it("enforces Clarification 2: supports temporal uncertainty and never manufactures precision", () => {
    // Exact timestamp
    const exactTime: ClinicalTime = {
      precision: TemporalPrecision.EXACT,
      timestamp: new Date("2026-09-01T14:32:00.000Z"),
    };
    expect(exactTime.precision).toBe(TemporalPrecision.EXACT);

    // Date-only (e.g. onset reported on 2024-05-12, but exact hour/minute unknown)
    const dateOnlyTime: ClinicalTime = {
      precision: TemporalPrecision.DATE_ONLY,
      year: 2024,
      month: 5,
      day: 12,
    };
    expect(dateOnlyTime.precision).toBe(TemporalPrecision.DATE_ONLY);
    expect(dateOnlyTime).not.toHaveProperty("timestamp"); // DO NOT manufacture midnight timestamp

    // Month-only (e.g. "symptoms started in March 2023")
    const monthOnlyTime: ClinicalTime = {
      precision: TemporalPrecision.MONTH_ONLY,
      year: 2023,
      month: 3,
    };
    expect(monthOnlyTime.precision).toBe(TemporalPrecision.MONTH_ONLY);

    // Year-only (e.g. "diagnosed in 2018")
    const yearOnlyTime: ClinicalTime = {
      precision: TemporalPrecision.YEAR_ONLY,
      year: 2018,
    };
    expect(yearOnlyTime.precision).toBe(TemporalPrecision.YEAR_ONLY);

    // Interval (e.g. "steroid taper between Jan 2025 and June 2025")
    const intervalTime: ClinicalTime = {
      precision: TemporalPrecision.INTERVAL,
      start: { precision: TemporalPrecision.MONTH_ONLY, year: 2025, month: 1 },
      end: { precision: TemporalPrecision.MONTH_ONLY, year: 2025, month: 6 },
    };
    expect(intervalTime.precision).toBe(TemporalPrecision.INTERVAL);

    // Approximate (e.g. "approximately 6 months ago")
    const approxTime: ClinicalTime = {
      precision: TemporalPrecision.APPROXIMATE,
      approximateDescription: "approximately early 2022",
      lowerBound: new Date("2022-01-01T00:00:00Z"),
      upperBound: new Date("2022-04-30T23:59:59Z"),
    };
    expect(approxTime.precision).toBe(TemporalPrecision.APPROXIMATE);

    // Unknown (e.g. onset completely unrecorded)
    const unknownTime: ClinicalTime = {
      precision: TemporalPrecision.UNKNOWN,
      reason: "Patient does not recall onset year",
    };
    expect(unknownTime.precision).toBe(TemporalPrecision.UNKNOWN);

    // Multi-temporal context preserving distinct times
    const multiTemporal: ProvenanceTemporalContext = {
      effectiveClinicalTime: yearOnlyTime,
      sourceRecordedTime: dateOnlyTime,
      sovereignIngestionTime: new Date("2026-09-01T15:00:00Z"),
      supersessionTime: undefined,
    };

    expect(multiTemporal.effectiveClinicalTime.precision).toBe(TemporalPrecision.YEAR_ONLY);
    expect(multiTemporal.sourceRecordedTime.precision).toBe(TemporalPrecision.DATE_ONLY);
    expect(multiTemporal.sovereignIngestionTime).toBeInstanceOf(Date);
  });

  // Clarification 3: Extensible Clinical Intent action concepts
  it("enforces Clarification 3: clinical intent action concepts are extensible and namespaced", () => {
    const temporal: ProvenanceTemporalContext = {
      effectiveClinicalTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      sourceRecordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      sovereignIngestionTime: new Date(),
    };

    // 1. Medication action
    const medAction: ExtensibleActionConcept = {
      category: IntentActionCategory.MEDICATION,
      actionVerb: "TITRATE_DOSE",
      targetConcept: {
        code: "897122",
        codeSystem: "RxNorm",
        displayName: "Methotrexate oral tablet",
      },
      actionNamespace: "sovereign.core",
      valueSpecification: {
        kind: "QUANTITY",
        quantity: { value: 20, unit: "mg/week" },
      },
    };

    // 2. Monitoring action
    const monitoringAction: ExtensibleActionConcept = {
      category: IntentActionCategory.MONITORING,
      actionVerb: "ORDER_PERIODIC_SURVEILLANCE",
      targetConcept: {
        code: "24357-6",
        codeSystem: "LOINC",
        displayName: "Urinalysis complete panel",
      },
      actionNamespace: "sovereign.core",
      valueSpecification: {
        kind: "NARRATIVE",
        text: "Every 8 weeks while on leflunomide therapy",
      },
    };

    // 3. Specialty Custom / Namespaced action (e.g. Infusion Protocol)
    const infusionAction: ExtensibleActionConcept = {
      category: IntentActionCategory.SPECIALTY_CUSTOM,
      actionVerb: "SCHEDULE_INFUSION_CHAIR",
      targetConcept: {
        code: "INF-CHAIR-PROTOCOL-01",
        codeSystem: "sovereign.specialty.infusion",
        displayName: "Infliximab 2-hour IV infusion protocol",
      },
      actionNamespace: "sovereign.specialty.rheumatology.infusion",
      qualifiers: [
        {
          code: "PREMED_ACETAMINOPHEN",
          codeSystem: "sovereign.premed",
          displayName: "Premedicate with 650mg Acetaminophen",
        },
        {
          code: "PREMED_DIPHENHYDRAMINE",
          codeSystem: "sovereign.premed",
          displayName: "Premedicate with 25mg Diphenhydramine IV",
        },
      ],
    };

    const intent = ClinicalIntentAggregate.create(
      "INTENT-EXT-01" as IntentId,
      ctx,
      ClinicalIntentStage.ORDERED,
      infusionAction,
      temporal,
      actorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-01" as EvidenceId],
    );

    expect(intent.props.actionConcept.category).toBe(IntentActionCategory.SPECIALTY_CUSTOM);
    expect(intent.props.actionConcept.actionNamespace).toBe(
      "sovereign.specialty.rheumatology.infusion",
    );
    expect(intent.props.actionConcept.qualifiers).toHaveLength(2);
  });

  // Clarification 4: Distinct aggregateVersion vs schemaVersion
  it("enforces Clarification 4: separates domain aggregateVersion from serialization schemaVersion", () => {
    const temporal: ProvenanceTemporalContext = {
      effectiveClinicalTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      sourceRecordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
      sovereignIngestionTime: new Date(),
    };

    const intent = ClinicalIntentAggregate.create(
      "INTENT-VER-01" as IntentId,
      ctx,
      ClinicalIntentStage.RECOMMENDED,
      {
        category: IntentActionCategory.PROCEDURE,
        actionVerb: "SCHEDULE",
        targetConcept: {
          code: "41077-4",
          codeSystem: "CPT",
          displayName: "Arthrocentesis joint injection",
        },
        actionNamespace: "sovereign.core",
      },
      temporal,
      actorId,
      AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      ["EVD-01" as EvidenceId],
      undefined,
      undefined,
      CANONICAL_SCHEMA_VERSION, // schemaVersion: 1
    );

    expect(intent.props.aggregateVersion).toBe(1);
    expect(intent.props.schemaVersion).toBe(1);

    // Business mutation increments aggregateVersion from 1 to 2
    const decidedIntent = intent.transitionStage(ClinicalIntentStage.DECIDED, actorId);
    expect(decidedIntent.props.aggregateVersion).toBe(2);
    expect(decidedIntent.props.schemaVersion).toBe(1); // schemaVersion unchanged!

    // Simulating schema evolution / contract upcasting (e.g., serialized schema upgraded to v2)
    // Upcasting reconstitutes the aggregate with schemaVersion 2, but MUST NOT artificially increment aggregateVersion!
    const upcastedIntent = ClinicalIntentAggregate.reconstitute({
      ...decidedIntent.props,
      schemaVersion: 2, // Updated contract schema
      // aggregateVersion remains 2!
    });

    expect(upcastedIntent.props.schemaVersion).toBe(2);
    expect(upcastedIntent.props.aggregateVersion).toBe(2); // History NOT artificially advanced
  });

  // Clarification 5: Avoid untyped domain escape hatches
  it("enforces Clarification 5: domain events and aggregates avoid untyped escape hatches", () => {
    const evidenceRecordedEvent: ClinicalEvidenceRecordedEvent = {
      eventId: "EVT-001" as any,
      eventName: "ClinicalEvidenceRecorded",
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      aggregateId: "EVD-001",
      aggregateVersion: 1,
      schemaVersion: 1,
      occurredAt: new Date(),
      actorId,
      correlationId: "CORR-9988" as any,
      causationId: "CAUSE-1122" as any,
      payload: {
        evidenceId: "EVD-001" as EvidenceId,
        sourceLocator: "ehr://patient/doc/1",
        sourceSystem: "EPIC",
        contentHash: "f".repeat(64),
      },
    };

    expect(evidenceRecordedEvent.eventName).toBe("ClinicalEvidenceRecorded");
    expect(evidenceRecordedEvent.payload.contentHash).toHaveLength(64);
    expect(evidenceRecordedEvent.correlationId).toBe("CORR-9988");
    expect(evidenceRecordedEvent.causationId).toBe("CAUSE-1122");
  });
});
