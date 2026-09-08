/**
 * @file RA Functional Status & Reporting Provenance
 * @description Invariant: Functional observations record explicit observer provenance.
 * Caregiver provenance is metadata only and confers no clinical authority.
 */

import type { AssertionValidity, ClinicalTime, EvidenceId } from "@sovereign/domain";

export enum ReportingSourceProvenance {
  PATIENT_REPORTED = "PATIENT_REPORTED",
  CLINICIAN_REPORTED = "CLINICIAN_REPORTED",
  CLINICIAN_OBSERVED = "CLINICIAN_OBSERVED",
  CAREGIVER_REPORTED = "CAREGIVER_REPORTED",
  EXTERNAL_RECORD = "EXTERNAL_RECORD",
  UNKNOWN = "UNKNOWN",
}

export interface RaFunctionalStatusAssertion {
  readonly assertionId: string;
  readonly assessmentTool: "HAQ_DI" | "RAPID3" | "QUALITATIVE_FUNCTIONAL_STATEMENT";
  readonly scoreValue?: number;
  readonly observerProvenance: ReportingSourceProvenance;
  readonly effectiveTime: ClinicalTime;
  readonly validity: AssertionValidity;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
