/**
 * @file Append-Only Authorization Audit Model
 * @description Invariant: Authorization decisions are append-only.
 * Normal runtime roles must not be able to modify or delete historical authorization decisions.
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
import type { ActorKind } from "../identity/index.js";
import type {
  AuthorizationOutcome,
  AuthorizationReasonCode,
  AuthorizationReasonFacts,
} from "./authorization-decision.js";

export interface AuthorizationAuditRecord {
  readonly auditId: string;
  readonly decisionId: DecisionId;
  readonly tenantId: TenantId;
  readonly organizationUnitId?: OrganizationUnitId;
  readonly patientId?: PatientId;
  readonly actorId: ActorId;
  readonly actorKind: ActorKind;
  readonly technicalSubjectId: string;
  readonly requestedCapability: CapabilityIdentifier;
  readonly evaluatedAuthorityClass: AuthorityClass;
  readonly outcome: AuthorizationOutcome;
  readonly reasonCode: AuthorizationReasonCode;
  readonly reasonFacts: AuthorizationReasonFacts;
  readonly grantsConsidered: ReadonlyArray<AuthorityGrantId>;
  readonly evaluatedPolicyVersion: string;
  readonly correlationId: CorrelationId;
  readonly causationId: CausationId;
  readonly occurredAt: Date;
}

export interface AuthorizationAuditPort {
  appendDecision(record: AuthorizationAuditRecord): Promise<void>;
  getDecisionById(
    tenantId: TenantId,
    decisionId: DecisionId,
  ): Promise<AuthorizationAuditRecord | undefined>;
}
