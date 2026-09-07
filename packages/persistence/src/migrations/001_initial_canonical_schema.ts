/**
 * @file Migration 001: Initial Canonical Sovereign Schema
 * @description Creates the authoritative tables for the five aggregates and transactional outbox.
 */

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. clinical_evidence
  await db.schema
    .createTable("clinical_evidence")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("source_system", "text", (col) => col.notNull())
    .addColumn("source_locator", "text", (col) => col.notNull())
    .addColumn("content_sha256", "varchar(64)", (col) => col.notNull())
    .addColumn("content_mime_type", "text", (col) => col.notNull())
    .addColumn("extraction_lineage", "text", (col) => col.notNull())
    .addColumn("sensitivity_classification", "text", (col) => col.notNull())
    .addColumn("provenance_origin", "text", (col) => col.notNull())
    .addColumn("effective_time_json", "jsonb", (col) => col.notNull())
    .addColumn("source_recorded_time_json", "jsonb", (col) => col.notNull())
    .addColumn("sovereign_ingestion_time", "timestamptz", (col) => col.notNull())
    .addColumn("assessments_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_clinical_evidence", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_clinical_evidence_patient")
    .on("clinical_evidence")
    .columns(["tenant_id", "patient_id"])
    .execute();

  // 2. clinical_states
  await db.schema
    .createTable("clinical_states")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("assertions_json", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("last_evaluated_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_clinical_states", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_clinical_states_patient")
    .on("clinical_states")
    .columns(["tenant_id", "patient_id"])
    .execute();

  // 3. clinical_intents
  await db.schema
    .createTable("clinical_intents")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("stage", "text", (col) => col.notNull())
    .addColumn("action_category", "text", (col) => col.notNull())
    .addColumn("action_verb", "text", (col) => col.notNull())
    .addColumn("target_concept_code", "text", (col) => col.notNull())
    .addColumn("target_concept_name", "text", (col) => col.notNull())
    .addColumn("action_concept_json", "jsonb", (col) => col.notNull())
    .addColumn("authority_class", "text", (col) => col.notNull())
    .addColumn("authority_reference", "text")
    .addColumn("clinician_actor_id", "text", (col) => col.notNull())
    .addColumn("supporting_evidence_ids_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("superseded_by_intent_id", "text")
    .addColumn("supersedes_intent_id", "text")
    .addColumn("effective_time_json", "jsonb", (col) => col.notNull())
    .addColumn("source_recorded_time_json", "jsonb", (col) => col.notNull())
    .addColumn("sovereign_ingestion_time", "timestamptz", (col) => col.notNull())
    .addColumn("supersession_time", "timestamptz")
    .addColumn("rationale_narrative", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_clinical_intents", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_clinical_intents_patient")
    .on("clinical_intents")
    .columns(["tenant_id", "patient_id"])
    .execute();

  // 4. execution_graphs
  await db.schema
    .createTable("execution_graphs")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("traceable_intent_ids_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("nodes_json", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("is_cancelled", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_execution_graphs", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_execution_graphs_patient")
    .on("execution_graphs")
    .columns(["tenant_id", "patient_id"])
    .execute();

  // 5. therapy_access_cases
  await db.schema
    .createTable("therapy_access_cases")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("stage", "text", (col) => col.notNull())
    .addColumn("associated_intent_ids_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("associated_graph_ids_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("verified_evidence_ids_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("closure_reason", "text")
    .addColumn("effective_time_json", "jsonb", (col) => col.notNull())
    .addColumn("source_recorded_time_json", "jsonb", (col) => col.notNull())
    .addColumn("sovereign_ingestion_time", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_therapy_access_cases", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_therapy_access_cases_patient")
    .on("therapy_access_cases")
    .columns(["tenant_id", "patient_id"])
    .execute();

  // 6. domain_outbox_events
  await db.schema
    .createTable("domain_outbox_events")
    .addColumn("id", "text", (col) => col.notNull().primaryKey())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text")
    .addColumn("event_name", "text", (col) => col.notNull())
    .addColumn("aggregate_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull())
    .addColumn("schema_version", "integer", (col) => col.notNull())
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("correlation_id", "text", (col) => col.notNull())
    .addColumn("causation_id", "text", (col) => col.notNull())
    .addColumn("payload_json", "jsonb", (col) => col.notNull())
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("dispatched_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("idx_domain_outbox_events_undispatched")
    .on("domain_outbox_events")
    .columns(["dispatched_at", "occurred_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("domain_outbox_events").ifExists().execute();
  await db.schema.dropTable("therapy_access_cases").ifExists().execute();
  await db.schema.dropTable("execution_graphs").ifExists().execute();
  await db.schema.dropTable("clinical_intents").ifExists().execute();
  await db.schema.dropTable("clinical_states").ifExists().execute();
  await db.schema.dropTable("clinical_evidence").ifExists().execute();
}
