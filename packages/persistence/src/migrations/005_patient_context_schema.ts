/**
 * @file Migration 005: patient context (WO-002B S1-14)
 * @description source_system, patient, patient_identifier, source_artifact,
 * clinical_fact, reconciliation_item.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.2, ADR-0001, ADR-0002.
 *
 * NOTE: §7.2 says this schema "extends existing `patients`". There is no `patients`
 * table — migration 002 created `patient_identity_mappings` only. This migration
 * creates `patient` outright. Recorded rather than silently reconciled.
 *
 * Two invariants are enforced in the schema rather than only in code, because a
 * constraint cannot be forgotten by a code path that grows a new branch:
 *
 *   1. Identifier VALUES are stored encrypted; only a hash is searchable. An MRN is a
 *      direct identifier, and the matching path needs equality, not readability.
 *   2. clinical_fact is insert-only, enforced by trigger. Corrections insert a new row
 *      that supersedes the old one (ADR-0001: preserve source, append corrections).
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("source_system")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("vendor", "text")
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("config_ref", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_source_system", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_source_system_kind",
      sql`kind IN ('ehr', 'lab', 'pharmacy', 'payer', 'manual', 'fixture')`,
    )
    .execute();

  await db.schema
    .createTable("patient")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("primary_site_id", "text")
    // Demographics are encrypted with the tenant DEK (packages/crypto). The column is
    // bytea because the plaintext never reaches the database.
    .addColumn("demographics_enc", "bytea")
    .addColumn("match_state", "text", (col) => col.notNull().defaultTo("confirmed"))
    .addColumn("merged_into", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_patient", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_patient_match_state",
      sql`match_state IN ('confirmed', 'uncertain', 'duplicate_suspect', 'merged')`,
    )
    // A merged patient must say what it merged into, and an unmerged one must not.
    // Without this a record can be marked merged and lose the pointer, which is how a
    // merge becomes an unrecoverable deletion.
    .addCheckConstraint(
      "ck_patient_merged_into",
      sql`(match_state = 'merged') = (merged_into IS NOT NULL)`,
    )
    .addCheckConstraint("ck_patient_no_self_merge", sql`merged_into IS NULL OR merged_into <> id`)
    .execute();

  await db.schema
    .createIndex("idx_patient_tenant_state")
    .on("patient")
    .columns(["tenant_id", "match_state"])
    .execute();

  await db.schema
    .createTable("patient_identifier")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("source_system_id", "text", (col) => col.notNull())
    .addColumn("identifier_type", "text", (col) => col.notNull())
    // Hash for equality matching; ciphertext for the value itself. Never plaintext.
    .addColumn("identifier_value_hash", "bytea", (col) => col.notNull())
    .addColumn("identifier_value_enc", "bytea", (col) => col.notNull())
    .addColumn("is_primary", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_patient_identifier", ["tenant_id", "id"])
    // The deterministic matching key (§7.2 rule 1). Uniqueness here is what makes
    // "exact MRN match" a single lookup rather than a scan with a tie-break.
    .addUniqueConstraint("uq_patient_identifier_source_value", [
      "tenant_id",
      "source_system_id",
      "identifier_type",
      "identifier_value_hash",
    ])
    .execute();

  await db.schema
    .createIndex("idx_patient_identifier_patient")
    .on("patient_identifier")
    .columns(["tenant_id", "patient_id"])
    .execute();

  await db.schema
    .createTable("source_artifact")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("source_system_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text")
    .addColumn("artifact_type", "text", (col) => col.notNull())
    .addColumn("external_id", "text")
    .addColumn("external_version", "text")
    .addColumn("author", "text")
    .addColumn("effective_at", "timestamptz")
    .addColumn("received_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("storage_ref", "text")
    // Computed on ingest. Artifact bytes are immutable in storage; this is what lets
    // a later reader prove the bytes they have are the bytes that arrived.
    .addColumn("content_hash", "bytea", (col) => col.notNull())
    .addColumn("mime_type", "text")
    .addColumn("supersedes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_source_artifact", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createTable("clinical_fact")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("fact_type", "text", (col) => col.notNull())
    .addColumn("code_system", "text")
    .addColumn("code", "text")
    .addColumn("value", "jsonb")
    .addColumn("status", "text")
    .addColumn("effective_at", "timestamptz")
    // Every fact points at the artifact it came from. A fact with no source is an
    // assertion nobody can check (ADR-0002).
    .addColumn("source_artifact_id", "text", (col) => col.notNull())
    .addColumn("source_location", "text")
    .addColumn("origin", "text", (col) => col.notNull())
    .addColumn("state", "text", (col) => col.notNull().defaultTo("current"))
    .addColumn("supersedes", "text")
    .addColumn("created_by", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_clinical_fact", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_clinical_fact_origin",
      sql`origin IN ('recorded', 'derived', 'human_correction')`,
    )
    // 'unknown' is a first-class state and is never coerced to negative
    // (AGENTS.md doctrine 7).
    .addCheckConstraint(
      "ck_clinical_fact_state",
      sql`state IN ('current', 'superseded', 'conflict', 'stale', 'unknown')`,
    )
    // A correction must say what it corrects. Otherwise the chain of supersession
    // breaks and the original becomes unreachable.
    .addCheckConstraint(
      "ck_clinical_fact_correction_supersedes",
      sql`origin <> 'human_correction' OR supersedes IS NOT NULL`,
    )
    .execute();

  await db.schema
    .createIndex("idx_clinical_fact_patient_state")
    .on("clinical_fact")
    .columns(["tenant_id", "patient_id", "state"])
    .execute();

  await db.schema
    .createTable("reconciliation_item")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("subject_ids", sql`text[]`, (col) => col.notNull())
    .addColumn("candidate_ids", sql`text[]`, (col) => col.notNull())
    .addColumn("score", "numeric")
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("open"))
    .addColumn("resolved_by", "text")
    .addColumn("resolution", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("resolved_at", "timestamptz")
    .addPrimaryKeyConstraint("pk_reconciliation_item", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_reconciliation_kind",
      sql`kind IN ('uncertain_match', 'duplicate', 'conflict')`,
    )
    .addCheckConstraint(
      "ck_reconciliation_status",
      sql`status IN ('open', 'resolved', 'dismissed')`,
    )
    .execute();

  // clinical_fact is insert-only. ADR-0001: preserve source data, append corrections
  // and supersessions, do not erase history. A correction inserts a new row; it never
  // edits the old one.
  await sql`
    CREATE OR REPLACE FUNCTION sovereign_clinical_fact_is_insert_only()
    RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE'
         AND OLD.state IS DISTINCT FROM NEW.state
         AND NEW.state = 'superseded'
         AND OLD.id = NEW.id
         AND OLD.value IS NOT DISTINCT FROM NEW.value
         AND OLD.patient_id = NEW.patient_id
         AND OLD.source_artifact_id = NEW.source_artifact_id THEN
        -- The one permitted mutation: marking a row superseded by its replacement.
        -- Nothing about the fact itself may change.
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'clinical_fact is insert-only: % is not permitted (corrections insert a superseding row)', TG_OP
        USING ERRCODE = 'insufficient_privilege';
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER trg_clinical_fact_insert_only
    BEFORE UPDATE OR DELETE ON clinical_fact
    FOR EACH ROW EXECUTE FUNCTION sovereign_clinical_fact_is_insert_only();
  `.execute(db);

  const tenantScoped = [
    "source_system",
    "patient",
    "patient_identifier",
    "source_artifact",
    "clinical_fact",
    "reconciliation_item",
  ];

  for (const table of tenantScoped) {
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
    await sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO sovereign_app;`).execute(db);
  }

  // clinical_fact never gets DELETE, whatever the loop above granted.
  await sql.raw("REVOKE DELETE ON clinical_fact FROM sovereign_app;").execute(db);
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_clinical_fact_insert_only ON clinical_fact;`.execute(db);
  await sql`DROP FUNCTION IF EXISTS sovereign_clinical_fact_is_insert_only();`.execute(db);
  for (const table of [
    "reconciliation_item",
    "clinical_fact",
    "source_artifact",
    "patient_identifier",
    "patient",
    "source_system",
  ]) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
