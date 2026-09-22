/**
 * @file ECS event mapping (WO-002C S1-17)
 * @description Maps a Sovereign audit event to Elastic Common Schema.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.7, S1-D21.
 *
 * ECS is what makes the export useful rather than merely present: a tenant's existing
 * SIEM dashboards, alerts and correlation rules already speak it.
 *
 * PHI is excluded BY CONSTRUCTION. The mapper takes an allowlist approach, same as the
 * log serializer: it names the fields it emits rather than copying an event and
 * deleting the sensitive ones. A deny-list would leak every field added later, and
 * fields get added.
 *
 * `include_phi` is a per-tenant, dual-control setting (§7.7). Even then, it widens the
 * set to patient and resource identifiers — it never emits clinical content, because
 * the audit event does not carry clinical content in the first place.
 */

import type { AuditEventInput } from "@sovereign/contracts";

export type SiemKind = "hec" | "sentinel" | "chronicle" | "webhook";

export interface EcsEvent {
  readonly "@timestamp": string;
  readonly "event.kind": "event";
  readonly "event.category": string;
  readonly "event.action": string;
  readonly "event.outcome": "success" | "failure" | "unknown";
  readonly "event.id": string;
  readonly "event.sequence"?: string;
  readonly "organization.id": string;
  readonly "user.id"?: string;
  readonly "user.roles"?: readonly string[];
  readonly "service.name": "sovereign";
  readonly "trace.id": string;
  readonly "transaction.id": string;
  readonly "error.code"?: string;
  /** Present only when the tenant has enabled include_phi under dual control. */
  readonly "sovereign.patient_id"?: string;
  readonly "sovereign.resource_id"?: string;
  readonly "sovereign.resource_type": string;
  readonly "sovereign.actor_kind": string;
  readonly "sovereign.policy_version": string;
  readonly "sovereign.site_id"?: string;
}

/**
 * ECS `event.outcome` has three values; Sovereign's `result` has three that do not map
 * one-to-one.
 *
 * `denied` maps to `failure`, not `unknown`. A denial is a definite outcome — the
 * system decided and said no — and mapping it to `unknown` would hide exactly the
 * events a security team most wants to alert on.
 */
export function ecsOutcome(result: AuditEventInput["result"]): EcsEvent["event.outcome"] {
  switch (result) {
    case "success":
      return "success";
    case "denied":
    case "error":
      return "failure";
    default:
      return "unknown";
  }
}

/**
 * ECS `event.category` from the action namespace.
 *
 * Unrecognised actions fall to "process" rather than being dropped. An event with an
 * unfamiliar category is still an event a security team should see; silently
 * discarding it would create a gap in their record that neither side would notice.
 */
export function ecsCategory(action: string): string {
  const namespace = action.split(".")[0] ?? "";
  switch (namespace) {
    case "auth":
      return "authentication";
    case "authz":
      return "iam";
    case "grant":
    case "approval":
    case "user":
    case "tenant":
    case "site":
    case "scim":
      return "iam";
    case "patient":
    case "artifact":
    case "fact":
    case "reconciliation":
      return "database";
    case "audit":
    case "config":
    case "killswitch":
    case "breakglass":
      return "configuration";
    default:
      return "process";
  }
}

export interface MapOptions {
  /** Per-tenant, dual-control (§7.7). Defaults closed. */
  readonly includePhi?: boolean;
  readonly sequence?: bigint;
  readonly roles?: readonly string[];
}

/**
 * Map an audit event to ECS.
 *
 * Every emitted field is named here. Nothing is copied wholesale from the source
 * event, so a field added to AuditEventInput later does not silently begin leaving
 * Sovereign's boundary.
 */
export function toEcs(event: AuditEventInput, options: MapOptions = {}): EcsEvent {
  const includePhi = options.includePhi ?? false;

  const base: Record<string, unknown> = {
    "@timestamp": event.occurredAt.toISOString(),
    "event.kind": "event",
    "event.category": ecsCategory(event.action),
    "event.action": event.action,
    "event.outcome": ecsOutcome(event.result),
    "event.id": event.eventId,
    "organization.id": event.tenantId,
    "service.name": "sovereign",
    "trace.id": event.correlationId,
    "transaction.id": event.requestId,
    "sovereign.resource_type": event.resourceType,
    "sovereign.actor_kind": event.actorKind,
    "sovereign.policy_version": event.policyVersion,
  };

  if (options.sequence !== undefined) {
    base["event.sequence"] = options.sequence.toString();
  }
  if (event.actorId !== null) {
    base["user.id"] = event.actorId;
  }
  if (options.roles !== undefined && options.roles.length > 0) {
    base["user.roles"] = options.roles;
  }
  if (event.errorCode !== null) {
    base["error.code"] = event.errorCode;
  }
  if (event.siteId !== null) {
    base["sovereign.site_id"] = event.siteId;
  }

  // Patient and resource identifiers only when the tenant has opted in under dual
  // control. Note what is NOT here even then: priorState, newState, reason and
  // artifactHash never leave, because they can carry clinical content.
  if (includePhi) {
    if (event.patientId !== null) {
      base["sovereign.patient_id"] = event.patientId;
    }
    if (event.resourceId !== null) {
      base["sovereign.resource_id"] = event.resourceId;
    }
  }

  return base as unknown as EcsEvent;
}

/** Fields that never leave Sovereign, whatever the tenant configures. */
export const NEVER_EXPORTED_FIELDS = [
  "priorState",
  "newState",
  "reason",
  "artifactHash",
  "prevHash",
  "eventHash",
] as const;
