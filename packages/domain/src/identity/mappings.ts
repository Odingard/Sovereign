/**
 * @file External Identity & Patient Identifier Mappings
 * @description Maps external enterprise and IdP identifiers to canonical Sovereign entities.
 * Invariant: Patient matching establishes identity correlation only; it does not confer access authority.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import type { ActorId, PatientId, TenantId } from "../common/identifiers.js";

export interface ActorIdentityMapping {
  readonly mappingId: string;
  readonly tenantId: TenantId;
  readonly idpIssuer: string;
  readonly idpSubject: string;
  readonly actorId: ActorId;
  readonly mappedAt: Date;
}

export interface PatientIdentityMapping {
  readonly mappingId: string;
  readonly tenantId: TenantId;
  readonly externalSystem: string;
  readonly externalPatientId: string;
  readonly patientId: PatientId;
  readonly mappedAt: Date;
}

export function assertValidActorIdentityMapping(mapping: ActorIdentityMapping): void {
  if (!mapping.tenantId || mapping.tenantId.trim().length === 0) {
    throw new InvariantViolationError("Actor identity mapping must include a valid tenantId.");
  }
  if (!mapping.idpIssuer || mapping.idpIssuer.trim().length === 0) {
    throw new InvariantViolationError("Actor identity mapping must include idpIssuer.");
  }
  if (!mapping.idpSubject || mapping.idpSubject.trim().length === 0) {
    throw new InvariantViolationError("Actor identity mapping must include idpSubject.");
  }
}

export function assertValidPatientIdentityMapping(mapping: PatientIdentityMapping): void {
  if (!mapping.tenantId || mapping.tenantId.trim().length === 0) {
    throw new InvariantViolationError("Patient identity mapping must include a valid tenantId.");
  }
  if (!mapping.externalSystem || mapping.externalSystem.trim().length === 0) {
    throw new InvariantViolationError("Patient identity mapping must include externalSystem.");
  }
  if (!mapping.externalPatientId || mapping.externalPatientId.trim().length === 0) {
    throw new InvariantViolationError("Patient identity mapping must include externalPatientId.");
  }
}
