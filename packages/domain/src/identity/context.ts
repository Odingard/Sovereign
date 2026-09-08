/**
 * @file Authoritative Security Context & Organizational Scope
 * @description Server-resolved security context ensuring client/model inputs cannot forge context.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import type {
  ActorId,
  CausationId,
  CorrelationId,
  OrganizationUnitId,
  PatientId,
  TenantId,
} from "../common/identifiers.js";
import type { ActorIdentity } from "./actor.js";

export interface OrganizationUnit {
  readonly organizationUnitId: OrganizationUnitId;
  readonly tenantId: TenantId;
  readonly displayName: string;
  readonly physicalLocation?: {
    readonly facilityName: string;
    readonly state: string;
    readonly timeZone: string;
  };
  readonly parentUnitId?: OrganizationUnitId;
}

export interface ActorOrgUnitAssignment {
  readonly actorId: ActorId;
  readonly tenantId: TenantId;
  readonly organizationUnitId: OrganizationUnitId;
  readonly assignedRole: string;
  readonly isPrimary: boolean;
}

export interface AuthoritativeSecurityContext {
  readonly tenantId: TenantId;
  readonly organizationUnitId?: OrganizationUnitId;
  readonly patientId?: PatientId;
  readonly actor: ActorIdentity;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
  readonly resolvedAt: Date;
}

export function createAuthoritativeSecurityContext(params: {
  tenantId: string;
  actor: ActorIdentity;
  correlationId: string;
  causationId: string;
  organizationUnitId?: string;
  patientId?: string;
  resolvedAt?: Date;
}): AuthoritativeSecurityContext {
  if (!params.tenantId || params.tenantId.trim().length === 0) {
    throw new InvariantViolationError("TenantId cannot be empty in AuthoritativeSecurityContext.");
  }
  if (params.actor.tenantId !== params.tenantId) {
    throw new InvariantViolationError(
      `Actor tenant '${params.actor.tenantId}' does not match context tenant '${params.tenantId}'.`,
    );
  }

  return {
    tenantId: params.tenantId as TenantId,
    organizationUnitId: params.organizationUnitId
      ? (params.organizationUnitId as OrganizationUnitId)
      : undefined,
    patientId: params.patientId ? (params.patientId as PatientId) : undefined,
    actor: params.actor,
    correlationId: params.correlationId as CorrelationId,
    causationId: params.causationId as CausationId,
    resolvedAt: params.resolvedAt ?? new Date(),
  };
}
