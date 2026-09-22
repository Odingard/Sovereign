/**
 * @file Outbox relay (WO-002C S1-15)
 * @description Drains `domain_outbox_events` to the event bus, tenant by tenant.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.2, §8.5, S1-D09. Closes G-53.
 *
 * Services never publish to the bus directly. A domain event is written to
 * `domain_outbox_events` in the same transaction as the business write; this job
 * moves it. That is what makes "the event was published" and "the write committed"
 * the same fact rather than two facts that can disagree.
 *
 * THE TENANT-BY-TENANT PART IS THE POINT.
 *
 * §5.2 permits a @systemScope job to work across tenants, but requires it to "iterate
 * tenants explicitly" under a role that still has RLS forced. The earlier
 * implementation selected across every tenant in one query as `sovereign_app` — which
 * worked, and which G-53 recorded as a gap, because a single cross-tenant query is one
 * missing predicate away from being a cross-tenant leak and nothing about its shape
 * says otherwise.
 *
 * Iterating instead means every read of event data happens inside a tenant context AND
 * carries an explicit `tenant_id` predicate. Both, not either — see drainTenant. The
 * only genuinely cross-tenant query is the one that asks WHICH tenants have work; it
 * reads a distinct list of tenant ids and no event content at all.
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

export interface OutboxEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly eventName: string;
  readonly aggregateId: string;
  readonly payload: unknown;
  readonly occurredAt: Date;
  readonly correlationId: string;
}

export interface EventPublisher {
  /** Publishes with `tenant_id` as the ordering key (S1-D09). */
  publish(topic: string, event: OutboxEvent): Promise<void>;
}

export interface RelayOptions {
  readonly topic?: string;
  /** Events per tenant per pass. Bounds one tenant's ability to starve the others. */
  readonly batchSize?: number;
  readonly now?: () => Date;
}

export interface RelayResult {
  readonly tenantsProcessed: number;
  readonly eventsPublished: number;
  readonly tenantsFailed: readonly string[];
}

/**
 * Tenants with undispatched events.
 *
 * @systemScope Outbox relay — the ONLY cross-tenant read in this job, and it returns
 * tenant ids and nothing else. No event name, no payload, no aggregate id. A leak here
 * discloses that a tenant exists and has pending work, which the operator already
 * knows.
 *
 * Everything that touches event CONTENT happens inside a tenant context below.
 */
async function tenantsWithPendingEvents(db: Db): Promise<string[]> {
  const rows = await sql<{ tenant_id: string }>`
    SELECT DISTINCT tenant_id FROM domain_outbox_events
    WHERE dispatched_at IS NULL
    ORDER BY tenant_id
  `.execute(db);
  return rows.rows.map((r) => r.tenant_id);
}

/**
 * Drain one tenant's outbox inside its own transaction and tenant context.
 *
 * `FOR UPDATE SKIP LOCKED` lets several relay instances run concurrently without
 * publishing the same event twice or blocking each other (§8.5). Consumers dedupe
 * anyway — delivery is at-least-once — but skipping a locked row is what keeps a
 * second instance useful rather than merely idle.
 */
async function drainTenant(
  db: Db,
  tenantId: string,
  publisher: EventPublisher,
  topic: string,
  batchSize: number,
  now: () => Date,
): Promise<number> {
  return db.transaction().execute(async (trx) => {
    // Every statement below runs under RLS for this tenant...
    await sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`.execute(trx);

    // ...and every statement below ALSO carries `tenant_id = ${tenantId}` explicitly,
    // per S1-22/G-50: RLS is defence in depth, never the sole control.
    //
    // This is not belt-and-braces. The first version of this job relied on RLS alone,
    // and its own test failed: run against a connection whose role bypasses RLS —
    // the owner, a superuser, a misconfigured deployment — the tenant loop became
    // decorative. Each pass selected every tenant's rows, so one tenant's poison
    // event was reported as a failure for every tenant, and tenant A's events would
    // have been published under tenant B's turn.
    //
    // A tenant loop whose correctness depends on a setting elsewhere is not a tenant
    // loop. The predicate is what makes it one.

    const rows = await sql<{
      id: string;
      tenant_id: string;
      event_name: string;
      aggregate_id: string;
      payload_json: unknown;
      occurred_at: Date;
      correlation_id: string;
    }>`
      SELECT id, tenant_id, event_name, aggregate_id, payload_json, occurred_at, correlation_id
      FROM domain_outbox_events
      WHERE tenant_id = ${tenantId} AND dispatched_at IS NULL
      ORDER BY occurred_at ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `.execute(trx);

    for (const row of rows.rows) {
      // A publish failure aborts the transaction, so dispatched_at is never written
      // for an event that did not leave. Marking first and publishing after would
      // lose events on any failure, which is the one outcome the outbox exists to
      // prevent.
      await publisher.publish(topic, {
        id: row.id,
        tenantId: row.tenant_id,
        eventName: row.event_name,
        aggregateId: row.aggregate_id,
        payload: row.payload_json,
        occurredAt: row.occurred_at,
        correlationId: row.correlation_id,
      });
      await sql`
        UPDATE domain_outbox_events SET dispatched_at = ${now()}
        WHERE id = ${row.id} AND tenant_id = ${tenantId}
      `.execute(trx);
    }
    return rows.rows.length;
  });
}

/**
 * One relay pass.
 *
 * A failing tenant does not stop the others. One tenant with a poison event or an
 * unreachable topic must not halt delivery for every other tenant on the platform —
 * that would turn one tenant's problem into an outage for all of them, which is the
 * noisy-neighbour failure in a different costume.
 */
export async function runRelayPass(
  db: Db,
  publisher: EventPublisher,
  options: RelayOptions = {},
): Promise<RelayResult> {
  const topic = options.topic ?? "domain-events";
  const batchSize = options.batchSize ?? 100;
  const now = options.now ?? (() => new Date());

  const tenants = await tenantsWithPendingEvents(db);
  let eventsPublished = 0;
  const tenantsFailed: string[] = [];

  for (const tenantId of tenants) {
    try {
      eventsPublished += await drainTenant(db, tenantId, publisher, topic, batchSize, now);
    } catch {
      // The error is deliberately not carried out of this function: it may quote a
      // payload. The tenant id is enough for an operator to investigate, and the
      // detail belongs in the log through the redacting serializer.
      tenantsFailed.push(tenantId);
    }
  }

  return { tenantsProcessed: tenants.length, eventsPublished, tenantsFailed };
}
