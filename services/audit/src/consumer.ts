/**
 * @file Audit event consumer (WO-002C S1-15)
 * @description Consumes `audit-events` and appends to the per-tenant hash chain.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3 write path, §8.5, S1-D09.
 *
 * The write path is deliberately indirect. A service does not call this code; it writes
 * to `domain_outbox_events` in the same transaction as its business write, the relay
 * publishes, and this consumes. That is what makes "the write committed" and "the audit
 * row exists" the same fact.
 *
 * THIS IS THE UNTRUSTED EDGE OF THE AUDIT SERVICE.
 *
 * A message off a bus is input, not fact. Anything that can publish to the topic could
 * otherwise write into any tenant's chain — and a forged audit row is worse than a
 * missing one, because the chain's whole value is that what it contains is true. Every
 * message is schema-validated, and the ordering key must agree with the payload's
 * tenant before anything is written.
 */

import { type AuditEventInput, AuditEventWireSchema } from "@sovereign/contracts";
import type { Kysely } from "kysely";
import { sql } from "kysely";
import { type ChainPosition, appendToChain } from "./chain.js";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

/** A message as it arrives from the bus, before anything is believed about it. */
export interface AuditMessage {
  /** Pub/Sub ordering key. The relay sets it from the row's `tenant_id` (S1-D09). */
  readonly orderingKey: string;
  readonly payload: unknown;
}

export type ConsumeOutcome =
  | { readonly status: "appended"; readonly position: ChainPosition }
  | { readonly status: "duplicate"; readonly position: ChainPosition }
  | { readonly status: "rejected"; readonly reason: RejectionReason };

export type RejectionReason = "schema_invalid" | "ordering_key_mismatch";

/**
 * Consume one audit message.
 *
 * Returns a rejection rather than throwing. A malformed or mis-keyed message must not
 * be retried forever — it will never become valid — and it must not stall the ordered
 * subscription behind it. The caller acknowledges it and routes it to the dead-letter
 * topic, where a human looks at it.
 *
 * A redelivery is NOT a rejection. Pub/Sub is at-least-once, so the same event arrives
 * more than once as a matter of course; `appendToChain` dedupes on `event_id` and
 * reports `duplicate`. Treating that as an error would make normal operation look like
 * a fault, and appending it twice would fork the chain for everyone downstream.
 */
export async function consumeAuditMessage(db: Db, message: AuditMessage): Promise<ConsumeOutcome> {
  const parsed = AuditEventWireSchema.safeParse(message.payload);
  if (!parsed.success) {
    // The validation error is not returned: it quotes the offending values, and an
    // audit event carries patient_id and free-text reason.
    return { status: "rejected", reason: "schema_invalid" };
  }
  const event: AuditEventInput = parsed.data;

  // The ordering key is what Pub/Sub uses to serialise delivery per tenant. If it
  // disagrees with the payload, one of the two is wrong and neither can be preferred:
  // believing the payload lets a publisher write into another tenant's chain by
  // mislabelling the key, and believing the key silently files the event under a
  // tenant it does not describe. Refuse.
  if (message.orderingKey !== event.tenantId) {
    return { status: "rejected", reason: "ordering_key_mismatch" };
  }

  const position = await db.transaction().execute(async (trx) => {
    // The append happens inside the event's own tenant context, so RLS is in force
    // for it exactly as it is for a request-path write.
    await sql`SELECT set_config('app.current_tenant', ${event.tenantId}, true)`.execute(trx);
    return appendToChain(trx, event);
  });

  return { status: position.duplicate ? "duplicate" : "appended", position };
}
