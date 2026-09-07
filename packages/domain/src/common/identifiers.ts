/**
 * @file Stable Branded Identifiers & Multi-Tenant Context
 * @description Type-safe branded strings preventing accidental identifier substitution.
 */

import { PatientIsolationError, TenantIsolationError } from "./domain-error.js";

export type Brand<K, T> = K & { readonly __brand: T };

export type TenantId = Brand<string, "TenantId">;
export type PatientId = Brand<string, "PatientId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type ClinicalStateId = Brand<string, "ClinicalStateId">;
export type IntentId = Brand<string, "IntentId">;
export type ExecutionGraphId = Brand<string, "ExecutionGraphId">;
export type ExecutionNodeId = Brand<string, "ExecutionNodeId">;
export type ExecutionAttemptId = Brand<string, "ExecutionAttemptId">;
export type ConfirmationId = Brand<string, "ConfirmationId">;
export type TherapyAccessCaseId = Brand<string, "TherapyAccessCaseId">;
export type ActorId = Brand<string, "ActorId">;
export type EventId = Brand<string, "EventId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type CausationId = Brand<string, "CausationId">;

/**
 * Server-resolved tenant and patient security context.
 * Invariant: Every patient-scoped authoritative aggregate carries TenantPatientContext.
 */
export interface TenantPatientContext {
  readonly tenantId: TenantId;
  readonly patientId: PatientId;
}

export function createTenantPatientContext(
  tenantId: string,
  patientId: string,
): TenantPatientContext {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new Error("TenantId cannot be empty.");
  }
  if (!patientId || patientId.trim().length === 0) {
    throw new Error("PatientId cannot be empty.");
  }
  return {
    tenantId: tenantId as TenantId,
    patientId: patientId as PatientId,
  };
}

export function assertStrictTenantAndPatientMatch(
  expected: TenantPatientContext,
  actual: TenantPatientContext,
  entityDescription = "Entity",
): void {
  if (expected.tenantId !== actual.tenantId) {
    throw new TenantIsolationError(
      `Tenant isolation breach: ${entityDescription} has tenant '${actual.tenantId}', but expected tenant '${expected.tenantId}'.`,
    );
  }
  if (expected.patientId !== actual.patientId) {
    throw new PatientIsolationError(
      `Patient isolation breach: ${entityDescription} has patient '${actual.patientId}', but expected patient '${expected.patientId}'.`,
    );
  }
}
