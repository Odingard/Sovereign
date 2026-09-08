/**
 * @file Sovereign Contextual Authorization Evaluator
 * @description Invariant: The requester does not define the security requirements for its own request.
 * Server resolves action definition, derives required authority class, loads authoritative grants,
 * validates server-resolved bindings, and fails closed on any ambiguity.
 */

import { AuthorityClass } from "../common/authority-class.js";
import type { AuthorityGrantId, CapabilityIdentifier, DecisionId } from "../common/identifiers.js";
import { ActorKind } from "../identity/actor.js";
import type { ActionDefinitionRegistry } from "./action-definition.js";
import {
  type AuthorityGrant,
  isGrantEffective,
  isGrantExpired,
  isGrantRevoked,
} from "./authority-grant.js";
import {
  type AuthorizationBinding,
  assertAuthorizationBindingsMatch,
} from "./authorization-binding.js";
import {
  type AuthorizationDecision,
  AuthorizationOutcome,
  AuthorizationReasonCode,
  type AuthorizationReasonFacts,
  type AuthorizationRequest,
} from "./authorization-decision.js";

export interface AuthorizationEvaluator {
  evaluate(
    request: AuthorizationRequest,
    serverResolvedBinding?: AuthorizationBinding,
    contextOptions?: {
      serverNow?: Date;
      grants?: ReadonlyArray<AuthorityGrant>;
      parentGrants?: ReadonlyMap<string, AuthorityGrant>;
    },
  ): Promise<AuthorizationDecision>;
}

export class DefaultAuthorizationEvaluator implements AuthorizationEvaluator {
  constructor(private readonly actionRegistry: ActionDefinitionRegistry) {}

  public async evaluate(
    request: AuthorizationRequest,
    serverResolvedBinding?: AuthorizationBinding,
    contextOptions?: {
      serverNow?: Date;
      grants?: ReadonlyArray<AuthorityGrant>;
      parentGrants?: ReadonlyMap<string, AuthorityGrant>;
    },
  ): Promise<AuthorizationDecision> {
    const serverNow = contextOptions?.serverNow ?? new Date();
    const decisionId =
      `dec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as DecisionId;
    const { securityContext, requestedCapability, targetResource } = request;

    // 1. Resolve ActionDefinition independently (server-resolved requirements)
    const actionDef = this.actionRegistry.getDefinition(requestedCapability);
    if (!actionDef) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
        outcome: AuthorizationOutcome.DENY,
        reasonCode: AuthorizationReasonCode.ERR_UNKNOWN_CAPABILITY,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_UNKNOWN_CAPABILITY,
          capabilityName: requestedCapability,
        },
        evaluatedAt: serverNow,
        grantsConsidered: [],
      });
    }

    const requiredAuthorityClass = actionDef.requiredAuthorityClass;

    // 2. Tenancy Validation (Fail closed on missing or mismatched tenant)
    if (!securityContext.tenantId || securityContext.tenantId.trim().length === 0) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.DENY,
        reasonCode: AuthorizationReasonCode.ERR_MISSING_TENANT,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_MISSING_TENANT,
          actorId: securityContext.actor.actorId,
        },
        evaluatedAt: serverNow,
        grantsConsidered: [],
      });
    }

    if (securityContext.tenantId !== targetResource.targetTenantId) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.DENY,
        reasonCode: AuthorizationReasonCode.ERR_CROSS_TENANT_VIOLATION,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_CROSS_TENANT_VIOLATION,
          actorTenantId: securityContext.tenantId,
          resourceTenantId: targetResource.targetTenantId,
        },
        evaluatedAt: serverNow,
        grantsConsidered: [],
      });
    }

    // 3. Patient Context Validation
    if (actionDef.requiresPatientContext) {
      if (!securityContext.patientId) {
        return this.createDecision({
          decisionId,
          request,
          evaluatedAuthorityClass: requiredAuthorityClass,
          outcome: AuthorizationOutcome.DENY,
          reasonCode: AuthorizationReasonCode.ERR_MISSING_PATIENT,
          reasonFacts: {
            code: AuthorizationReasonCode.ERR_MISSING_PATIENT,
            capability: requestedCapability,
          },
          evaluatedAt: serverNow,
          grantsConsidered: [],
        });
      }

      if (
        targetResource.targetPatientId &&
        securityContext.patientId !== targetResource.targetPatientId
      ) {
        return this.createDecision({
          decisionId,
          request,
          evaluatedAuthorityClass: requiredAuthorityClass,
          outcome: AuthorizationOutcome.DENY,
          reasonCode: AuthorizationReasonCode.ERR_CROSS_PATIENT_VIOLATION,
          reasonFacts: {
            code: AuthorizationReasonCode.ERR_CROSS_PATIENT_VIOLATION,
            contextPatientId: securityContext.patientId,
            resourcePatientId: targetResource.targetPatientId,
          },
          evaluatedAt: serverNow,
          grantsConsidered: [],
        });
      }
    }

    // 4. Organizational Unit Validation
    if (actionDef.requiresOrganizationScope && targetResource.targetOrgUnitId) {
      if (securityContext.organizationUnitId !== targetResource.targetOrgUnitId) {
        return this.createDecision({
          decisionId,
          request,
          evaluatedAuthorityClass: requiredAuthorityClass,
          outcome: AuthorizationOutcome.DENY,
          reasonCode: AuthorizationReasonCode.ERR_ORG_UNIT_MISMATCH,
          reasonFacts: {
            code: AuthorizationReasonCode.ERR_ORG_UNIT_MISMATCH,
            actorOrgUnitId: securityContext.organizationUnitId,
            resourceOrgUnitId: targetResource.targetOrgUnitId,
          },
          evaluatedAt: serverNow,
          grantsConsidered: [],
        });
      }
    }

    // 5. Class D Clinical Judgment - Strictly Human Only
    if (requiredAuthorityClass === AuthorityClass.CLASS_D_CLINICAL_JUDGMENT) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.REQUIRES_HUMAN_REVIEW,
        reasonCode: AuthorizationReasonCode.ERR_CLASS_D_HUMAN_ONLY,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_CLASS_D_HUMAN_ONLY,
          capability: requestedCapability,
        },
        evaluatedAt: serverNow,
        grantsConsidered: [],
      });
    }

    // 6. Class A Autonomous Admin
    if (requiredAuthorityClass === AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.PERMIT,
        reasonCode: AuthorizationReasonCode.AUTH_PERMITTED,
        reasonFacts: {
          code: AuthorizationReasonCode.AUTH_PERMITTED,
          capability: requestedCapability,
        },
        evaluatedAt: serverNow,
        grantsConsidered: [],
      });
    }

    // 7. Class B & Class C Authority Evaluation (Requires Valid Authority Grant)
    const claimedHint = request.claimedGrantIdHint;
    const availableGrants = contextOptions?.grants ?? [];
    const grant = claimedHint
      ? availableGrants.find((g) => g.grantId === claimedHint)
      : availableGrants.find(
          (g) =>
            g.tenantId === securityContext.tenantId &&
            g.permittedCapability === requestedCapability &&
            (!g.patientIdScope || g.patientIdScope === securityContext.patientId),
        );

    if (!grant) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.REQUIRES_AUTHORITY,
        reasonCode: AuthorizationReasonCode.ERR_AWAITING_CLASS_C_CLINICIAN_GRANT,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_AWAITING_CLASS_C_CLINICIAN_GRANT,
          capability: requestedCapability,
          requiredAuthorityClass,
        },
        evaluatedAt: serverNow,
        grantsConsidered: [],
      });
    }

    const grantsConsidered: ReadonlyArray<AuthorityGrantId> = [grant.grantId];

    // Check Issuer Authority Invariant: HUMAN_ADMIN alone cannot issue Class C authority
    if (requiredAuthorityClass === AuthorityClass.CLASS_C_CLINICIAN_AUTH) {
      if (
        grant.issuerActorId === securityContext.actor.actorId &&
        securityContext.actor.kind === ActorKind.HUMAN_ADMIN
      ) {
        return this.createDecision({
          decisionId,
          request,
          evaluatedAuthorityClass: requiredAuthorityClass,
          outcome: AuthorizationOutcome.DENY,
          reasonCode: AuthorizationReasonCode.ERR_ISSUER_LACKS_ISSUANCE_AUTHORITY,
          reasonFacts: {
            code: AuthorizationReasonCode.ERR_ISSUER_LACKS_ISSUANCE_AUTHORITY,
            issuerActorId: grant.issuerActorId,
            attemptedClass: requiredAuthorityClass,
          },
          evaluatedAt: serverNow,
          grantsConsidered,
        });
      }
    }

    // Check Revocation (Authoritative single source of truth: grant.revocation !== undefined)
    if (isGrantRevoked(grant)) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.DENY,
        reasonCode: AuthorizationReasonCode.ERR_GRANT_REVOKED,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_GRANT_REVOKED,
          grantId: grant.grantId,
          revokedAt: grant.revocation!.revokedAt,
          revokedBy: grant.revocation!.revokedByActorId,
        },
        evaluatedAt: serverNow,
        grantsConsidered,
      });
    }

    // Check Expiration (Authoritative temporal evaluation using server time)
    if (isGrantExpired(grant, serverNow)) {
      return this.createDecision({
        decisionId,
        request,
        evaluatedAuthorityClass: requiredAuthorityClass,
        outcome: AuthorizationOutcome.REQUIRES_AUTHORITY,
        reasonCode: AuthorizationReasonCode.ERR_GRANT_EXPIRED,
        reasonFacts: {
          code: AuthorizationReasonCode.ERR_GRANT_EXPIRED,
          grantId: grant.grantId,
          expiredAt: grant.expiresAt,
          evaluatedAt: serverNow,
        },
        evaluatedAt: serverNow,
        grantsConsidered,
      });
    }

    // Check Delegation Chain: Parent grant must not be revoked or expired
    if (grant.parentGrantId && contextOptions?.parentGrants) {
      const parent = contextOptions.parentGrants.get(grant.parentGrantId);
      if (parent) {
        if (isGrantRevoked(parent) || isGrantExpired(parent, serverNow)) {
          return this.createDecision({
            decisionId,
            request,
            evaluatedAuthorityClass: requiredAuthorityClass,
            outcome: AuthorizationOutcome.DENY,
            reasonCode: AuthorizationReasonCode.ERR_PARENT_GRANT_INVALID,
            reasonFacts: {
              code: AuthorizationReasonCode.ERR_PARENT_GRANT_INVALID,
              childGrantId: grant.grantId,
              parentGrantId: parent.grantId,
              parentStatus: isGrantRevoked(parent) ? "REVOKED" : "EXPIRED",
            },
            evaluatedAt: serverNow,
            grantsConsidered,
          });
        }
      }
    }

    // Check Authorization Binding (Clarification 1: Server-resolved binding check)
    if (actionDef.requiresAuthorizationBinding) {
      if (!grant.authorizationBinding || !serverResolvedBinding) {
        return this.createDecision({
          decisionId,
          request,
          evaluatedAuthorityClass: requiredAuthorityClass,
          outcome: AuthorizationOutcome.DENY,
          reasonCode: AuthorizationReasonCode.ERR_AUTHORIZATION_BINDING_MISMATCH,
          reasonFacts: {
            code: AuthorizationReasonCode.ERR_AUTHORIZATION_BINDING_MISMATCH,
            serverBindingType: serverResolvedBinding?.bindingType ?? "NONE",
            serverResourceId: serverResolvedBinding?.resourceIdentifier ?? "NONE",
            grantResourceId: grant.authorizationBinding?.resourceIdentifier ?? "NONE",
          },
          evaluatedAt: serverNow,
          grantsConsidered,
        });
      }

      try {
        assertAuthorizationBindingsMatch(serverResolvedBinding, grant.authorizationBinding);
      } catch {
        return this.createDecision({
          decisionId,
          request,
          evaluatedAuthorityClass: requiredAuthorityClass,
          outcome: AuthorizationOutcome.DENY,
          reasonCode: AuthorizationReasonCode.ERR_AUTHORIZATION_BINDING_MISMATCH,
          reasonFacts: {
            code: AuthorizationReasonCode.ERR_AUTHORIZATION_BINDING_MISMATCH,
            serverBindingType: serverResolvedBinding.bindingType,
            serverResourceId: serverResolvedBinding.resourceIdentifier,
            grantResourceId: grant.authorizationBinding.resourceIdentifier,
          },
          evaluatedAt: serverNow,
          grantsConsidered,
        });
      }
    }

    // All checks passed
    return this.createDecision({
      decisionId,
      request,
      evaluatedAuthorityClass: requiredAuthorityClass,
      outcome: AuthorizationOutcome.PERMIT,
      reasonCode: AuthorizationReasonCode.AUTH_PERMITTED,
      reasonFacts: {
        code: AuthorizationReasonCode.AUTH_PERMITTED,
        grantId: grant.grantId,
        capability: requestedCapability,
      },
      evaluatedAt: serverNow,
      grantsConsidered,
    });
  }

  private createDecision(params: {
    decisionId: DecisionId;
    request: AuthorizationRequest;
    evaluatedAuthorityClass: AuthorityClass;
    outcome: AuthorizationOutcome;
    reasonCode: AuthorizationReasonCode;
    reasonFacts: AuthorizationReasonFacts;
    evaluatedAt: Date;
    grantsConsidered: ReadonlyArray<AuthorityGrantId>;
  }): AuthorizationDecision {
    const { securityContext, requestedCapability } = params.request;
    return {
      decisionId: params.decisionId,
      outcome: params.outcome,
      reasonCode: params.reasonCode,
      reasonFacts: params.reasonFacts,
      actorId: securityContext.actor.actorId,
      actorKind: securityContext.actor.kind,
      technicalSubjectId: securityContext.actor.technicalSubjectId,
      tenantId: securityContext.tenantId,
      organizationUnitId: securityContext.organizationUnitId,
      patientId: securityContext.patientId,
      requestedCapability,
      evaluatedAuthorityClass: params.evaluatedAuthorityClass,
      grantsConsidered: params.grantsConsidered,
      evaluatedPolicyVersion: "sovereign-core-v0.1",
      evaluatedAt: params.evaluatedAt,
      correlationId: securityContext.correlationId,
      causationId: securityContext.causationId,
      auditLineageId: `audit-lin-${params.decisionId}`,
    };
  }
}
