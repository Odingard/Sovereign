/**
 * @file Sovereign Capability Model & Controlled Registry
 * @description Branded capability identifiers and candidate capability bundles.
 * Invariant: A role is a bundle of candidate capabilities, not an authority grant.
 */

import { InvariantViolationError } from "../common/domain-error.js";
import type { CapabilityIdentifier, TenantId } from "../common/identifiers.js";

export function createCapabilityIdentifier(name: string): CapabilityIdentifier {
  const capabilityPattern = /^[a-z_]+:[a-z_]+$/;
  if (!capabilityPattern.test(name)) {
    throw new InvariantViolationError(
      `Invalid capability format '${name}'. Capability must match 'namespace:action' pattern.`,
    );
  }
  return name as CapabilityIdentifier;
}

export const CanonicalCapabilities = {
  // Administrative Capabilities (Class A)
  ADMIN_TENANT_MANAGE: createCapabilityIdentifier("admin:tenant_manage"),
  ADMIN_AUDIT_READ: createCapabilityIdentifier("admin:audit_read"),

  // Clinical audit chain (spec §7.3). Deliberately SEPARATE from admin:audit_read,
  // which covers `authorization_audit_log` — the record of what the evaluator
  // decided. These three cover `clinical_audit_event`, the record of who touched
  // which patient. They are different tables answering different questions, and
  // somebody reviewing authorization decisions has no business reading the clinical
  // access history as a side effect.
  //
  // Split three ways rather than one, because the risks are not equal: querying
  // returns a page, verifying returns a boolean, and exporting produces a file that
  // leaves the platform. Collapsing them would mean anyone who can read the log can
  // also walk out with it.
  AUDIT_QUERY: createCapabilityIdentifier("audit:query"),
  AUDIT_EXPORT: createCapabilityIdentifier("audit:export"),
  AUDIT_VERIFY: createCapabilityIdentifier("audit:verify"),
  STAFF_SCHEDULE_MANAGE: createCapabilityIdentifier("staff:schedule_manage"),

  // Clinical Informational & Preparation Capabilities (Class A)
  CLINICAL_STATE_READ: createCapabilityIdentifier("clinical_state:read"),
  EVIDENCE_READ: createCapabilityIdentifier("evidence:read"),
  EVIDENCE_PROPOSE: createCapabilityIdentifier("evidence:propose_candidate"),
  INTENT_PROPOSE: createCapabilityIdentifier("intent:propose"),
  EXECUTION_GRAPH_PLAN: createCapabilityIdentifier("execution_graph:plan"),

  // Clinical Transactional Authority Capabilities (Class C)
  AUTHORITY_GRANT_ISSUE_CLASS_C: createCapabilityIdentifier("authority_grant:issue_class_c"),
  AUTHORITY_GRANT_REVOKE: createCapabilityIdentifier("authority_grant:revoke"),
  ORDER_SIGN_TRANSACTION: createCapabilityIdentifier("order:sign_transaction"),
  PRIOR_AUTH_AUTHORIZE_SUBMISSION: createCapabilityIdentifier("prior_auth:authorize_submission"),

  // Policy & Autonomy Delegation Capabilities (Class B)
  POLICY_CONFIGURE_CLASS_B: createCapabilityIdentifier("policy:configure_class_b"),
} as const;

export interface RoleDefinition {
  readonly roleId: string;
  readonly tenantId: TenantId;
  readonly roleName: string;
  readonly candidateCapabilities: ReadonlyArray<CapabilityIdentifier>;
}
