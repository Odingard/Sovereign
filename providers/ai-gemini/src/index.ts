import type {
  AICandidateRequest,
  AICandidateResponse,
  AIReasoningProvider,
} from "@sovereign/contracts";
import { EpistemicStatus } from "@sovereign/domain";

/**
 * Gemini Enterprise AI Reasoning Provider Adapter
 *
 * STATUS: RESEARCH / NOT APPROVED FOR PHI
 * BAA: Under legal review
 * RESIDENCY: US-only endpoints
 * ZERO-DATA-RETENTION: Mandatory
 */
export class GeminiReasoningProvider implements AIReasoningProvider {
  public readonly providerId = "google-gemini-enterprise";

  public async generateCandidate(_request: AICandidateRequest): Promise<AICandidateResponse> {
    throw new Error(
      "Gemini provider is in status RESEARCH / NOT APPROVED FOR PHI. Use providers/ai-fake for synthetic local development.",
    );
  }
}
