/**
 * @file Source & Provenance Metadata
 * @description Immutable source artifact reference and ingestion custody.
 */

export enum ExtractionLineage {
  HUMAN_CLINICIAN_ENTERED = "HUMAN_CLINICIAN_ENTERED",
  DETERMINISTIC_PARSER = "DETERMINISTIC_PARSER",
  AI_CANDIDATE_VERIFIED = "AI_CANDIDATE_VERIFIED",
  DIRECT_LAB_FEED = "DIRECT_LAB_FEED",
  IMAGE_STUDY_METADATA = "IMAGE_STUDY_METADATA",
}

export interface SourceProvenanceLocator {
  readonly sourceSystem: string; // e.g. "EPIC_AMBULATORY_V1"
  readonly sourceLocator: string; // e.g. "DocumentReference/789123"
  readonly contentMimeType: string; // e.g. "application/pdf" or "application/json"
  readonly contentSha256: string; // SHA-256 hash of raw source artifact
  readonly extractionLineage: ExtractionLineage;
}
