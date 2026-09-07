/**
 * @file Transactional Outbox Repository (PostgreSQL)
 * @description Writes domain events transactionally alongside aggregate state updates.
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

  public async fetchUndispatchedEvents(limit = 50): Promise<any[]> {
    return this.db
      .selectFrom("domain_outbox_events")
      .selectAll()
      .where("dispatched_at", "is", null)
      .orderBy("occurred_at", "asc")
      .limit(limit)
      .execute();
  }
}
