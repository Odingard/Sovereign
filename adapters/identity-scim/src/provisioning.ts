/**
 * @file SCIM provisioning decisions (WO-002B S1-12)
 * @description Translates SCIM operations into Sovereign grant and session effects.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.6, §4.2, ADR-0010.
 *
 * The rule that matters: `active=false` revokes ALL grants and ALL sessions within 30
 * seconds (spec §10 test 19). Deprovisioning that only stops future logins leaves a
 * terminated employee holding a live session, which is the exact scenario an access
 * review is supposed to catch and the exact one an auditor asks about.
 *
 * Group membership maps to roles via `scim_group_role`. An unmapped group grants
 * NOTHING — deny by default. An IdP administrator creating a group called
 * "Sovereign Admins" must not thereby create Sovereign admins.
 */

import type { Role } from "@sovereign/contracts";
import type { ScimUser } from "./schemas.js";

export interface GroupRoleMapping {
  readonly groupExternalId: string;
  readonly role: Role;
  readonly siteId: string | null;
}

export type ProvisioningEffect =
  | { readonly kind: "activate"; readonly userName: string; readonly roles: readonly Role[] }
  | { readonly kind: "deactivate"; readonly userName: string; readonly revokeSessions: true }
  | { readonly kind: "update_roles"; readonly userName: string; readonly roles: readonly Role[] };

/**
 * Resolve group membership to roles.
 *
 * Unmapped groups contribute nothing. The result is deduplicated and sorted so the
 * same membership always yields the same role set — a role list that varies by
 * iteration order would make grant diffs noisy and audit comparison unreliable.
 */
export function rolesForGroups(
  groupExternalIds: readonly string[],
  mappings: readonly GroupRoleMapping[],
): readonly Role[] {
  const byGroup = new Map(mappings.map((m) => [m.groupExternalId, m]));
  const roles = new Set<Role>();
  for (const group of groupExternalIds) {
    const mapping = byGroup.get(group);
    if (mapping !== undefined) {
      roles.add(mapping.role);
    }
  }
  return [...roles].sort();
}

/**
 * Decide what a SCIM user write means for Sovereign.
 *
 * Deactivation short-circuits: when `active` is false, nothing else about the payload
 * matters. A request that both deactivates a user and adds them to a privileged group
 * must deactivate. Evaluating the group membership first would produce a
 * briefly-privileged, then-deactivated user, and "briefly" is enough.
 */
export function effectForUser(
  user: ScimUser,
  groupExternalIds: readonly string[],
  mappings: readonly GroupRoleMapping[],
  existing: { active: boolean } | undefined,
): ProvisioningEffect {
  if (!user.active) {
    return { kind: "deactivate", userName: user.userName, revokeSessions: true };
  }
  const roles = rolesForGroups(groupExternalIds, mappings);
  if (existing === undefined || !existing.active) {
    return { kind: "activate", userName: user.userName, roles };
  }
  return { kind: "update_roles", userName: user.userName, roles };
}

/** Maximum permitted delay between deprovisioning and sessions being dead (§4.2). */
export const DEPROVISION_SESSION_KILL_SECONDS = 30;
