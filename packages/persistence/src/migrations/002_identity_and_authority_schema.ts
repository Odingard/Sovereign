/**
 * @file Migration 002: Identity, Authority, and Tenant-Level Row Level Security (RLS)
 * @description Creates actors, org units, authority grants, identity mappings, and authorization audit log.
 * Enforces defense-in-depth tenant-level RLS across all 13 tenant-scoped tables for runtime role sovereign_app.
 */

import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Ensure runtime application role exists with NOBYPASSRLS
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sovereign_app') THEN
        CREATE ROLE sovereign_app WITH LOGIN PASSWORD 'sovereign_app_password' NOBYPASSRLS;
      END IF;
      GRANT USAGE ON SCHEMA public TO sovereign_app;
    END
    $$;
  `.execute(db);

  // 2. Create tables
  // 2.1 actors
  await db.schema
    .createTable("actors")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("kind", "text", (col) => col.notNull())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("technical_subject_id", "text", (col) => col.notNull())
    .addColumn("qualifications_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("relationships_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("system_attribution", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_actors", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_actors_tenant_kind")
    .on("actors")
    .columns(["tenant_id", "kind"])
    .execute();

  // 2.2 organization_units
  await db.schema
    .createTable("organization_units")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("physical_location_json", "jsonb")
    .addColumn("parent_unit_id", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_organization_units", ["tenant_id", "id"])
    .execute();

  // 2.3 actor_org_unit_assignments
  await db.schema
    .createTable("actor_org_unit_assignments")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("organization_unit_id", "text", (col) => col.notNull())
    .addColumn("assigned_role", "text", (col) => col.notNull())
    .addColumn("is_primary", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_actor_org_unit_assignments", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_actor_assignments_actor")
    .on("actor_org_unit_assignments")
    .columns(["tenant_id", "actor_id"])
    .execute();

  // 2.4 authority_grants
  await db.schema
    .createTable("authority_grants")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("organization_unit_scope", "text")
    .addColumn("patient_id_scope", "text")
    .addColumn("target_resource_scope_json", "jsonb")
    .addColumn("required_authority_class", "text", (col) => col.notNull())
    .addColumn("issuer_actor_id", "text", (col) => col.notNull())
    .addColumn("grantee_actor_id", "text", (col) => col.notNull())
    .addColumn("permitted_capability", "text", (col) => col.notNull())
    .addColumn("authorization_binding_json", "jsonb")
    .addColumn("effective_from", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("parent_grant_id", "text")
    .addColumn("source_reference", "text")
    .addColumn("revocation_json", "jsonb")
    .addColumn("correlation_id", "text", (col) => col.notNull())
    .addColumn("causation_id", "text", (col) => col.notNull())
    .addColumn("audit_lineage_id", "text", (col) => col.notNull())
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_authority_grants", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_authority_grants_grantee")
    .on("authority_grants")
    .columns(["tenant_id", "grantee_actor_id", "permitted_capability"])
    .execute();

  await db.schema
    .createIndex("idx_authority_grants_patient")
    .on("authority_grants")
    .columns(["tenant_id", "patient_id_scope"])
    .execute();

  // 2.5 authorization_audit_log (Append-only)
  await db.schema
    .createTable("authorization_audit_log")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("decision_id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("organization_unit_id", "text")
    .addColumn("patient_id", "text")
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("actor_kind", "text", (col) => col.notNull())
    .addColumn("technical_subject_id", "text", (col) => col.notNull())
    .addColumn("requested_capability", "text", (col) => col.notNull())
    .addColumn("evaluated_authority_class", "text", (col) => col.notNull())
    .addColumn("outcome", "text", (col) => col.notNull())
    .addColumn("reason_code", "text", (col) => col.notNull())
    .addColumn("reason_facts_json", "jsonb", (col) => col.notNull())
    .addColumn("grants_considered_json", "jsonb", (col) => col.notNull().defaultTo("[]"))
    .addColumn("evaluated_policy_version", "text", (col) => col.notNull())
    .addColumn("correlation_id", "text", (col) => col.notNull())
    .addColumn("causation_id", "text", (col) => col.notNull())
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addPrimaryKeyConstraint("pk_authorization_audit_log", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createIndex("idx_auth_audit_tenant_occurred")
    .on("authorization_audit_log")
    .columns(["tenant_id", "occurred_at"])
    .execute();

  await db.schema
    .createIndex("idx_auth_audit_decision")
    .on("authorization_audit_log")
    .columns(["tenant_id", "decision_id"])
    .execute();

  // 2.6 actor_identity_mappings
  await db.schema
    .createTable("actor_identity_mappings")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("idp_issuer", "text", (col) => col.notNull())
    .addColumn("idp_subject", "text", (col) => col.notNull())
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("mapped_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_actor_identity_mappings", ["tenant_id", "id"])
    .addUniqueConstraint("uq_actor_idp_mapping", ["tenant_id", "idp_issuer", "idp_subject"])
    .execute();

  // 2.7 patient_identity_mappings
  await db.schema
    .createTable("patient_identity_mappings")
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("external_system", "text", (col) => col.notNull())
    .addColumn("external_patient_id", "text", (col) => col.notNull())
    .addColumn("patient_id", "text", (col) => col.notNull())
    .addColumn("mapped_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_patient_identity_mappings", ["tenant_id", "id"])
    .addUniqueConstraint("uq_patient_ext_mapping", [
      "tenant_id",
      "external_system",
      "external_patient_id",
    ])
    .execute();

  // 3. Apply Tenant-Level Row Level Security (RLS) to all 13 tenant-scoped tables
  const allTenantTables = [
    "clinical_evidence",
    "clinical_states",
    "clinical_intents",
    "execution_graphs",
    "therapy_access_cases",
    "domain_outbox_events", // Clarification 4: accurately named actual outbox table
    "actors",
    "organization_units",
    "actor_org_unit_assignments",
    "authority_grants",
    "authorization_audit_log",
    "actor_identity_mappings",
    "patient_identity_mappings",
  ];

  for (const tableName of allTenantTables) {
    await sql.raw(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`).execute(db);
    await sql.raw(`ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;`).execute(db);
    await sql.raw(`DROP POLICY IF EXISTS tenant_isolation_policy ON ${tableName};`).execute(db);
    await sql
      .raw(
        `CREATE POLICY tenant_isolation_policy ON ${tableName}
         FOR ALL
         TO sovereign_app
         USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text)
         WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text);`,
      )
      .execute(db);
  }

  // 4. Configure Application Role DB Permissions
  const readWriteTables = allTenantTables.filter((t) => t !== "authorization_audit_log");
  for (const table of readWriteTables) {
    await sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO sovereign_app;`).execute(db);
  }

  // Append-only for authorization_audit_log (NO UPDATE, NO DELETE granted to sovereign_app)
  await sql.raw(`REVOKE ALL ON authorization_audit_log FROM sovereign_app;`).execute(db);
  await sql.raw(`GRANT SELECT, INSERT ON authorization_audit_log TO sovereign_app;`).execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  const newTables = [
    "patient_identity_mappings",
    "actor_identity_mappings",
    "authorization_audit_log",
    "authority_grants",
    "actor_org_unit_assignments",
    "organization_units",
    "actors",
  ];

  for (const table of newTables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
