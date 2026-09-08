/**
 * @file Scoped, Revocable Authority Grant Model
 * @description Invariant: Grant lifecycle facts have one source of truth.
 * Revocation is authoritative from the revocation record.
 * Expiration is authoritative from temporal boundaries evaluated using trusted server time.
 */

import type { AuthorityClass } from "../common/authority-class.js";
import { InvariantViolationError } from "../common/domain-error.js";
import type {
  ActorId,
  AuthorityGrantId,
  CapabilityIdentifier,
  CausationId,
  CorrelationId,
  OrganizationUnitId,
  PatientId,
  TenantId,
} from "../common/identifiers.js";
import type { AuthorizationBinding } from "./authorization-binding.js";

export enum AuthorityGrantStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED",
  NOT_YET_EFFECTIVE = "NOT_YET_EFFECTIVE",
}

export interface GrantRevocationRecord {
  readonly revokedAt: Date;
  readonly revokedByActorId: ActorId;
  readonly reasonCode: string;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
}

export interface AuthorityGrant {
  readonly grantId: AuthorityGrantId;
  readonly tenantId: TenantId;
  readonly organizationUnitScope?: OrganizationUnitId;
  readonly patientIdScope?: PatientId;
  readonly targetResourceScope?: {
    readonly aggregateType: string;
    readonly aggregateId: string;
  };
  readonly requiredAuthorityClass: AuthorityClass;
  readonly issuerActorId: ActorId;
  readonly granteeActorId: ActorId;
  readonly permittedCapability: CapabilityIdentifier;
  readonly authorizationBinding?: AuthorizationBinding;
  readonly effectiveFrom: Date;
  readonly expiresAt: Date;
  readonly parentGrantId?: AuthorityGrantId;
  readonly sourceReference?: string;
  readonly revocation?: GrantRevocationRecord;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
  readonly auditLineageId: string;
  readonly schemaVersion: number;
}

/**
 * Authoritative lifecycle status computation.
 * Single source of truth: revocation record + temporal boundary with trusted server time.
 */
export function computeGrantLifecycleStatus(
  grant: AuthorityGrant,
  serverNow: Date,
): AuthorityGrantStatus {
  if (grant.revocation !== undefined) {
    return AuthorityGrantStatus.REVOKED;
  }
  if (serverNow.getTime() > grant.expiresAt.getTime()) {
    return AuthorityGrantStatus.EXPIRED;
  }
  if (serverNow.getTime() < grant.effectiveFrom.getTime()) {
    return AuthorityGrantStatus.NOT_YET_EFFECTIVE;
  }
  return AuthorityGrantStatus.ACTIVE;
}

export function isGrantRevoked(grant: AuthorityGrant): boolean {
  return grant.revocation !== undefined;
}

export function isGrantExpired(grant: AuthorityGrant, serverNow: Date): boolean {
  return serverNow.getTime() > grant.expiresAt.getTime();
}

export function isGrantEffective(grant: AuthorityGrant, serverNow: Date): boolean {
  return (
    !isGrantRevoked(grant) &&
    serverNow.getTime() >= grant.effectiveFrom.getTime() &&
    serverNow.getTime() <= grant.expiresAt.getTime()
  );
}

/**
 * Validates invariant constraints on AuthorityGrant creation.
 */
export function assertValidAuthorityGrant(grant: AuthorityGrant): void {
  if (!grant.grantId || grant.grantId.trim().length === 0) {
    throw new InvariantViolationError("GrantId cannot be empty.");
  }
  if (!grant.tenantId || grant.tenantId.trim().length === 0) {
    throw new InvariantViolationError("TenantId cannot be empty.");
  }
  if (!grant.issuerActorId || grant.issuerActorId.trim().length === 0) {
    throw new InvariantViolationError("IssuerActorId cannot be empty.");
  }
  if (!grant.granteeActorId || grant.granteeActorId.trim().length === 0) {
    throw new InvariantViolationError("GranteeActorId cannot be empty.");
  }
  if (grant.expiresAt.getTime() <= grant.effectiveFrom.getTime()) {
    throw new InvariantViolationError(
      `Invalid temporal boundary: expiresAt (${grant.expiresAt.toISOString()}) must be after effectiveFrom (${grant.effectiveFrom.toISOString()}).`,
    );
  }
}

/**
 * Validates child/delegated grant constraints against the parent grant.
 * Invariant: Delegated grants cannot outlive or exceed parent scope.
 */
export function assertValidDelegation(
  childGrant: AuthorityGrant,
  parentGrant: AuthorityGrant,
): void {
  if (childGrant.tenantId !== parentGrant.tenantId) {
    throw new InvariantViolationError(
      `Delegation tenant mismatch: child '${childGrant.tenantId}' vs parent '${parentGrant.tenantId}'.`,
    );
  }

  if (childGrant.permittedCapability !== parentGrant.permittedCapability) {
    throw new InvariantViolationError(
      `Delegation capability expansion: child requested '${childGrant.permittedCapability}', but parent only holds '${parentGrant.permittedCapability}'.`,
    );
  }

  if (childGrant.expiresAt.getTime() > parentGrant.expiresAt.getTime()) {
    throw new InvariantViolationError(
      `Delegation duration violation: child grant expires at ${childGrant.expiresAt.toISOString()}, which outlives parent grant expiring at ${parentGrant.expiresAt.toISOString()}.`,
    );
  }

  // If parent is patient-scoped, child must match
  if (parentGrant.patientIdScope && childGrant.patientIdScope !== parentGrant.patientIdScope) {
    throw new InvariantViolationError(
      `Delegation patient scope violation: child '${childGrant.patientIdScope}' exceeds parent scope '${parentGrant.patientIdScope}'.`,
    );
  }

  // If parent is org-unit scoped, child must match
  if (
    parentGrant.organizationUnitScope &&
    childGrant.organizationUnitScope !== parentGrant.organizationUnitScope
  ) {
    throw new InvariantViolationError(
      `Delegation org-unit scope violation: child '${childGrant.organizationUnitScope}' exceeds parent scope '${parentGrant.organizationUnitScope}'.`,
    );
  }
}
