import { z } from 'zod';
import {
  AuthorityClass,
  EpistemicStatus,
  LifecycleState
} from '@sovereign/domain';

/**
 * AI Reasoning Provider Port (ADR-0001, ADR-0006)
 * AI models are untrusted reasoning components. Outputs are candidates only.
 */
export const AICandidateRequestSchema = z.object({
  tenantId: z.string().min(1),
  patientContextId: z.string().min(1),
  taskType: z.enum(['EXTRACT_FACTS', 'DRAFT_DOCUMENTATION', 'CHECK_INTERACTION', 'FLAG_DISCREPANCY']),
  redactedInputPayload: z.record(z.unknown())
});

export type AICandidateRequest = z.infer<typeof AICandidateRequestSchema>;

export const AICandidateResponseSchema = z.object({
  candidateId: z.string().uuid(),
  modelIdentifier: z.string(),
  modelVersion: z.string(),
  confidenceScore: z.number().min(0).max(1).optional(),
  epistemicStatus: z.nativeEnum(EpistemicStatus),
  proposedStateCandidate: z.record(z.unknown()),
  sourceEvidenceIds: z.array(z.string()),
  disclaimer: z.literal('AI candidate carries no clinical authority; requires validation.')
});

export type AICandidateResponse = z.infer<typeof AICandidateResponseSchema>;

export interface AIReasoningProvider {
  readonly providerId: string;
  generateCandidate(request: AICandidateRequest): Promise<AICandidateResponse>;
}

/**
 * Workflow Runtime Port (ADR-0003, ADR-0006)
 * External engines (Temporal) orchestrate execution behind this port.
 * Sovereign PostgreSQL owns the authoritative Execution Graph.
 */
export interface WorkflowExecutionHandle {
  readonly workflowId: string;
  readonly runId: string;
  readonly scheduledAt: Date;
}

export interface WorkflowRuntime {
  readonly runtimeName: string;
  dispatchActivity(nodeId: string, payload: Record<string, unknown>): Promise<WorkflowExecutionHandle>;
  pauseExecution(workflowId: string, reason: string): Promise<void>;
  cancelExecution(workflowId: string, reason: string): Promise<void>;
}

/**
 * Authoritative Transaction Contract for Mutations
 */
export const MutationEnvelopeSchema = z.object({
  tenantId: z.string().min(1),
  patientId: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.string().min(1),
  authorityClass: z.nativeEnum(AuthorityClass),
  evidenceHashes: z.array(z.string()),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime()
});

export type MutationEnvelope = z.infer<typeof MutationEnvelopeSchema>;
