import type { AICandidateResponse, MutationEnvelope } from "@sovereign/contracts";
import {
  type AuthorityClass,
  EpistemicStatus,
  type PatientId,
  type TenantId,
} from "@sovereign/domain";

/**
 * Sovereign Mandatory Mutation Service
 *
 * Enforces Constitutional Mutation Path:
 * AI candidate → validation → evidence/provenance check → policy/authority check
 * → authorized domain service → persistent state update → audit event
 */
export interface MutationPipelineContext {
  tenantId: TenantId;
  patientId: PatientId;
  actorId: string;
  actorRole: string;
  authorityClass: AuthorityClass;
}

export class GovernedMutationPipeline {
  /**
   * Evaluates an AI candidate.
   * AI candidates have NO inherent authority and cannot directly mutate state.
   */
  public async evaluateCandidate(
    candidate: AICandidateResponse,
    context: MutationPipelineContext,
  ): Promise<{ status: "PROCEED_TO_CLINICIAN_REVIEW" | "REJECTED"; reason?: string }> {
    if (candidate.epistemicStatus === EpistemicStatus.CONFLICTED) {
      return {
        status: "REJECTED",
        reason: "Candidate contains conflicting evidence. Marked CONFLICTED.",
      };
    }

    if (candidate.sourceEvidenceIds.length === 0) {
      return {
        status: "REJECTED",
        reason:
          "Candidate lacks explicit evidence links. Absence of evidence cannot establish state.",
      };
    }

    return {
      status: "PROCEED_TO_CLINICIAN_REVIEW",
    };
  }
}
