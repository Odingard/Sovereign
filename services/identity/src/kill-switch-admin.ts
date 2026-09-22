/**
 * @file Kill-switch change API (WO-002B S1-09)
 * @description Toggling a capability on or off, under dual control in production.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.9, §7.1, §10.16. Closes G-58.
 *
 * `packages/kernel` reads the switch and fails closed. This writes it, and the writing
 * is where the risk lives: a kill switch is the one control that can turn a safety
 * feature off across a whole tenant in a single statement. A compromised admin session
 * that can silently disable a capability has disabled whatever that capability was
 * protecting.
 *
 * So: in production every change needs an approval that somebody else gave, BOTH the
 * request and the decision are audited, and disabling is not treated as less serious
 * than enabling.
 *
 * Non-production environments do not require approval. That is a deliberate asymmetry,
 * not an oversight — an approval workflow in dev trains people to click through
 * approvals, and an approval people click through is worse than none because it looks
 * like a control in the audit trail.
 */

import { dualControlRequired } from "@sovereign/kernel";
import type { Kysely } from "kysely";
import { sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

export type Environment = "dev" | "staging" | "prod";

/** Environments in which a switch change needs an approval somebody else granted. */
const APPROVAL_REQUIRED_ENVIRONMENTS: ReadonlySet<Environment> = new Set(["staging", "prod"]);

export interface ApprovalRecord {
  readonly approvalId: string;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  readonly status: string;
}

export interface KillSwitchChange {
  readonly tenantId: string;
  /** null for a platform-wide switch. */
  readonly capability: string;
  readonly enabled: boolean;
  readonly changedBy: string;
  readonly environment: Environment;
  /** The approval backing this change. Required in staging and prod. */
  readonly approval?: ApprovalRecord;
}

export interface KillSwitchChangeResult {
  readonly id: string;
  readonly capability: string;
  readonly enabled: boolean;
  readonly approvalId: string | null;
}

/**
 * Validate the approval backing a change.
 *
 * Three separate refusals rather than one, because they are three different mistakes
 * and an operator at 3am needs to be told which one they made.
 */
function assertApproved(change: KillSwitchChange): string | null {
  if (!APPROVAL_REQUIRED_ENVIRONMENTS.has(change.environment)) {
    return null;
  }
  const approval = change.approval;
  if (approval === undefined) {
    throw dualControlRequired(`Kill-switch change in ${change.environment} requires an approval`);
  }
  if (approval.status !== "approved" || approval.approvedBy === null) {
    // A pending approval is not an approval. Accepting one would mean the control is
    // satisfied by opening a request rather than by getting an answer to it.
    throw dualControlRequired(
      `Approval ${approval.approvalId} is ${approval.status}, not approved`,
    );
  }
  if (approval.approvedBy === change.changedBy) {
    throw dualControlRequired("The person changing a kill switch may not approve it");
  }
  if (approval.requestedBy === approval.approvedBy) {
    // Covers the case where somebody else applies a change that the requester
    // approved for themselves. The applier being a third party does not repair it.
    throw dualControlRequired("A kill-switch approval may not be self-granted");
  }
  return approval.approvalId;
}

/**
 * Apply a kill-switch change.
 *
 * The row records `changed_by` and `approval_id` because a switch with neither is a
 * production change nobody authorised, and the absence should be visible in the table
 * rather than reconstructable from logs.
 *
 * The caller emits the audit events. Both of them: the request and the decision are
 * separate facts and §10.16 requires both to be audited — a trail showing only the
 * applied change cannot distinguish a change that was approved from one that was
 * never asked about.
 */
export async function applyKillSwitchChange(
  db: Db,
  change: KillSwitchChange,
  now: () => Date = () => new Date(),
): Promise<KillSwitchChangeResult> {
  const approvalId = assertApproved(change);
  const id = `KS-${change.tenantId}-${change.capability}`;

  await sql`
    INSERT INTO kill_switch (id, tenant_id, capability, enabled, changed_by, approval_id, changed_at)
    VALUES (${id}, ${change.tenantId}, ${change.capability}, ${change.enabled},
            ${change.changedBy}, ${approvalId}, ${now()})
    ON CONFLICT (id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      changed_by = EXCLUDED.changed_by,
      approval_id = EXCLUDED.approval_id,
      changed_at = EXCLUDED.changed_at
  `.execute(db);

  return { id, capability: change.capability, enabled: change.enabled, approvalId };
}

/**
 * Read the current state of a switch.
 *
 * Absent means enabled. A capability nobody has ever disabled is on, and requiring a
 * row per capability would mean a missing row disables a working feature — failing
 * closed in the direction that takes a clinical tool away for no reason.
 *
 * The kernel's `requireCapabilityEnabled` still fails closed when the registry cannot
 * be READ at all, which is the different and genuinely ambiguous case.
 */
export async function isCapabilityEnabled(
  db: Db,
  capability: string,
  tenantId: string | null,
): Promise<boolean> {
  const rows = await sql<{ enabled: boolean }>`
    SELECT enabled FROM kill_switch
    WHERE capability = ${capability}
      AND (tenant_id = ${tenantId} OR tenant_id IS NULL)
    ORDER BY tenant_id NULLS LAST
    LIMIT 1
  `.execute(db);
  return rows.rows[0]?.enabled ?? true;
}
