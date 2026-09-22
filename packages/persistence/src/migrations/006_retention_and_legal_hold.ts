/**
 * @file Migration 006: legal hold and erasure record (WO-002C S1-16)
 * @description legal_hold, erasure_request, and retention_class on tenant data.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.8, S1-D20, DATA_CLASSIFICATION_SCHEDULE.md.
 *
 * A legal hold outranks every retention period. "Every erasure job checks holds first
 * and refuses." The check lives in the schema as well as the job, because an erasure
 * that runs under a hold is a spoliation problem, not a bug — it cannot be undone and
 * it is the kind of thing that ends up in front of a court.
 *
 * Erasure is recorded, not merely performed. The erasure_request row survives the data
 * it destroyed: without it there is no evidence of who authorised the destruction, on
 * what basis, or that a hold check happened.
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("legal_hold")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    // 'tenant' holds everything; 'patient' holds one subject.
    .addColumn("scope", "text", (col) => col.notNull())
    .addColumn("subject_id", "text")
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("placed_by", "text", (col) => col.notNull())
    .addColumn("placed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("released_by", "text")
    .addColumn("released_at", "timestamptz")
    .addPrimaryKeyConstraint("pk_legal_hold", ["tenant_id", "id"])
    .addCheckConstraint("ck_legal_hold_scope", sql`scope IN ('tenant', 'patient')`)
    // A patient-scoped hold must name the patient; a tenant-scoped one must not, or
    // the scope becomes ambiguous and a hold check can silently miss.
    .addCheckConstraint(
      "ck_legal_hold_subject",
      sql`(scope = 'patient') = (subject_id IS NOT NULL)`,
    )
    // Release must record who released it. A hold that lapsed with no name attached
    // is indistinguishable from one that was never placed.
    .addCheckConstraint("ck_legal_hold_release", sql`(released_at IS NULL) = (released_by IS NULL)`)
    .execute();

  await db.schema
    .createIndex("idx_legal_hold_active")
    .on("legal_hold")
    .columns(["tenant_id", "scope", "subject_id"])
    .where(sql.ref("released_at"), "is", null)
    .execute();

  await db.schema
    .createTable("erasure_request")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("scope", "text", (col) => col.notNull())
    .addColumn("subject_id", "text")
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("requested_by", "text", (col) => col.notNull())
    .addColumn("requested_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    // Dual control (spec §7.8). Nullable until approved; a CHECK forbids self-approval.
    .addColumn("approved_by", "text")
    .addColumn("approved_at", "timestamptz")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("executed_at", "timestamptz")
    // What was actually destroyed. Survives the data.
    .addColumn("destroyed_key_version", "integer")
    .addColumn("certificate_hash", "bytea")
    .addPrimaryKeyConstraint("pk_erasure_request", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_erasure_status",
      sql`status IN ('pending', 'approved', 'refused_legal_hold', 'executed', 'cancelled')`,
    )
    .addCheckConstraint(
      "ck_erasure_distinct_approver",
      sql`approved_by IS NULL OR approved_by <> requested_by`,
    )
    // Executed means it actually happened: a key version was destroyed and a
    // certificate recorded. Without this, "executed" could be set on a request that
    // did nothing.
    .addCheckConstraint(
      "ck_erasure_executed_evidence",
      sql`status <> 'executed' OR (destroyed_key_version IS NOT NULL AND certificate_hash IS NOT NULL AND executed_at IS NOT NULL)`,
    )
    .execute();

  // retention_class on the tables that carry tenant data (S1-D20: every table carries
  // one). Defaults follow DATA_CLASSIFICATION_SCHEDULE.md.
  for (const [table, defaultClass] of [
    ["patient", "legal_clinical"],
    ["clinical_fact", "legal_clinical"],
    ["source_artifact", "legal_clinical"],
    ["patient_identifier", "legal_clinical"],
    ["reconciliation_item", "operational"],
  ] as const) {
    await sql
      .raw(
        `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS retention_class text NOT NULL DEFAULT '${defaultClass}';`,
      )
      .execute(db);
  }

  for (const table of ["legal_hold", "erasure_request"]) {
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

  // Neither a hold nor an erasure record may be deleted. Deleting the evidence that a
  // hold existed is the failure this table is meant to prevent.
  await sql`
    CREATE OR REPLACE FUNCTION sovereign_hold_record_is_permanent()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION '% records are permanent: DELETE is not permitted (release a hold instead)', TG_TABLE_NAME
        USING ERRCODE = 'insufficient_privilege';
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  for (const table of ["legal_hold", "erasure_request"]) {
    await sql
      .raw(
        `CREATE TRIGGER trg_${table}_permanent
         BEFORE DELETE ON ${table}
         FOR EACH ROW EXECUTE FUNCTION sovereign_hold_record_is_permanent();`,
      )
      .execute(db);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function down(db: Kysely<any>): Promise<void> {
  // `IF EXISTS` on the TABLE as well as the column and trigger. runMigrationsDown is
  // called on databases that were never migrated up — persistence-postgres.test.ts
  // does exactly that — and `ALTER TABLE x DROP COLUMN IF EXISTS` still fails when x
  // itself is absent.
  for (const table of ["legal_hold", "erasure_request"]) {
    await sql
      .raw(`DROP TRIGGER IF EXISTS trg_${table}_permanent ON ${table};`)
      .execute(db)
      .catch(() => undefined);
  }
  await sql`DROP FUNCTION IF EXISTS sovereign_hold_record_is_permanent();`.execute(db);
  for (const table of ["erasure_request", "legal_hold"]) {
    await db.schema.dropTable(table).ifExists().execute();
  }
  for (const table of [
    "patient",
    "clinical_fact",
    "source_artifact",
    "patient_identifier",
    "reconciliation_item",
  ]) {
    await sql
      .raw(`ALTER TABLE IF EXISTS ${table} DROP COLUMN IF EXISTS retention_class;`)
      .execute(db);
  }
}
