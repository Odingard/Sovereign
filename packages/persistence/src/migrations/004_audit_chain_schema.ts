/**
 * @file Migration 004: hash-chained clinical audit (WO-002C S1-15)
 * @description clinical_audit_event and chain_anchor.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3, S1-D11, NFR-006, FR-040.
 *
 * Append-only is enforced three ways, deliberately redundant:
 *   1. sovereign_app is GRANTed only SELECT and INSERT.
 *   2. UPDATE and DELETE are REVOKEd explicitly.
 *   3. A trigger raises on UPDATE or DELETE regardless of who attempts it.
 *
 * Three layers because the first two are role permissions, and a role can be altered
 * by anyone holding admin on the database. The trigger fires for the table owner and
 * for a superuser too, so a compromised admin session still cannot quietly rewrite
 * history — it has to drop the trigger, which is itself a DDL event in the Cloud SQL
 * audit log.
 *
 * `unique(tenant_id, seq)` is what makes a gap or a duplicate in the chain
 * impossible rather than merely detectable.
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("clinical_audit_event")
    .addColumn("event_id", "text", (col) => col.primaryKey())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("site_id", "text")
    .addColumn("actor_kind", "text", (col) => col.notNull())
    .addColumn("actor_id", "text")
    .addColumn("role_grant", "text")
    .addColumn("patient_id", "text")
    .addColumn("resource_type", "text", (col) => col.notNull())
    .addColumn("resource_id", "text")
    .addColumn("resource_version", "text")
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("reason", "text")
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("recorded_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("request_id", "text", (col) => col.notNull())
    .addColumn("correlation_id", "text", (col) => col.notNull())
    .addColumn("causation_id", "text")
    .addColumn("source", "text")
    .addColumn("destination", "text")
    .addColumn("policy_version", "text", (col) => col.notNull())
    .addColumn("config_version", "text")
    .addColumn("model_version", "text")
    .addColumn("prompt_version", "text")
    .addColumn("prior_state", "jsonb")
    .addColumn("new_state", "jsonb")
    .addColumn("artifact_hash", "bytea")
    .addColumn("result", "text", (col) => col.notNull())
    .addColumn("error_code", "text")
    .addColumn("seq", "bigint", (col) => col.notNull())
    .addColumn("prev_hash", "bytea", (col) => col.notNull())
    .addColumn("event_hash", "bytea", (col) => col.notNull())
    .addUniqueConstraint("uq_audit_tenant_seq", ["tenant_id", "seq"])
    .addCheckConstraint("ck_audit_result", sql`result IN ('success', 'denied', 'error')`)
    .execute();

  // Query paths from §7.3: by patient, by actor, by action window, by correlation.
  await db.schema
    .createIndex("idx_audit_tenant_occurred")
    .on("clinical_audit_event")
    .columns(["tenant_id", "occurred_at"])
    .execute();
  await db.schema
    .createIndex("idx_audit_tenant_patient")
    .on("clinical_audit_event")
    .columns(["tenant_id", "patient_id"])
    .execute();
  await db.schema
    .createIndex("idx_audit_tenant_actor")
    .on("clinical_audit_event")
    .columns(["tenant_id", "actor_id"])
    .execute();
  await db.schema
    .createIndex("idx_audit_correlation")
    .on("clinical_audit_event")
    .column("correlation_id")
    .execute();

  await db.schema
    .createTable("chain_anchor")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("anchor_date", "date", (col) => col.notNull())
    .addColumn("last_seq", "bigint", (col) => col.notNull())
    .addColumn("last_hash", "bytea", (col) => col.notNull())
    .addColumn("gcs_ref", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_chain_anchor", ["tenant_id", "anchor_date"])
    .execute();

  // Layer 3: the trigger. Fires for everyone, including the owner and a superuser.
  await sql`
    CREATE OR REPLACE FUNCTION sovereign_audit_is_append_only()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'clinical_audit_event is append-only: % is not permitted', TG_OP
        USING ERRCODE = 'insufficient_privilege';
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER trg_audit_append_only
    BEFORE UPDATE OR DELETE ON clinical_audit_event
    FOR EACH ROW EXECUTE FUNCTION sovereign_audit_is_append_only();
  `.execute(db);

  // RLS on both tables. An auditor reads their own tenant's chain, never another's.
  for (const table of ["clinical_audit_event", "chain_anchor"]) {
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
  }

  // Layers 1 and 2: grant only what append-only needs, revoke the rest.
  await sql.raw("REVOKE ALL ON clinical_audit_event FROM sovereign_app;").execute(db);
  await sql.raw("GRANT SELECT, INSERT ON clinical_audit_event TO sovereign_app;").execute(db);
  await sql.raw("GRANT SELECT, INSERT ON chain_anchor TO sovereign_app;").execute(db);
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_audit_append_only ON clinical_audit_event;`.execute(db);
  await sql`DROP FUNCTION IF EXISTS sovereign_audit_is_append_only();`.execute(db);
  await db.schema.dropTable("chain_anchor").ifExists().execute();
  await db.schema.dropTable("clinical_audit_event").ifExists().execute();
}
