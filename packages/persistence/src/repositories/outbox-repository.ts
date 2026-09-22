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

  /**
   * @systemScope Outbox relay — reads undispatched events across ALL tenants.
   *
   * Spec §5.2 permits exactly two things to query outside `withTenant`: migrations,
   * and explicitly tagged @systemScope jobs. This is one of them — the relay's job is
   * to drain every tenant's outbox, so a tenant predicate would defeat its purpose.
   *
   * The tag is not decoration. `scripts/verify-tenant-predicates.ts` REQUIRES it on any
   * query against a tenant table with no tenant predicate, so an untagged cross-tenant
   * query fails the build, and spec §13 S1-25 requires a walkthrough of every
   * @systemScope job at Gate 1. Grepping for this tag is how that walkthrough finds
   * them.
   *
   * KNOWN GAP (G-53): §5.2 also requires a system job to run under a separate DB role
   * with RLS forced and a policy granting only the tenant in `app.current_tenant`,
   * iterating tenants explicitly. This implementation does neither — it selects across
   * all tenants as `sovereign_app`. The relay is not wired up yet; the gap is recorded
   * rather than left for the reader to notice.
   */
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
