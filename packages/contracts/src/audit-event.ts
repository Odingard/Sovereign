/**
 * @file Clinical Audit Event Contract (WO-002C S1-04)
 * @description The shape of an auditable event, and the shape it takes once chained.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3 (`clinical_audit_event`), S1-D11.
 *
 * Two schemas, deliberately:
 *
 *   AuditEventInput   what a service emits through `kernel.audit.emit()`
 *   AuditEventRecord  what `services/audit` appends to the chain
 *
 * The chain fields — `seq`, `prevHash`, `eventHash` — exist ONLY on the record. An
 * emitter that could set its own `eventHash` could forge chain position, which would
 * defeat the tamper-evidence the chain exists to provide (NFR-006, FR-040). They are
 * assigned by the audit service under a per-tenant advisory lock, never accepted from
 * a caller.
 */

import { ActorKind } from "@sovereign/domain";
import { z } from "zod";

/** Outcome of the audited operation. `denied` is a first-class result, not an error. */
export const AuditResultSchema = z.enum(["success", "denied", "error"]);
export type AuditResult = z.infer<typeof AuditResultSchema>;

/**
 * What a service emits. Written to `domain_outbox_events` in the SAME transaction as
 * the business write (§7.3): a consequential operation whose audit row cannot commit
 * must itself fail.
 */
export const AuditEventInputSchema = z
  .object({
    eventId: z.string().uuid(),
    tenantId: z.string().min(1),
    siteId: z.string().min(1).nullable().default(null),

    actorKind: z.nativeEnum(ActorKind),
    actorId: z.string().min(1).nullable().default(null),
    /** The grant that authorized this action, not the actor's role label. */
    roleGrant: z.string().min(1).nullable().default(null),

    patientId: z.string().min(1).nullable().default(null),
    resourceType: z.string().min(1),
    resourceId: z.string().min(1).nullable().default(null),
    resourceVersion: z.string().min(1).nullable().default(null),

    action: z.string().min(1),
    /** Mandatory for break-glass and export; enforced per-action, not here (§6.3). */
    reason: z.string().min(1).nullable().default(null),

    occurredAt: z.date(),
    requestId: z.string().min(1),
    correlationId: z.string().min(1),
    causationId: z.string().min(1).nullable().default(null),

    source: z.string().min(1).nullable().default(null),
    destination: z.string().min(1).nullable().default(null),

    /** Version stamps make a past decision reproducible. */
    policyVersion: z.string().min(1),
    configVersion: z.string().min(1).nullable().default(null),
    modelVersion: z.string().min(1).nullable().default(null),
    promptVersion: z.string().min(1).nullable().default(null),

    priorState: z.unknown().nullable().default(null),
    newState: z.unknown().nullable().default(null),
    /** SHA-256 of the artifact this event concerns, hex-encoded. */
    artifactHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/, "artifactHash must be lowercase hex SHA-256")
      .nullable()
      .default(null),

    result: AuditResultSchema,
    errorCode: z.string().min(1).nullable().default(null),
  })
  .strict();

export type AuditEventInput = z.infer<typeof AuditEventInputSchema>;

/**
 * The chained record. `services/audit` assigns these three fields on append:
 *
 *   seq        per-tenant monotonic sequence, assigned under an advisory lock
 *   prevHash   eventHash of seq-1 for this tenant
 *   eventHash  sha256(prevHash || canonical_json(event without hashes))
 *
 * `sovereign_app` holds INSERT and SELECT only; UPDATE and DELETE are revoked at the
 * role level and additionally blocked by a trigger (§7.3).
 */
export const AuditEventRecordSchema = AuditEventInputSchema.extend({
  recordedAt: z.date(),
  seq: z.bigint().nonnegative(),
  prevHash: z.string().regex(/^[0-9a-f]{64}$/),
  eventHash: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();

export type AuditEventRecord = z.infer<typeof AuditEventRecordSchema>;

/** Field names excluded from the hash preimage, since they are derived from it. */
export const AUDIT_HASH_EXCLUDED_FIELDS = ["prevHash", "eventHash", "recordedAt"] as const;

/**
 * Minimum audited actions for Stage 1 (§7.3). This list is a floor, not a ceiling;
 * the adversarial suite asserts each one produces a chain entry.
 */
export const STAGE1_MINIMUM_AUDITED_ACTIONS = [
  "auth.login.success",
  "auth.login.failure",
  "auth.token.rejected",
  "authz.denied",
  "tenant.created",
  "site.created",
  "user.invited",
  "user.deprovisioned",
  "grant.created",
  "grant.revoked",
  "approval.decided",
  "killswitch.changed",
  "patient.created",
  "patient.read",
  "patient.merged",
  "artifact.ingested",
  "artifact.read",
  "fact.recorded",
  "fact.corrected",
  "reconciliation.opened",
  "reconciliation.resolved",
  "audit.query",
  "audit.export",
  "breakglass.requested",
  "breakglass.approved",
  "breakglass.used",
  "scim.operation",
  "config.deployed",
] as const;

export type Stage1AuditedAction = (typeof STAGE1_MINIMUM_AUDITED_ACTIONS)[number];
