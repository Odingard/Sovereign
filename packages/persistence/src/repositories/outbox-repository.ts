/**
 * @file Transactional Outbox Repository (PostgreSQL)
 * @description Writes domain events transactionally alongside aggregate state updates.
 *
 * WRITE ONLY. Draining the outbox lives in `jobs/outbox-relay`, which iterates tenants
 * explicitly with a tenant predicate and an `app.current_tenant` per tenant (spec §5.2).
 *
 * This class used to expose `fetchUndispatchedEvents`, a single query across every
 * tenant. It was correctly tagged `@systemScope` and it worked; it was also G-53, and a
 * cross-tenant read reachable from any service is a leak waiting for one caller who
 * forgets what the tag means. It was removed rather than fixed — the relay is the only
 * thing that should be reading this table, and it is not a repository.
 */

import type { SovereignDomainEvent } from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

export class PostgresOutboxRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async insertEvent(event: SovereignDomainEvent): Promise<void> {
    await this.db
      .insertInto("domain_outbox_events")
      .values({
        id: event.eventId,
        tenant_id: event.tenantId,
        patient_id: event.patientId || null,
        event_name: event.eventName,
        aggregate_id: event.aggregateId,
        aggregate_version: event.aggregateVersion,
        schema_version: event.schemaVersion,
        actor_id: event.actorId,
        correlation_id: event.correlationId,
        causation_id: event.causationId,
        payload_json: JSON.stringify(event.payload),
        occurred_at: event.occurredAt,
        dispatched_at: null,
      })
      .execute();
  }
}
