import { randomUUID } from 'node:crypto';
import { EpistemicStatus } from '@sovereign/domain';
import type {
  AICandidateRequest,
  AICandidateResponse,
  AIReasoningProvider
} from '@sovereign/contracts';

/**
 * Deterministic Fake AI Provider
 *
 * DOCTRINE:
 * Generates synthetic candidates for local development and CI evaluations.
 * Contains zero network calls, zero credentials, zero PHI.
 */
export class FakeAIReasoningProvider implements AIReasoningProvider {
  public readonly providerId = 'sovereign-fake-ai-v1';

  public async generateCandidate(request: AICandidateRequest): Promise<AICandidateResponse> {
    return {
      candidateId: randomUUID(),
      modelIdentifier: this.providerId,
      modelVersion: '1.0.0-synthetic',
      confidenceScore: 0.95,
      epistemicStatus: EpistemicStatus.KNOWN,
      proposedStateCandidate: {
        task: request.taskType,
        syntheticObservation: 'Rheumatoid arthritis moderate disease activity (CDAI 14.5)',
        syntheticEvidenceReference: 'EVD-SYN-001'
      },
      sourceEvidenceIds: ['EVD-SYN-001'],
      disclaimer: 'AI candidate carries no clinical authority; requires validation.'
    };
  }
}
