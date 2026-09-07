/**
 * @file Orthogonal Data Classification and Provenance
 * @description Invariant: Data sensitivity is orthogonal to data provenance origin.
 * Synthetic vs. real PHI is an environment/governance policy, not an immutable clinical domain requirement.
 */

export enum DataSensitivityClassification {
  RESTRICTED_IDENTIFIABLE_PHI = "RESTRICTED_IDENTIFIABLE_PHI",
  LIMITED_DATA_SET = "LIMITED_DATA_SET",
  DEIDENTIFIED_CLINICAL = "DEIDENTIFIED_CLINICAL",
  PUBLIC_OR_BENCHMARK = "PUBLIC_OR_BENCHMARK",
}

export enum DataProvenanceOrigin {
  SYNTHETIC_SIMULATION = "SYNTHETIC_SIMULATION",
  EHR_DIRECT_EXTRACTION = "EHR_DIRECT_EXTRACTION",
  MANUAL_CLINICAL_ENTRY = "MANUAL_CLINICAL_ENTRY",
  PORTAL_DOCUMENT_UPLOAD = "PORTAL_DOCUMENT_UPLOAD",
  DEVICE_STREAM = "DEVICE_STREAM",
}

export interface SecurityClassificationMetadata {
  readonly sensitivity: DataSensitivityClassification;
  readonly origin: DataProvenanceOrigin;
  readonly legalBasisOrGovernanceTag?: string;
}
