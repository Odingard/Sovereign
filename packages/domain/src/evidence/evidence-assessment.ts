/**
 * @file Versioned Evidence Assessment
 * @description Invariant: Source artifact is immutable, but assessments and clinical interpretations append.
 */

import type { EpistemicStatus } from "../common/epistemic-status.js";
import type { ActorId } from "../common/identifiers.js";

export interface EvidenceAssessment {
  readonly assessmentId: string;
  readonly assessmentVersion: number;
  readonly evaluatedByActorId: ActorId;
  readonly evaluatedAt: Date;
  readonly epistemicStatus: EpistemicStatus;
  readonly clinicalInterpretationSummary: string;
  readonly confidenceScore?: number;
}
