/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced from config/roles/matrix.yaml by scripts/compile-role-matrix.ts.
 * Run `pnpm run compile:roles` after changing the YAML.
 *
 * A role is not an authority grant (AGENTS.md doctrine 17, ADR-0010). These are
 * capability DEFAULTS that make a capability eligible to be granted; authority comes
 * from an AuthorityGrant evaluated at the time of the action.
 */

import type { CapabilityIdentifier } from "../common/identifiers.js";

export const ROLE_MATRIX_VERSION = 1;

export interface CompiledRole {
  readonly enabled: boolean;
  readonly capabilities: ReadonlyArray<CapabilityIdentifier>;
}

// Capability strings are validated against CanonicalCapabilities at compile time by
// scripts/compile-role-matrix.ts, so the brand is asserted once here rather than
// repeated on every entry.
const RAW_ROLE_MATRIX = {
  clinician: {
    enabled: true,
    capabilities: [
      "clinical_state:read",
      "evidence:read",
      "evidence:propose_candidate",
      "intent:propose",
      "execution_graph:plan",
      "order:sign_transaction",
      "prior_auth:authorize_submission",
    ],
  },
  app: {
    enabled: true,
    capabilities: [
      "clinical_state:read",
      "evidence:read",
      "evidence:propose_candidate",
      "intent:propose",
      "execution_graph:plan",
      "order:sign_transaction",
      "prior_auth:authorize_submission",
    ],
  },
  nurse_ma: {
    enabled: true,
    capabilities: [
      "clinical_state:read",
      "evidence:read",
      "evidence:propose_candidate",
      "intent:propose",
    ],
  },
  pa_specialist: {
    enabled: true,
    capabilities: ["clinical_state:read", "evidence:read", "execution_graph:plan"],
  },
  infusion_coordinator: {
    enabled: true,
    capabilities: ["clinical_state:read", "evidence:read", "staff:schedule_manage"],
  },
  practice_manager: {
    enabled: true,
    capabilities: ["staff:schedule_manage"],
  },
  org_admin: {
    enabled: true,
    capabilities: ["admin:tenant_manage", "staff:schedule_manage", "authority_grant:revoke"],
  },
  security_admin: {
    enabled: true,
    capabilities: [
      "admin:tenant_manage",
      "admin:audit_read",
      "authority_grant:issue_class_c",
      "authority_grant:revoke",
      "policy:configure_class_b",
    ],
  },
  auditor: {
    enabled: true,
    capabilities: ["admin:audit_read"],
  },
  support_readonly: {
    enabled: true,
    capabilities: [],
  },
  patient: {
    enabled: false,
    capabilities: [],
  },
} as const;

export const ROLE_MATRIX: Readonly<Record<string, CompiledRole>> =
  RAW_ROLE_MATRIX as unknown as Readonly<Record<string, CompiledRole>>;

/** Capabilities requiring a second distinct human approver (spec §6.2). */
export const DUAL_CONTROL_CAPABILITIES: ReadonlyArray<CapabilityIdentifier> = [
  "authority_grant:issue_class_c",
  "authority_grant:revoke",
  "policy:configure_class_b",
] as unknown as ReadonlyArray<CapabilityIdentifier>;

/** Capabilities requiring an MFA claim in the request context (spec §6.2). */
export const MFA_REQUIRED_CAPABILITIES: ReadonlyArray<CapabilityIdentifier> = [
  "admin:tenant_manage",
  "admin:audit_read",
  "authority_grant:issue_class_c",
  "authority_grant:revoke",
  "policy:configure_class_b",
  "order:sign_transaction",
  "prior_auth:authorize_submission",
] as unknown as ReadonlyArray<CapabilityIdentifier>;

export function capabilitiesForRole(role: string): ReadonlyArray<CapabilityIdentifier> {
  const entry = ROLE_MATRIX[role];
  // Unknown or disabled role yields nothing. Deny by default: an unrecognised role
  // must never inherit a permissive fallback.
  return entry === undefined || !entry.enabled ? [] : entry.capabilities;
}

export function isDualControl(capability: string): boolean {
  return (DUAL_CONTROL_CAPABILITIES as ReadonlyArray<string>).includes(capability);
}

export function requiresMfa(capability: string): boolean {
  return (MFA_REQUIRED_CAPABILITIES as ReadonlyArray<string>).includes(capability);
}
