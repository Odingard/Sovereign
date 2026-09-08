/**
 * @file RA Monitoring Policy Boundary
 * @description Invariant: Factual observations do NOT independently create clinical recommendations or hold decisions.
 * Freshness, sufficiency, and treatment safety remain marked REQUIRES_CLINICAL_DECISION.
 */

import { EpistemicStatus } from "@sovereign/domain";

export const MONITORING_POLICY_BOUNDARY = {
  FRESHNESS_EVALUATION: EpistemicStatus.REQUIRES_CLINICAL_DECISION,
  SUFFICIENCY_EVALUATION: EpistemicStatus.REQUIRES_CLINICAL_DECISION,
  TREATMENT_SAFETY_EVALUATION: EpistemicStatus.REQUIRES_CLINICAL_DECISION,
  TREATMENT_HOLD_DECISION: EpistemicStatus.REQUIRES_CLINICAL_DECISION,
} as const;
