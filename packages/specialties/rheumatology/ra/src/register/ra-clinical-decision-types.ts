/**
 * @file RA Clinical Decision Governance Types & Guardrails
 * @description Invariants:
 * 1. AI may NEVER approve or close a clinical decision entry.
 * 2. Runtime clinical logic may only consume rules with status: APPROVED_WITH_VERSION.
 */

import { InvariantViolationError } from "@sovereign/domain";

export enum ClinicalDecisionReviewStatus {
  PENDING_RHEUMATOLOGY_REVIEW = "PENDING_RHEUMATOLOGY_REVIEW",
  APPROVED_WITH_VERSION = "APPROVED_WITH_VERSION",
  REJECTED = "REJECTED",
}

export interface RaClinicalDecisionEntry {
  readonly decisionId: string;
  readonly clinicalGovernanceQuestion: string;
  readonly clinicalRiskIfIncorrect: string;
  readonly candidateOptions: string;
  readonly authoritativeSourceReferences: string;
  readonly responsibleReviewer: string;
  readonly reviewStatus: ClinicalDecisionReviewStatus;
  readonly decisionDate?: Date;
  readonly approvalReference?: string;
  readonly approvedVersion?: string;
  readonly productVersionAffected: string;
}

/**
 * Runtime guard enforcing that unapproved rules cannot execute as clinical logic.
 * Invariant: AI may NEVER approve or close a clinical decision entry.
 */
export function assertRuleIsApprovedWithVersion(entry: RaClinicalDecisionEntry): void {
  if (entry.reviewStatus !== ClinicalDecisionReviewStatus.APPROVED_WITH_VERSION) {
    throw new InvariantViolationError(
      `Governance violation: Clinical rule '${entry.decisionId}' cannot be executed. Current status is '${entry.reviewStatus}'. Human rheumatologist approval with version is required before runtime execution.`,
    );
  }

  if (!entry.approvedVersion) {
    throw new InvariantViolationError(
      `Governance violation: Clinical rule '${entry.decisionId}' is marked approved but lacks an approved version identifier.`,
    );
  }

  if (!entry.approvalReference) {
    throw new InvariantViolationError(
      `Governance violation: Clinical rule '${entry.decisionId}' lacks human clinician approval reference.`,
    );
  }

  const lowerRef = entry.approvalReference.toLowerCase();
  const lowerReviewer = (entry.responsibleReviewer || "").toLowerCase();
  if (
    lowerRef.includes("ai") ||
    lowerRef.includes("agent") ||
    lowerRef.includes("bot") ||
    lowerRef.includes("model") ||
    lowerRef.includes("llm") ||
    lowerReviewer.includes("ai") ||
    lowerReviewer.includes("agent") ||
    lowerReviewer.includes("bot") ||
    lowerReviewer.includes("model") ||
    lowerReviewer.includes("llm")
  ) {
    throw new InvariantViolationError(
      `Governance violation: AI agent cannot approve clinical rule '${entry.decisionId}'. A human practicing rheumatologist sign-off reference is required.`,
    );
  }
}
