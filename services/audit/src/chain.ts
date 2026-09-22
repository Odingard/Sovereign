/**
 * @file Audit chain append (WO-002C S1-15)
 * @description Appends an event to a tenant's hash chain.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3, S1-D11, NFR-006, FR-040.
 *
 *   event_hash = sha256(prev_hash || canonical_json(event without hashes))
 *
 * Two properties make the chain worth having:
 *
 * 1. LINEAR. `seq` is assigned under a per-tenant advisory lock, so two concurrent
 *    consumers cannot both claim the same position. A unique(tenant_id, seq)
 *    constraint backs it up, so even a lock failure produces an error rather than a
 *    forked chain.
 *
 * 2. IDEMPOTENT. Pub/Sub delivers at least once (§8.5), so the same event WILL arrive
 *    twice. Appending it twice would break verification for everyone downstream of
 *    that point, so a duplicate event_id is a no-op, not an error and not a second
 *    row (spec §10 test 11).
 *
 * Canonical JSON is what makes verification reproducible: key order must not change
 * the hash, or a chain verifies on one machine and fails on another.
 */

import type { AuditEventInput } from "@sovereign/contracts";
import { AUDIT_HASH_EXCLUDED_FIELDS, AuditEventInputSchema } from "@sovereign/contracts";
import { GENESIS_HASH, chainHash } from "@sovereign/crypto";
import { type Kysely, sql } from "kysely";

export interface ChainPosition {
  readonly seq: bigint;
  readonly prevHash: string;
  readonly eventHash: string;
  /** True when the event was already present and nothing was written. */
  readonly duplicate: boolean;
}

/** The exact shape that gets hashed. Derived fields are excluded by construction. */
export function hashPreimage(event: AuditEventInput): Record<string, unknown> {
  const preimage: Record<string, unknown> = { ...event };
  for (const field of AUDIT_HASH_EXCLUDED_FIELDS) {
    delete preimage[field];
  }
  return preimage;
}

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

/**
 * Append one event.
 *
 * Must run inside a transaction: the advisory lock is transaction-scoped, so the
 * read of the tail and the insert that extends it are one atomic step.
 */
export async function appendToChain(trx: Db, raw: AuditEventInput): Promise<ChainPosition> {
  const event = AuditEventInputSchema.parse(raw);

  // Transaction-scoped, per tenant. Other tenants append concurrently; this tenant's
  // writers serialise.
  await sql`SELECT pg_advisory_xact_lock(hashtext(${event.tenantId}))`.execute(trx);

  // The tenant predicate is not redundant with `event_id`, even though `event_id` is
  // unique. The emitter CHOOSES the event id, so without it a caller who replays
  // another tenant's event id gets `duplicate: true` and their own audit row is
  // silently never written — an event that did happen, recorded nowhere. Found by
  // `verify-tenant-predicates.ts` on the first run after it learned to read raw `sql`
  // (G-55), which is the whole argument for teaching it.
  const existing = await sql<{ seq: string; prev_hash: Buffer; event_hash: Buffer }>`
    SELECT seq, prev_hash, event_hash FROM clinical_audit_event
    WHERE tenant_id = ${event.tenantId} AND event_id = ${event.eventId}
  `.execute(trx);

  const already = existing.rows[0];
  if (already !== undefined) {
    // At-least-once delivery. Appending again would fork the chain for everyone
    // downstream, so this is a no-op.
    return {
      seq: BigInt(already.seq),
      prevHash: already.prev_hash.toString("hex"),
      eventHash: already.event_hash.toString("hex"),
      duplicate: true,
    };
  }

  const tail = await sql<{ seq: string; event_hash: Buffer }>`
    SELECT seq, event_hash FROM clinical_audit_event
    WHERE tenant_id = ${event.tenantId}
    ORDER BY seq DESC LIMIT 1
  `.execute(trx);

  const last = tail.rows[0];
  const seq = last === undefined ? 0n : BigInt(last.seq) + 1n;
  const prevHash = last === undefined ? GENESIS_HASH : last.event_hash.toString("hex");
  const eventHash = chainHash(prevHash, hashPreimage(event));

  await sql`
    INSERT INTO clinical_audit_event (
      event_id, tenant_id, site_id, actor_kind, actor_id, role_grant, patient_id,
      resource_type, resource_id, resource_version, action, reason, occurred_at,
      request_id, correlation_id, causation_id, source, destination,
      policy_version, config_version, model_version, prompt_version,
      prior_state, new_state, artifact_hash, result, error_code,
      seq, prev_hash, event_hash
    ) VALUES (
      ${event.eventId}, ${event.tenantId}, ${event.siteId}, ${event.actorKind},
      ${event.actorId}, ${event.roleGrant}, ${event.patientId},
      ${event.resourceType}, ${event.resourceId}, ${event.resourceVersion},
      ${event.action}, ${event.reason}, ${event.occurredAt},
      ${event.requestId}, ${event.correlationId}, ${event.causationId},
      ${event.source}, ${event.destination},
      ${event.policyVersion}, ${event.configVersion}, ${event.modelVersion},
      ${event.promptVersion},
      ${event.priorState === null ? null : JSON.stringify(event.priorState)},
      ${event.newState === null ? null : JSON.stringify(event.newState)},
      ${event.artifactHash === null ? null : Buffer.from(event.artifactHash, "hex")},
      ${event.result}, ${event.errorCode},
      ${seq.toString()}, ${Buffer.from(prevHash, "hex")}, ${Buffer.from(eventHash, "hex")}
    )
  `.execute(trx);

  return { seq, prevHash, eventHash, duplicate: false };
}
