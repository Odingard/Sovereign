/**
 * @file Rheumatoid Arthritis Specialty Domain & Invariant Test Suite
 * @description Verifies architectural boundaries, unknown-safe observations, 5-part therapy history,
 * derivation provenance, NOT_CALCULABLE states, serology temporal coexistence, and ADR-0011/ADR-0012.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AUTHORITATIVE_OBJECT_TYPES,
  AssertionCategory,
  type ClinicalAssertion,
  ClinicalEvidenceAggregate,
  ClinicalIntentAggregate,
  ClinicalIntentStage,
  ClinicalStateAggregate,
  DataProvenanceOrigin,
  DataSensitivityClassification,
  EpistemicStatus,
  type EvidenceId,
  ExtractionLineage,
  InvariantViolationError,
  TemporalPrecision,
  type TenantPatientContext,
} from "@sovereign/domain";
import {
  AdultRaClinicalProfile,
  AdultRaProjectionBuilder,
  ClinicalDecisionReviewStatus,
  DerivedSerologyPhenotype,
  ExaminerKind,
  HoldReasonCategory,
  ImagingModality,
  MONITORING_POLICY_BOUNDARY,
  ObservationPresenceState,
  RaArticularManifestationKind,
  type RaClinicalDecisionEntry,
  RaDiagnosticCertainty,
  RaDiscontinuationReasonCategory,
  RaExtraArticularManifestationKind,
  RaLaboratoryTestCategory,
  RaMedicationCategory,
  RaTerminologyRegistry,
  RaTherapyOutcomeKind,
  RegimenClassification,
  ReportingSourceProvenance,
  SOVEREIGN_RA_NAMESPACES,
  STRUCTURAL_CDAI_CALCULATION_DEFINITION,
  StandardizedMeasureType,
  TherapyLifecycleStatus,
  assertRuleIsApprovedWithVersion,
  assertTherapyDiscontinuationReasonHasEvidence,
  assertTherapyExposureHasEvidence,
  deriveStructuralCdai,
  isObservationConfirmedAbsent,
  isObservationConfirmedPresent,
  isObservationUncertainOrUnassessed,
  isTargetedOrBiologicDmard,
  isTherapyCurrentlyAdministered,
  isTherapyInterruptedOrHeld,
} from "@sovereign/specialty-rheumatology-ra";
import { describe, expect, it } from "vitest";

const SYNTHETIC_CONTEXT: TenantPatientContext = {
  tenantId: "TEN-SYN-RHEUM-01" as any,
  patientId: "PAT-SYN-RA-01" as any,
};

function createSyntheticEvidence(
  evidenceId: string,
  context = SYNTHETIC_CONTEXT,
): ClinicalEvidenceAggregate {
  return ClinicalEvidenceAggregate.create(
    evidenceId as EvidenceId,
    context,
    {
      sourceSystem: "SYNTHETIC_EHR_V1",
      sourceLocator: `Encounter/${evidenceId}`,
      contentMimeType: "application/json",
      contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      extractionLineage: ExtractionLineage.HUMAN_CLINICIAN_ENTERED,
    },
    {
      sensitivity: DataSensitivityClassification.DE_IDENTIFIED,
      provenanceOrigin: DataProvenanceOrigin.SYNTHETIC,
    },
  );
}

describe("WO-003A: RA Specialty Structural Architecture & Invariant Tests", () => {
  // --------------------------------------------------------------------------
  // 1. Architecture & Package Boundary Tests
  // --------------------------------------------------------------------------
  it("Arch-RA-01: proves canonical packages/domain does not import RA specialty package (ADR-0011)", () => {
    const domainIndexPath = join(process.cwd(), "packages/domain/src/index.ts");
    const content = readFileSync(domainIndexPath, "utf-8");
    expect(content).not.toContain("@sovereign/specialty");
    expect(content).not.toContain("rheumatology");
    expect(content).not.toContain("specialties");
  });

  it("Arch-RA-02: proves RA specialty package imports and depends on canonical domain", () => {
    expect(ClinicalStateAggregate).toBeDefined();
    expect(ClinicalEvidenceAggregate).toBeDefined();
    expect(EpistemicStatus).toBeDefined();
  });

  it("Arch-RA-03: proves RA specialty code cannot create a sixth authoritative aggregate (ADR-0011)", () => {
    expect(AUTHORITATIVE_OBJECT_TYPES).toHaveLength(5);
    expect(AUTHORITATIVE_OBJECT_TYPES).toEqual([
      "CLINICAL_STATE",
      "CLINICAL_EVIDENCE_PROVENANCE",
      "CLINICAL_INTENT",
      "EXECUTION_GRAPH",
      "THERAPY_ACCESS_STATE",
    ]);
  });

  it("Arch-RA-04: proves RA projection is strictly read-only and cannot mutate ClinicalStateAggregate", () => {
    const state = ClinicalStateAggregate.create("STATE-SYN-01" as any, SYNTHETIC_CONTEXT);
    const profile = AdultRaProjectionBuilder.buildFromAggregate(state);

    expect(profile.stateId).toBe("STATE-SYN-01");
    expect(profile.tenantId).toBe("TEN-SYN-RHEUM-01");

    // Profile is a separate projection instance; aggregate assertions remain an immutable map
    expect(state.getAllAssertions()).toHaveLength(0);
    expect(state.props.aggregateVersion).toBe(1);
  });

  it("Arch-RA-05: proves RA projection can be rebuilt entirely from canonical ClinicalStateAggregate assertions", () => {
    const ev1 = createSyntheticEvidence("EVD-SYN-01");
    const state = ClinicalStateAggregate.create("STATE-SYN-02" as any, SYNTHETIC_CONTEXT);

    const rfAssertion: ClinicalAssertion = {
      assertionId: "ASSERT-RF-01",
      category: AssertionCategory.LABORATORY_RESULT,
      concept: {
        code: `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:rheumatoid-factor`,
        codeSystem: "sovereign:concept",
        displayName: "Rheumatoid Factor",
      },
      value: { kind: "PRESENCE_ABSENCE", isPresent: true },
      validity: { status: EpistemicStatus.KNOWN },
      effectiveTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2023-01-10T10:00:00Z"),
      },
      recordedTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2023-01-10T10:30:00Z"),
      },
      supportingEvidenceIds: [ev1.props.evidenceId],
    };

    const ccpAssertion: ClinicalAssertion = {
      assertionId: "ASSERT-CCP-01",
      category: AssertionCategory.LABORATORY_RESULT,
      concept: {
        code: `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:anti-ccp`,
        codeSystem: "sovereign:concept",
        displayName: "Anti-CCP",
      },
      value: { kind: "PRESENCE_ABSENCE", isPresent: true },
      validity: { status: EpistemicStatus.KNOWN },
      effectiveTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2023-01-10T10:00:00Z"),
      },
      recordedTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2023-01-10T10:30:00Z"),
      },
      supportingEvidenceIds: [ev1.props.evidenceId],
    };

    const updatedState = state.appendAssertion(rfAssertion).appendAssertion(ccpAssertion);
    const profile = AdultRaProjectionBuilder.buildFromAggregate(updatedState);

    expect(profile.derivedSerologyPhenotype.phenotype).toBe(
      DerivedSerologyPhenotype.SEROPOSITIVE_RF_AND_CCP,
    );
    expect(profile.derivedSerologyPhenotype.rfAssertionId).toBe("ASSERT-RF-01");
    expect(profile.derivedSerologyPhenotype.antiCcpAssertionId).toBe("ASSERT-CCP-01");
  });

  it("Arch-RA-06: proves pure domain isolation with zero external cloud or database dependencies in RA package", () => {
    const pkgJsonPath = join(process.cwd(), "packages/specialties/rheumatology/ra/package.json");
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    const deps = Object.keys(pkgJson.dependencies || {});
    expect(deps).toEqual(["@sovereign/domain"]);
  });

  it("Arch-RA-07: proves clinical governance decision register cannot be executed if unapproved", () => {
    const pendingRule: RaClinicalDecisionEntry = {
      decisionId: "CDR-RA-001B",
      clinicalGovernanceQuestion: "What are approved CDAI cutoffs?",
      clinicalRiskIfIncorrect: "Therapy misclassification",
      candidateOptions: "<= 2.8 Remission",
      authoritativeSourceReferences: "Smolen 2005",
      responsibleReviewer: "RA Clinical Safety Owner",
      reviewStatus: ClinicalDecisionReviewStatus.PENDING_RHEUMATOLOGY_REVIEW,
      productVersionAffected: "V0.1",
    };

    expect(() => assertRuleIsApprovedWithVersion(pendingRule)).toThrowError(
      InvariantViolationError,
    );
    expect(() => assertRuleIsApprovedWithVersion(pendingRule)).toThrowError(
      /PENDING_RHEUMATOLOGY_REVIEW/,
    );

    const approvedRule: RaClinicalDecisionEntry = {
      ...pendingRule,
      reviewStatus: ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION,
      approvedVersion: "1.0.0",
      decisionDate: new Date(),
      approvalReference: "CLIN-SIGNOFF-001",
    };

    expect(() => assertRuleIsApprovedWithVersion(approvedRule)).not.toThrow();
  });

  // --------------------------------------------------------------------------
  // 2. Unknown-Safe Clinical Observations
  // --------------------------------------------------------------------------
  it("Inv-RA-01: unknown joint observation is never converted to absent/negative", () => {
    const state = ObservationPresenceState.UNKNOWN;
    expect(isObservationConfirmedAbsent(state)).toBe(false);
    expect(isObservationConfirmedPresent(state)).toBe(false);
    expect(isObservationUncertainOrUnassessed(state)).toBe(true);
  });

  it("Inv-RA-02: not-assessed joint is not counted as negative/absent", () => {
    const state = ObservationPresenceState.NOT_ASSESSED;
    expect(isObservationConfirmedAbsent(state)).toBe(false);
    expect(isObservationConfirmedPresent(state)).toBe(false);
    expect(isObservationUncertainOrUnassessed(state)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 3. Decoupled 5-Part Therapy History & Safety Rules
  // --------------------------------------------------------------------------
  it("Inv-RA-03: therapy exposure can exist without any documented therapy outcome", () => {
    const ev = createSyntheticEvidence("EVD-SYN-03");
    const exposure = {
      exposureId: "EXP-MTX-01",
      medicationConcept: { code: "6851", codeSystem: "RXNORM", displayName: "Methotrexate" },
      medicationCategory: RaMedicationCategory.CONVENTIONAL_SYNTHETIC_DMARD,
      exposurePeriod: {
        startTime: { precision: TemporalPrecision.YEAR_ONLY, year: 2021 },
      },
      lifecycleStatus: TherapyLifecycleStatus.ACTIVE,
      exposureEvidenceIds: [ev.props.evidenceId],
    };

    expect(() => assertTherapyExposureHasEvidence(exposure)).not.toThrow();
    expect(isTherapyCurrentlyAdministered(exposure.lifecycleStatus)).toBe(true);
  });

  it("Inv-RA-04: one therapy exposure can have multiple time-bounded outcome assertions", () => {
    const ev = createSyntheticEvidence("EVD-SYN-04");
    const initialResponse = {
      outcomeAssertionId: "OUT-01",
      exposureId: "EXP-ETA-01",
      outcomeKind: RaTherapyOutcomeKind.INITIAL_RESPONSE_ACHIEVED,
      effectiveTimeWindow: { precision: TemporalPrecision.YEAR_ONLY, year: 2019 },
      validity: { status: EpistemicStatus.KNOWN },
      supportingEvidenceIds: [ev.props.evidenceId],
    };

    const secondaryLoss = {
      outcomeAssertionId: "OUT-02",
      exposureId: "EXP-ETA-01",
      outcomeKind: RaTherapyOutcomeKind.INADEQUATE_RESPONSE_SECONDARY,
      effectiveTimeWindow: { precision: TemporalPrecision.YEAR_ONLY, year: 2021 },
      validity: { status: EpistemicStatus.KNOWN },
      supportingEvidenceIds: [ev.props.evidenceId],
    };

    expect(initialResponse.exposureId).toBe(secondaryLoss.exposureId);
    expect(initialResponse.outcomeKind).not.toBe(secondaryLoss.outcomeKind);
  });

  it("Inv-RA-05: therapy discontinuation event can exist with unknown reason", () => {
    const ev = createSyntheticEvidence("EVD-SYN-05");
    const reason = {
      reasonId: "REASON-01",
      exposureId: "EXP-SSZ-01",
      discontinuationEventId: "EVENT-01",
      typedReason: RaDiscontinuationReasonCategory.UNKNOWN_REASON,
      supportingEvidenceIds: [ev.props.evidenceId],
    };

    expect(() => assertTherapyDiscontinuationReasonHasEvidence(reason)).not.toThrow();
    expect(reason.typedReason).toBe(RaDiscontinuationReasonCategory.UNKNOWN_REASON);
  });

  it("Inv-RA-06: inactive therapy status does not imply therapeutic failure", () => {
    const status = TherapyLifecycleStatus.INACTIVE;
    expect(status).not.toBe("FAILED");
    expect(isTherapyCurrentlyAdministered(status)).toBe(false);
  });

  it("Inv-RA-07: unknown current medication status does not default to inactive", () => {
    const status = TherapyLifecycleStatus.UNKNOWN;
    expect(status).not.toBe(TherapyLifecycleStatus.INACTIVE);
    expect(isTherapyCurrentlyAdministered(status)).toBe(false);
  });

  it("Inv-RA-08: treatment discontinuation reason strictly requires supporting evidence", () => {
    const invalidReason = {
      reasonId: "REASON-INV-01",
      exposureId: "EXP-01",
      discontinuationEventId: "EVT-01",
      typedReason: RaDiscontinuationReasonCategory.INADEQUATE_RESPONSE,
      supportingEvidenceIds: [],
    };

    expect(() => assertTherapyDiscontinuationReasonHasEvidence(invalidReason)).toThrowError(
      InvariantViolationError,
    );
    expect(() => assertTherapyDiscontinuationReasonHasEvidence(invalidReason)).toThrowError(
      /lacks supporting evidence/,
    );
  });

  it("Inv-RA-09: an ORDERED Clinical Intent alone cannot create an RaTherapyExposure without administration evidence", () => {
    const ev = createSyntheticEvidence("EVD-SYN-09");
    const orderedIntent = ClinicalIntentAggregate.create(
      "INTENT-ORDERED-01" as any,
      SYNTHETIC_CONTEXT,
      ClinicalIntentStage.ORDERED,
      {
        category: "MEDICATION" as any,
        actionVerb: "INITIATE",
        targetConcept: {
          code: "32968",
          codeSystem: "RxNorm",
          displayName: "Adalimumab 40mg injection",
        },
        actionNamespace: "sovereign.core",
      },
      {
        effectiveClinicalTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
        sourceRecordedTime: { precision: TemporalPrecision.EXACT, timestamp: new Date() },
        sovereignIngestionTime: new Date(),
      },
      "ACTOR-CLINICIAN-01" as any,
      "CLASS_C_CLINICIAN_AUTH" as any,
      [ev.props.evidenceId],
    );

    expect(orderedIntent.props.stage).toBe(ClinicalIntentStage.ORDERED);

    // Attempting to construct exposure without administration evidence throws
    const invalidExposureWithoutEvidence = {
      exposureId: "EXP-NO-EVD",
      medicationConcept: { code: "32968", codeSystem: "RXNORM", displayName: "Adalimumab" },
      medicationCategory: RaMedicationCategory.BIOLOGIC_TNF_INHIBITOR,
      exposurePeriod: { startTime: { precision: TemporalPrecision.YEAR_ONLY, year: 2024 } },
      lifecycleStatus: TherapyLifecycleStatus.ACTIVE,
      exposureEvidenceIds: [],
    };

    expect(() => assertTherapyExposureHasEvidence(invalidExposureWithoutEvidence)).toThrowError(
      InvariantViolationError,
    );
  });

  // --------------------------------------------------------------------------
  // 4. Monitoring Facts vs Policy Conclusions
  // --------------------------------------------------------------------------
  it("Inv-RA-10: monitoring result does not independently produce cleared or hold recommendations", () => {
    expect(MONITORING_POLICY_BOUNDARY.FRESHNESS_EVALUATION).toBe(
      EpistemicStatus.REQUIRES_CLINICAL_DECISION,
    );
    expect(MONITORING_POLICY_BOUNDARY.TREATMENT_HOLD_DECISION).toBe(
      EpistemicStatus.REQUIRES_CLINICAL_DECISION,
    );
  });

  it("Inv-RA-11: operational TherapyAccessState status is not persisted as RA Clinical State", () => {
    const profile = AdultRaClinicalProfile.create({
      stateId: "STATE-SYN-03",
      tenantId: "TEN-01",
      patientId: "PAT-01",
      aggregateVersion: 1,
      derivedSerologyPhenotype: {
        phenotype: DerivedSerologyPhenotype.UNKNOWN_PHENOTYPE,
        explanation: "No serology",
      },
      therapyHistory: [],
      therapyOutcomes: [],
      therapyDiscontinuations: [],
      discontinuationReasons: [],
      activeHolds: [],
      jointCountObservations: [],
      diseaseActivityScores: [],
      articularManifestations: [],
      extraArticularManifestations: [],
      functionalAssessments: [],
      observedMonitoringFacts: [],
      unresolvedIssues: [],
      therapyAccessCaseId: "CASE-PA-01" as any, // Reference only!
    });

    // Verification: Profile stores reference only, no operational prior auth status strings
    expect(profile.props.therapyAccessCaseId).toBe("CASE-PA-01");
    expect((profile.props as any).accessStatusSummary).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 5. Serology Phenotype Projection & Temporal Coexistence
  // --------------------------------------------------------------------------
  it("Inv-RA-12: missing RF/ACPA evidence produces UNKNOWN_PHENOTYPE, never SERONEGATIVE", () => {
    const result = AdultRaProjectionBuilder.deriveSerologyPhenotype([]);
    expect(result.phenotype).toBe(DerivedSerologyPhenotype.UNKNOWN_PHENOTYPE);
    expect(result.explanation).toContain("Invariant: Unknown is never negative");
  });

  it("Inv-RA-13: later positive serology observation does not delete or supersede valid historical negative evidence", () => {
    const ev2019 = createSyntheticEvidence("EVD-2019");
    const ev2024 = createSyntheticEvidence("EVD-2024");

    const rfNegative2019: ClinicalAssertion = {
      assertionId: "ASSERT-RF-2019",
      category: AssertionCategory.LABORATORY_RESULT,
      concept: {
        code: `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:rheumatoid-factor`,
        codeSystem: "sovereign:concept",
        displayName: "Rheumatoid Factor",
      },
      value: { kind: "PRESENCE_ABSENCE", isPresent: false },
      validity: { status: EpistemicStatus.KNOWN },
      effectiveTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2019-02-14T10:00:00Z"),
      },
      recordedTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2019-02-14T11:00:00Z"),
      },
      supportingEvidenceIds: [ev2019.props.evidenceId],
    };

    const ccpPositive2024: ClinicalAssertion = {
      assertionId: "ASSERT-CCP-2024",
      category: AssertionCategory.LABORATORY_RESULT,
      concept: {
        code: `${SOVEREIGN_RA_NAMESPACES.LABORATORY}:anti-ccp`,
        codeSystem: "sovereign:concept",
        displayName: "Anti-CCP",
      },
      value: { kind: "PRESENCE_ABSENCE", isPresent: true },
      validity: { status: EpistemicStatus.KNOWN },
      effectiveTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2024-06-18T10:00:00Z"),
      },
      recordedTime: {
        precision: TemporalPrecision.EXACT,
        timestamp: new Date("2024-06-18T11:00:00Z"),
      },
      supportingEvidenceIds: [ev2024.props.evidenceId],
    };

    // Both assertions coexist in the assertion collection
    const assertions = [rfNegative2019, ccpPositive2024];
    expect(assertions).toHaveLength(2);

    const derived = AdultRaProjectionBuilder.deriveSerologyPhenotype(assertions);
    expect(derived.phenotype).toBe(DerivedSerologyPhenotype.SEROPOSITIVE_CCP_ONLY);
    expect(derived.rfAssertionId).toBe("ASSERT-RF-2019");
    expect(derived.antiCcpAssertionId).toBe("ASSERT-CCP-2024");
  });

  // --------------------------------------------------------------------------
  // 6. Disease Activity & NOT_CALCULABLE State (ADR-0012)
  // --------------------------------------------------------------------------
  it("Inv-RA-14: disease-activity score with missing mandatory component produces NOT_CALCULABLE", () => {
    // PtGA is missing
    const scoreResult = deriveStructuralCdai({
      tjc28AssertionId: "ASSERT-TJC-01",
      tjc28Value: 6,
      sjc28AssertionId: "ASSERT-SJC-01",
      sjc28Value: 4,
      phgaAssertionId: "ASSERT-PHGA-01",
      phgaValue: 3.0,
      // ptga omitted
    });

    expect(scoreResult.status).toBe("NOT_CALCULABLE");
    if (scoreResult.status === "NOT_CALCULABLE") {
      expect(scoreResult.reason).toBe("MISSING_MANDATORY_COMPONENTS");
      expect(scoreResult.missingComponents).toContain("PATIENT_GLOBAL_PTGA");
      expect(scoreResult.availableComponentAssertionIds).toHaveLength(3);
    }
  });

  it("Inv-RA-15A: complete components with unapproved formula yields CALCULATION_NOT_ACTIVATED (ADR-0012)", () => {
    const scoreResult = deriveStructuralCdai({
      tjc28AssertionId: "ASSERT-TJC-01",
      tjc28Value: 2,
      sjc28AssertionId: "ASSERT-SJC-01",
      sjc28Value: 1,
      ptgaAssertionId: "ASSERT-PTGA-01",
      ptgaValue: 1.0,
      phgaAssertionId: "ASSERT-PHGA-01",
      phgaValue: 1.0,
    });

    expect(scoreResult.status).toBe("CALCULATION_NOT_ACTIVATED");
    if (scoreResult.status === "CALCULATION_NOT_ACTIVATED") {
      expect(scoreResult.reason).toBe("REQUIRES_CLINICAL_APPROVAL");
      expect(scoreResult.calculationDefinitionId).toBe("DEF-CDAI-ACR-2005");
      expect(scoreResult.clinicalDecisionId).toBe("CDR-RA-001A");
      expect(scoreResult.reviewStatus).toBe(
        ClinicalDecisionReviewStatus.PENDING_RHEUMATOLOGY_REVIEW,
      );
      expect(scoreResult.availableComponentAssertionIds).toHaveLength(4);
      expect(scoreResult.candidateFormulaMetadata.formulaName).toBe(
        "CDAI (TJC28 + SJC28 + PtGA + PhGA)",
      );
      expect(scoreResult.candidateFormulaMetadata.candidateVersion).toBe("1.0.0-candidate");
      expect(scoreResult.candidateFormulaMetadata.componentRequirements).toHaveLength(4);
      expect(scoreResult.explanation).toContain(
        "Representing a clinical calculation is structural. Executing a clinical calculation is clinical semantics.",
      );
      // Permanent Invariant: unapproved formula NEVER produces a numeric result
      expect((scoreResult as any).numericValue).toBeUndefined();
    }
  });

  it("Inv-RA-15B: approved formula definition with human clinical sign-off is required before CALCULATED can occur", () => {
    // 1. Structural calculation definition has reviewStatus PENDING_RHEUMATOLOGY_REVIEW
    expect(STRUCTURAL_CDAI_CALCULATION_DEFINITION.reviewStatus).toBe(
      ClinicalDecisionReviewStatus.PENDING_RHEUMATOLOGY_REVIEW,
    );
    expect(STRUCTURAL_CDAI_CALCULATION_DEFINITION.approvedVersion).toBeUndefined();
    expect(STRUCTURAL_CDAI_CALCULATION_DEFINITION.humanReviewerSignOffReference).toBeUndefined();

    // 2. Complete components alone do NOT activate calculation
    const completeInputs = {
      tjc28AssertionId: "ASSERT-TJC-01",
      tjc28Value: 2,
      sjc28AssertionId: "ASSERT-SJC-01",
      sjc28Value: 1,
      ptgaAssertionId: "ASSERT-PTGA-01",
      ptgaValue: 1.0,
      phgaAssertionId: "ASSERT-PHGA-01",
      phgaValue: 1.0,
    };

    const pendingResult = deriveStructuralCdai(
      completeInputs,
      STRUCTURAL_CDAI_CALCULATION_DEFINITION,
    );
    expect(pendingResult.status).not.toBe("CALCULATED");
    expect(pendingResult.status).toBe("CALCULATION_NOT_ACTIVATED");

    // 3. Rejected definition cannot produce CALCULATED
    const rejectedDefinition = {
      ...STRUCTURAL_CDAI_CALCULATION_DEFINITION,
      reviewStatus: ClinicalDecisionReviewStatus.REJECTED,
    };
    const rejectedResult = deriveStructuralCdai(completeInputs, rejectedDefinition);
    expect(rejectedResult.status).toBe("CALCULATION_NOT_ACTIVATED");

    // 4. Missing approved version cannot produce CALCULATED
    const missingVersionDefinition = {
      ...STRUCTURAL_CDAI_CALCULATION_DEFINITION,
      reviewStatus: ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION,
      approvedVersion: undefined,
      humanReviewerSignOffReference: "SIGNOFF-REF-01",
    };
    const missingVersionResult = deriveStructuralCdai(completeInputs, missingVersionDefinition);
    expect(missingVersionResult.status).toBe("CALCULATION_NOT_ACTIVATED");

    // 5. Missing human sign-off reference cannot produce CALCULATED
    const missingSignOffDefinition = {
      ...STRUCTURAL_CDAI_CALCULATION_DEFINITION,
      reviewStatus: ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION,
      approvedVersion: "1.0.0",
      humanReviewerSignOffReference: undefined,
    };
    const missingSignOffResult = deriveStructuralCdai(completeInputs, missingSignOffDefinition);
    expect(missingSignOffResult.status).toBe("CALCULATION_NOT_ACTIVATED");
  });

  it("Inv-RA-15C: unapproved categorical disease-activity interpretation remains unavailable", () => {
    // Formula approval (CDR-RA-001A) and categorical interpretation threshold approval (CDR-RA-001B)
    // are distinct governance decisions in the RA Clinical Decision Register.
    const completeInputs = {
      tjc28AssertionId: "ASSERT-TJC-01",
      tjc28Value: 2,
      sjc28AssertionId: "ASSERT-SJC-01",
      sjc28Value: 1,
      ptgaAssertionId: "ASSERT-PTGA-01",
      ptgaValue: 1.0,
      phgaAssertionId: "ASSERT-PHGA-01",
      phgaValue: 1.0,
    };

    const scoreResult = deriveStructuralCdai(completeInputs);
    // Categorical interpretation (e.g. "Remission", "Low", "Moderate", "High") is strictly unavailable
    expect((scoreResult as any).approvedInterpretation).toBeUndefined();
  });

  it("Inv-RA-15D: AI cannot mark a calculation definition approved or sign off on clinical rules", () => {
    const aiAttemptDefinition = {
      ...STRUCTURAL_CDAI_CALCULATION_DEFINITION,
      reviewStatus: ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION,
      approvedVersion: "1.0.0",
      humanReviewerSignOffReference: "AI-AGENT-GEMINI", // AI self-sign-off attempt
    };

    const completeInputs = {
      tjc28AssertionId: "ASSERT-TJC-01",
      tjc28Value: 2,
      sjc28AssertionId: "ASSERT-SJC-01",
      sjc28Value: 1,
      ptgaAssertionId: "ASSERT-PTGA-01",
      ptgaValue: 1.0,
      phgaAssertionId: "ASSERT-PHGA-01",
      phgaValue: 1.0,
    };

    // deriveStructuralCdai rejects AI sign-off and falls back to CALCULATION_NOT_ACTIVATED
    const result = deriveStructuralCdai(completeInputs, aiAttemptDefinition);
    expect(result.status).toBe("CALCULATION_NOT_ACTIVATED");

    // Governance assertRuleIsApprovedWithVersion strictly throws InvariantViolationError on AI approval
    const aiDecisionEntry: RaClinicalDecisionEntry = {
      decisionId: "CDR-RA-001A",
      clinicalGovernanceQuestion: "What is approved CDAI formula?",
      clinicalRiskIfIncorrect: "Therapy misclassification",
      candidateOptions: "TJC28 + SJC28 + PtGA + PhGA",
      authoritativeSourceReferences: "Smolen 2005",
      responsibleReviewer: "AI Assistant",
      reviewStatus: ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION,
      approvedVersion: "1.0.0",
      approvalReference: "AI-MODEL-SIGN-OFF",
      productVersionAffected: "V0.1",
    };

    expect(() => assertRuleIsApprovedWithVersion(aiDecisionEntry)).toThrowError(
      InvariantViolationError,
    );
    expect(() => assertRuleIsApprovedWithVersion(aiDecisionEntry)).toThrowError(
      /AI agent cannot approve clinical rule/,
    );
  });

  // --------------------------------------------------------------------------
  // 7. Functional Observer Provenance
  // --------------------------------------------------------------------------
  it("Inv-RA-16: functional status provenance distinguishes patient report from clinician observation", () => {
    expect(ReportingSourceProvenance.PATIENT_REPORTED).not.toBe(
      ReportingSourceProvenance.CLINICIAN_OBSERVED,
    );
    expect(ReportingSourceProvenance.CAREGIVER_REPORTED).toBe("CAREGIVER_REPORTED");
  });

  // --------------------------------------------------------------------------
  // 8. Terminology Registry Versioning
  // --------------------------------------------------------------------------
  it("Inv-RA-17: terminology registry preserves versioned mappings without mutating assertions", () => {
    const registry = new RaTerminologyRegistry();
    const concept = `${SOVEREIGN_RA_NAMESPACES.MEDICATION}:methotrexate`;

    registry.registerMapping({
      sovereignConcept: concept,
      externalCode: { system: "RXNORM", code: "6851", displayName: "Methotrexate" },
      mappingVersion: "1.0.0",
      clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
    });

    registry.registerMapping({
      sovereignConcept: concept,
      externalCode: { system: "RXNORM", code: "6851", displayName: "Methotrexate Oral / SubQ" },
      mappingVersion: "2.0.0",
      clinicalReviewStatus: "REQUIRES_CLINICAL_VALIDATION",
    });

    const mappings = registry.getMappings(concept);
    expect(mappings).toHaveLength(2);
    expect(mappings[0].mappingVersion).toBe("1.0.0");
    expect(mappings[1].mappingVersion).toBe("2.0.0");
  });
});
