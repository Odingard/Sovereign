/**
 * @file Contextual Authorization Decision & Typed Reason Model
 * @description Invariant: Clarification 3: Authorization decision facts must be typed.
 * Structured/discriminated reason facts associated with AuthorizationReasonCode.
 * Untyped JSON dictionaries are prohibited from authoritative decision semantics.
 */

import type { AuthorityClass } from "../common/authority-class.js";
import type {
  ActorId,
  AuthorityGrantId,
  CapabilityIdentifier,
  CausationId,
  CorrelationId,
  DecisionId,
  OrganizationUnitId,
  PatientId,
  TenantId,
} from "../common/identifiers.js";
import type { ActorKind, AuthoritativeSecurityContext } from "../identity/index.js";

export enum AuthorizationOutcome {
  PERMIT = "PERMIT",
  DENY = "DENY",
  REQUIRES_AUTHORITY = "REQUIRES_AUTHORITY",
  REQUIRES_HUMAN_REVIEW = "REQUIRES_HUMAN_REVIEW",
}

export enum AuthorizationReasonCode {
  AUTH_PERMITTED = "AUTH_PERMITTED",
  ERR_MISSING_TENANT = "ERR_MISSING_TENANT",
  ERR_CROSS_TENANT_VIOLATION = "ERR_CROSS_TENANT_VIOLATION",
  ERR_MISSING_PATIENT = "ERR_MISSING_PATIENT",
  ERR_CROSS_PATIENT_VIOLATION = "ERR_CROSS_PATIENT_VIOLATION",
  ERR_UNKNOWN_ACTOR = "ERR_UNKNOWN_ACTOR",
  ERR_UNKNOWN_CAPABILITY = "ERR_UNKNOWN_CAPABILITY",
  ERR_AWAITING_CLASS_C_CLINICIAN_GRANT = "ERR_AWAITING_CLASS_C_CLINICIAN_GRANT",
  ERR_GRANT_EXPIRED = "ERR_GRANT_EXPIRED",
  ERR_GRANT_REVOKED = "ERR_GRANT_REVOKED",
  ERR_DELEGATION_EXCEEDS_PARENT = "ERR_DELEGATION_EXCEEDS_PARENT",
  ERR_PARENT_GRANT_INVALID = "ERR_PARENT_GRANT_INVALID",
  ERR_AUTHORIZATION_BINDING_MISMATCH = "ERR_AUTHORIZATION_BINDING_MISMATCH",
  ERR_ISSUER_LACKS_ISSUANCE_AUTHORITY = "ERR_ISSUER_LACKS_ISSUANCE_AUTHORITY",
  ERR_ORG_UNIT_MISMATCH = "ERR_ORG_UNIT_MISMATCH",
  ERR_CLASS_D_HUMAN_ONLY = "ERR_CLASS_D_HUMAN_ONLY",
  ERR_EMERGENCY_ACCESS_UNCONFIGURED = "ERR_EMERGENCY_ACCESS_UNCONFIGURED",
  ERR_POLICY_SERVICE_UNAVAILABLE = "ERR_POLICY_SERVICE_UNAVAILABLE",
}

/**
 * Strongly-typed discriminated union for authorization decision facts.
 * Eliminates untyped JSON records from authoritative decision records.
 */
export type AuthorizationReasonFacts =
  | {
      readonly code: AuthorizationReasonCode.AUTH_PERMITTED;
      readonly grantId?: AuthorityGrantId;
      readonly capability: CapabilityIdentifier;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_MISSING_TENANT;
      readonly actorId?: ActorId;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_CROSS_TENANT_VIOLATION;
      readonly actorTenantId: TenantId;
      readonly resourceTenantId: TenantId;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_MISSING_PATIENT;
      readonly capability: CapabilityIdentifier;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_CROSS_PATIENT_VIOLATION;
      readonly contextPatientId?: PatientId;
      readonly resourcePatientId: PatientId;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_UNKNOWN_ACTOR;
      readonly actorId: ActorId;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_UNKNOWN_CAPABILITY;
      readonly capabilityName: string;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_AWAITING_CLASS_C_CLINICIAN_GRANT;
      readonly capability: CapabilityIdentifier;
      readonly requiredAuthorityClass: AuthorityClass;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_GRANT_EXPIRED;
      readonly grantId: AuthorityGrantId;
      readonly expiredAt: Date;
      readonly evaluatedAt: Date;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_GRANT_REVOKED;
      readonly grantId: AuthorityGrantId;
      readonly revokedAt: Date;
      readonly revokedBy: ActorId;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_DELEGATION_EXCEEDS_PARENT;
      readonly childGrantId: AuthorityGrantId;
      readonly parentGrantId: AuthorityGrantId;
      readonly detail: string;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_PARENT_GRANT_INVALID;
      readonly childGrantId: AuthorityGrantId;
      readonly parentGrantId: AuthorityGrantId;
      readonly parentStatus: string;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_AUTHORIZATION_BINDING_MISMATCH;
      readonly serverBindingType: string;
      readonly serverResourceId: string;
      readonly grantResourceId: string;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_ISSUER_LACKS_ISSUANCE_AUTHORITY;
      readonly issuerActorId: ActorId;
      readonly attemptedClass: AuthorityClass;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_ORG_UNIT_MISMATCH;
      readonly actorOrgUnitId?: OrganizationUnitId;
      readonly resourceOrgUnitId: OrganizationUnitId;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_CLASS_D_HUMAN_ONLY;
      readonly capability: CapabilityIdentifier;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_EMERGENCY_ACCESS_UNCONFIGURED;
      readonly requestId: string;
    }
  | {
      readonly code: AuthorizationReasonCode.ERR_POLICY_SERVICE_UNAVAILABLE;
      readonly policyReference?: string;
    };

export interface AuthorizationRequest {
  readonly securityContext: AuthoritativeSecurityContext;
  readonly requestedCapability: CapabilityIdentifier;
  readonly targetResource: {
    readonly aggregateType: string;
    readonly aggregateId: string;
    readonly targetTenantId: TenantId;
    readonly targetOrgUnitId?: OrganizationUnitId;
    readonly targetPatientId?: PatientId;
  };
  readonly claimedGrantIdHint?: AuthorityGrantId; // UNTRUSTED LOOKUP HINT ONLY
}

export interface AuthorizationDecision {
  readonly decisionId: DecisionId;
  readonly outcome: AuthorizationOutcome;
  readonly reasonCode: AuthorizationReasonCode;
  readonly reasonFacts: AuthorizationReasonFacts;
  readonly actorId: ActorId;
  readonly actorKind: ActorKind;
  readonly technicalSubjectId: string;
  readonly tenantId: TenantId;
  readonly organizationUnitId?: OrganizationUnitId;
  readonly patientId?: PatientId;
  readonly requestedCapability: CapabilityIdentifier;
  readonly evaluatedAuthorityClass: AuthorityClass;
  readonly grantsConsidered: ReadonlyArray<AuthorityGrantId>;
  readonly evaluatedPolicyVersion: string;
  readonly evaluatedAt: Date;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
  readonly auditLineageId: string;
}

export interface EmergencyAccessRequest {
  readonly requestId: string;
  readonly requestingActorId: ActorId;
  readonly tenantId: TenantId;
  readonly patientId: PatientId;
  readonly clinicalJustification: string;
  readonly requestedDurationMinutes: number;
}

export interface EmergencyAccessDecision {
  readonly decisionId: DecisionId;
  readonly outcome: AuthorizationOutcome;
  readonly reasonCode: AuthorizationReasonCode;
  readonly reasonFacts: AuthorizationReasonFacts;
  readonly evaluatedPolicyVersion: string;
  readonly auditReference: EmergencyAccessAuditReference;
}

export interface EmergencyAccessAuditReference {
  readonly auditId: string;
  readonly timestamp: Date;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
}
