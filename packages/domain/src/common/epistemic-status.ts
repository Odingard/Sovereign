/**
 * @file Epistemic Status & Clinical Truth Representations
 * @description Invariant: Unknown is NEVER negative. Absence of evidence is not evidence of absence.
 */

export enum EpistemicStatus {
  KNOWN = "KNOWN",
  UNKNOWN = "UNKNOWN",
  CONFLICTED = "CONFLICTED",
  REQUIRES_CLINICAL_DECISION = "REQUIRES_CLINICAL_DECISION",
}

export interface AssertionValidity {
  readonly status: EpistemicStatus;
  readonly clinicalRationale?: string;
  readonly conflictingEvidenceIds?: ReadonlyArray<string>;
}
