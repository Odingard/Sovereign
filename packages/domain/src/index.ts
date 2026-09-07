/**
 * @file Sovereign Canonical Domain Core
 * @description Pure domain entities, value objects, and invariant primitives.
 *
 * DOCTRINE:
 * 1. Sovereign will never be the doctor.
 * 2. The clinician decides; Sovereign makes the decision executable.
 * 3. The model is not the system of record.
 * 4. AI may propose; AI may not directly mutate state or execute external actions.
 *
 * ARCHITECTURAL RULE:
 * This package must NEVER import any AI provider SDK, cloud SDK, workflow engine SDK, or vendor schema.
 */

export type Brand<K, T> = K & { readonly __brand: T };

export type TenantId = Brand<string, 'TenantId'>;
export type PatientId = Brand<string, 'PatientId'>;
export type EvidenceId = Brand<string, 'EvidenceId'>;
export type IntentId = Brand<string, 'IntentId'>;
export type ExecutionNodeId = Brand<string, 'ExecutionNodeId'>;
export type TherapyAccessCaseId = Brand<string, 'TherapyAccessCaseId'>;

/**
 * Epistemic truth values:
 * Unknown is NEVER negative. Absence of evidence is not evidence of absence.
 */
export enum EpistemicStatus {
  KNOWN = 'KNOWN',
  UNKNOWN = 'UNKNOWN',
  CONFLICTED = 'CONFLICTED',
  REQUIRES_CLINICAL_DECISION = 'REQUIRES_CLINICAL_DECISION'
}

/**
 * Distinct lifecycle states.
 * Task execution or worker completion is NOT clinical completion.
 */
export enum LifecycleState {
  ATTEMPTED = 'ATTEMPTED',
  TRANSMITTED = 'TRANSMITTED',
  RECEIVED = 'RECEIVED',
  ACCEPTED = 'ACCEPTED',
  INITIATED = 'INITIATED',
  COMPLETED = 'COMPLETED',
  SUPERSEDED = 'SUPERSEDED',
  CANCELLED = 'CANCELLED'
}

/**
 * Sovereign Authority Classes (ADR-0005)
 */
export enum AuthorityClass {
  CLASS_A_AUTONOMOUS_ADMIN = 'CLASS_A_AUTONOMOUS_ADMIN',
  CLASS_B_ORG_POLICY = 'CLASS_B_ORG_POLICY',
  CLASS_C_CLINICIAN_AUTH = 'CLASS_C_CLINICIAN_AUTH',
  CLASS_D_CLINICAL_JUDGMENT = 'CLASS_D_CLINICAL_JUDGMENT'
}

/**
 * Five Authoritative Domain Objects owned by Sovereign
 */
export const AUTHORITATIVE_OBJECT_TYPES = [
  'CLINICAL_STATE',
  'CLINICAL_EVIDENCE_PROVENANCE',
  'CLINICAL_INTENT',
  'EXECUTION_GRAPH',
  'THERAPY_ACCESS_STATE'
] as const;

export type AuthoritativeObjectType = (typeof AUTHORITATIVE_OBJECT_TYPES)[number];
