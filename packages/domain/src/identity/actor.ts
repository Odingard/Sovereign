/**
 * @file Canonical Actor & Identity Model
 * @description Provider-independent identity representation enforcing strict machine vs human boundaries.
 * Invariant: AI agent runtime may possess an authenticated technical identity,
 * but can never become a source of clinical authority or self-assign human roles.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import type { ActorId, PatientId, TenantId } from "../common/identifiers.js";

export enum ActorKind {
  HUMAN_CLINICIAN = "HUMAN_CLINICIAN",
  HUMAN_STAFF = "HUMAN_STAFF",
  HUMAN_ADMIN = "HUMAN_ADMIN",
  SOVEREIGN_SERVICE = "SOVEREIGN_SERVICE",
  AI_AGENT_RUNTIME = "AI_AGENT_RUNTIME",
  EXTERNAL_SYSTEM = "EXTERNAL_SYSTEM",
  SYSTEM_ANONYMOUS = "SYSTEM_ANONYMOUS",
}

export interface ProfessionalCredential {
  readonly credentialId: string;
  readonly credentialType: "MD" | "DO" | "NP" | "PA" | "PHARMD" | "RN" | "MA" | "OTHER";
  readonly issuer: string;
  readonly jurisdiction: string;
  readonly licenseNumber?: string;
  readonly npi?: string;
  readonly privilegeReference?: string;
  readonly effectiveDate: Date;
  readonly expirationDate: Date;
  readonly isRevoked: boolean;
  readonly revocationReason?: string;
}

export enum RelationshipKind {
  CLINICAL_SUPERVISOR = "CLINICAL_SUPERVISOR",
  COLLABORATING_PHYSICIAN = "COLLABORATING_PHYSICIAN",
  PARENT_GUARDIAN = "PARENT_GUARDIAN",
  HEALTHCARE_PROXY = "HEALTHCARE_PROXY",
  DURABLE_POWER_OF_ATTORNEY = "DPOA",
  CARE_COORDINATOR = "CARE_COORDINATOR",
}

/**
 * Typed relationship target union ensuring ActorId and PatientId are strictly separated.
 * Clarification 2: PatientId and ActorId must never be confused or cast into one another.
 */
export type RelationshipTarget =
  | { readonly type: "ACTOR"; readonly targetActorId: ActorId }
  | { readonly type: "PATIENT"; readonly targetPatientId: PatientId };

/**
 * Factual representation of actor relationships.
 * Invariant: A relationship is not an authority grant.
 * Relationships represent facts only; they never confer execution authority.
 */
export interface ActorRelationship {
  readonly relationshipId: string;
  readonly sourceActorId: ActorId;
  readonly target: RelationshipTarget;
  readonly kind: RelationshipKind;
  readonly effectiveFrom: Date;
  readonly expiresAt?: Date;
  readonly referenceDocumentId?: string;
  readonly isVerified: boolean;
}

export interface ActorIdentity {
  readonly actorId: ActorId;
  readonly kind: ActorKind;
  readonly tenantId: TenantId;
  readonly displayName: string;
  readonly technicalSubjectId: string;
  readonly qualifications?: ReadonlyArray<ProfessionalCredential>;
  readonly relationships?: ReadonlyArray<ActorRelationship>;
  readonly systemAttribution?: string;
}

/**
 * Validates invariant constraints on ActorIdentity creation and mutation.
 */
export function assertValidActorIdentity(actor: ActorIdentity): void {
  if (!actor.actorId || actor.actorId.trim().length === 0) {
    throw new InvariantViolationError("ActorId cannot be empty.");
  }
  if (!actor.tenantId || actor.tenantId.trim().length === 0) {
    throw new InvariantViolationError("TenantId cannot be empty.");
  }
  if (!actor.technicalSubjectId || actor.technicalSubjectId.trim().length === 0) {
    throw new InvariantViolationError("TechnicalSubjectId cannot be empty.");
  }

  // AI & Service Machine Invariants
  if (actor.kind === ActorKind.AI_AGENT_RUNTIME || actor.kind === ActorKind.SOVEREIGN_SERVICE) {
    if (actor.qualifications && actor.qualifications.length > 0) {
      throw new InvariantViolationError(
        `Machine actor kind '${actor.kind}' cannot possess human professional qualifications or clinician credentials.`,
      );
    }
  }

  // Clinician Qualifications check
  if (actor.kind === ActorKind.HUMAN_CLINICIAN) {
    if (!actor.qualifications || actor.qualifications.length === 0) {
      throw new InvariantViolationError(
        "HUMAN_CLINICIAN actor identity must carry verified professional qualifications.",
      );
    }
  }
}
