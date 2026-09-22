/**
 * @file Migration 007: SIEM export configuration (WO-002C S1-17)
 * @description Per-tenant streaming destination for audit events.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.7, S1-D21.
 *
 * Endpoint and secret are stored ENCRYPTED. The endpoint as well as the secret,
 * because a SIEM endpoint URL routinely embeds a token — Splunk HEC and generic
 * webhook URLs both do — and storing it in plaintext would leak the credential the
 * adjacent column is carefully protecting.
 *
 * `include_phi` defaults FALSE and is dual-control to enable (§7.7). A tenant may
 * legitimately want full event bodies in their own SIEM, but it is a decision that
 * moves PHI outside Sovereign's boundary and must not be a checkbox one admin can tick.
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("siem_export")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("endpoint_enc", "bytea", (col) => col.notNull())
    .addColumn("secret_enc", "bytea", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("include_phi", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("include_phi_approval_id", "text")
    .addColumn("last_success_at", "timestamptz")
    .addColumn("last_failure_at", "timestamptz")
    .addColumn("consecutive_failures", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_siem_export", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_siem_export_kind",
      sql`kind IN ('hec', 'sentinel', 'chronicle', 'webhook')`,
    )
    // PHI export requires a recorded dual-control approval. Without this the flag can
    // be flipped directly in the database and nothing records who decided.
    .addCheckConstraint(
      "ck_siem_export_phi_approval",
      sql`include_phi = false OR include_phi_approval_id IS NOT NULL`,
    )
    .execute();

  // Dead letters. A failed delivery is kept rather than dropped: an audit event that
  // never reached the tenant's SIEM is a gap in THEIR record, and they need to know
  // which events are missing, not merely that some are.
  await db.schema
    .createTable("siem_dead_letter")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("export_id", "text", (col) => col.notNull())
    .addColumn("event_id", "text", (col) => col.notNull())
    .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("first_failed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("last_failed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("last_error_code", "text")
    .addColumn("resolved_at", "timestamptz")
    .addPrimaryKeyConstraint("pk_siem_dead_letter", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_siem_dead_letter_unresolved")
    .on("siem_dead_letter")
    .columns(["tenant_id", "export_id"])
    .where(sql.ref("resolved_at"), "is", null)
    .execute();

  for (const table of ["siem_export", "siem_dead_letter"]) {
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
    await sql.raw(`GRANT SELECT, INSERT, UPDATE ON ${table} TO sovereign_app;`).execute(db);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of ["siem_dead_letter", "siem_export"]) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
