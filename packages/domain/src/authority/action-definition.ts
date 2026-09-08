/**
 * @file Server-Resolved Action Definitions & Security Requirements
 * @description Invariant: The requester does not define the security requirements for its own request.
 * Sovereign independently resolves the required AuthorityClass, patient context, organizational scope,
 * and binding requirements from trusted ActionDefinition registries.
 */

import { AuthorityClass } from "../common/authority-class.js";
import { InvariantViolationError } from "../common/domain-error.js";
import type { CapabilityIdentifier } from "../common/identifiers.js";
import { CanonicalCapabilities } from "./capabilities.js";

export interface ActionDefinition {
  readonly capability: CapabilityIdentifier;
  readonly requiredAuthorityClass: AuthorityClass;
  readonly requiresPatientContext: boolean;
  readonly requiresOrganizationScope: boolean;
  readonly requiresAuthorizationBinding: boolean;
  readonly requiredEvidenceCategories?: ReadonlyArray<string>;
  readonly defaultPolicyReference?: string;
  readonly description: string;
}

export interface ActionDefinitionRegistry {
  getDefinition(capability: CapabilityIdentifier): ActionDefinition | undefined;
  assertDefinition(capability: CapabilityIdentifier): ActionDefinition;
  registerDefinition(definition: ActionDefinition): void;
}

export class DefaultActionDefinitionRegistry implements ActionDefinitionRegistry {
  private readonly definitions = new Map<string, ActionDefinition>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // 1. Admin Tenant Manage (Class A - Non-patient admin)
    this.registerDefinition({
      capability: CanonicalCapabilities.ADMIN_TENANT_MANAGE,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: false,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Manage tenant configurations and organizational units.",
    });

    // 2. Admin Audit Read (Class A - Non-patient admin)
    this.registerDefinition({
      capability: CanonicalCapabilities.ADMIN_AUDIT_READ,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: false,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Read system authorization audit logs.",
    });

    // 3. Clinical State Read (Class A - Patient-scoped informational)
    this.registerDefinition({
      capability: CanonicalCapabilities.CLINICAL_STATE_READ,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Read authoritative patient clinical state.",
    });

    // 4. Clinical Evidence Read (Class A - Patient-scoped informational)
    this.registerDefinition({
      capability: CanonicalCapabilities.EVIDENCE_READ,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Read authoritative clinical evidence documents.",
    });

    // 5. Propose Candidate Evidence (Class A - Patient-scoped preparation)
    this.registerDefinition({
      capability: CanonicalCapabilities.EVIDENCE_PROPOSE,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Propose candidate evidence for verification.",
    });

    // 6. Propose Intent (Class A - Patient-scoped clinical intent proposal)
    this.registerDefinition({
      capability: CanonicalCapabilities.INTENT_PROPOSE,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Propose candidate clinical intent for clinician decision.",
    });

    // 7. Plan Execution Graph (Class A - Patient-scoped planning from decided intent)
    this.registerDefinition({
      capability: CanonicalCapabilities.EXECUTION_GRAPH_PLAN,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Construct execution graph from decided/authorized intent.",
    });

    // 8. Order Sign Transaction (Class C - Transactional clinical order)
    this.registerDefinition({
      capability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: true,
      description: "Authorize and execute a transactional clinical order/prescription.",
    });

    // 9. Prior Auth Authorize Submission (Class C - Transactional PA submission)
    this.registerDefinition({
      capability: CanonicalCapabilities.PRIOR_AUTH_AUTHORIZE_SUBMISSION,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: true,
      description: "Authorize external submission of a prior authorization packet.",
    });

    // 10. Issue Class C Authority Grant (Class C - Clinician authority issuance)
    this.registerDefinition({
      capability: CanonicalCapabilities.AUTHORITY_GRANT_ISSUE_CLASS_C,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      requiresPatientContext: true,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: true,
      description: "Issue an authoritative Class C clinician grant.",
    });

    // 11. Revoke Authority Grant (Class A/C - Revocation action)
    this.registerDefinition({
      capability: CanonicalCapabilities.AUTHORITY_GRANT_REVOKE,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      requiresPatientContext: false,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Revoke an existing authority grant.",
    });

    // 12. Policy Configure Class B (Class B - Autonomous delegation configuration)
    this.registerDefinition({
      capability: CanonicalCapabilities.POLICY_CONFIGURE_CLASS_B,
      requiredAuthorityClass: AuthorityClass.CLASS_B_ORG_POLICY,
      requiresPatientContext: false,
      requiresOrganizationScope: false,
      requiresAuthorizationBinding: false,
      description: "Configure organizational policy bounds for autonomous execution.",
    });
  }

  public registerDefinition(definition: ActionDefinition): void {
    this.definitions.set(definition.capability, Object.freeze({ ...definition }));
  }

  public getDefinition(capability: CapabilityIdentifier): ActionDefinition | undefined {
    return this.definitions.get(capability);
  }

  public assertDefinition(capability: CapabilityIdentifier): ActionDefinition {
    const def = this.getDefinition(capability);
    if (!def) {
      throw new InvariantViolationError(
        `Security requirement resolution failed: unknown capability '${capability}'.`,
      );
    }
    return def;
  }
}
