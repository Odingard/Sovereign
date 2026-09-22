/**
 * @file Migration 008: metering (WO-002C S1-18)
 * @description billable_unit projection and the idempotent collector's ledger.
 *
 * Source: docs/ENTERPRISE_BUILD_PLAN.md Phase 3, ADR-0011 Decision 6.
 *
 * "Metering events are a Phase 3 obligation, not a pricing decision." Pricing is
 * deferred (PRD O-009). What is NOT deferred is emitting the units, because a unit
 * not recorded at the time it happened cannot be reconstructed afterwards — and
 * Gate 2 requires metering to reconcile 100% to canonical events on sampled periods.
 *
 * The collector is idempotent by primary key: (tenant_id, period, event_id). Pub/Sub
 * is at-least-once, so the same event will arrive twice; a duplicate must not bill
 * twice. Uniqueness in the schema is what makes that structural rather than a
 * property of whichever consumer happens to be running.
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("billable_unit")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    // The billing period this unit falls in, as YYYY-MM. Derived from occurred_at, not
    // from arrival time: a late event belongs to the period it happened in.
    .addColumn("period", "text", (col) => col.notNull())
    .addColumn("event_id", "text", (col) => col.notNull())
    .addColumn("unit_type", "text", (col) => col.notNull())
    .addColumn("quantity", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("recorded_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("source_event_name", "text", (col) => col.notNull())
    .addColumn("site_id", "text")
    // Dedup key. Same event, same period, counted once — whatever the consumer does.
    .addPrimaryKeyConstraint("pk_billable_unit", ["tenant_id", "period", "event_id"])
    .addCheckConstraint("ck_billable_unit_quantity", sql`quantity > 0`)
    .addCheckConstraint("ck_billable_unit_period", sql`period ~ '^[0-9]{4}-[0-9]{2}$'`)
    .execute();

  await db.schema
    .createIndex("idx_billable_unit_period")
    .on("billable_unit")
    .columns(["tenant_id", "period", "unit_type"])
    .execute();

  // Events arriving after their period closed. Kept rather than discarded: Gate 2
  // asks whether metering reconciles to canonical events, and an event silently
  // dropped for lateness is a reconciliation failure nobody can explain later.
  await db.schema
    .createTable("late_billable_unit")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("event_id", "text", (col) => col.notNull())
    .addColumn("intended_period", "text", (col) => col.notNull())
    .addColumn("unit_type", "text", (col) => col.notNull())
    .addColumn("quantity", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("received_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("lateness_hours", "integer", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_late_billable_unit", ["tenant_id", "event_id"])
    .execute();

  for (const table of ["billable_unit", "late_billable_unit"]) {
    await sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`).execute(db);
    await sql.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`).execute(db);
    await sql.raw(`DROP POLICY IF EXISTS tenant_isolation_policy ON ${table};`).execute(db);
    await sql
      .raw(
        `CREATE POLICY tenant_isolation_policy ON ${table}
         FOR ALL
         TO sovereign_app
         USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text)
         WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text);`,
      )
      .execute(db);
    // SELECT and INSERT only. A billing record that can be edited after the fact is
    // not a billing record, and nothing legitimate needs to rewrite one.
    await sql.raw(`GRANT SELECT, INSERT ON ${table} TO sovereign_app;`).execute(db);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of ["late_billable_unit", "billable_unit"]) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
