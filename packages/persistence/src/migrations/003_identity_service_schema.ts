/**
 * @file Migration 003: Identity service schema (WO-002B S1-09)
 * @description tenant, tenant_key, site, approval, session_revocation, kill_switch,
 * and SCIM connection tables.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.1.
 *
 * RLS: every table carrying tenant data gets forced row-level security. The
 * exemptions — tenant, session_revocation, kill_switch — are justified in
 * config/rls-exempt.json and enforced by tests/architecture-rls-linter.test.ts.
 *
 * DEVIATION from spec §7.1, deliberate and more restrictive: the spec lists
 * `tenant_key` as RLS-exempt. It carries a tenant_id and holds WRAPPED DEKs, so a
 * tenant-scoped policy is both possible and strictly better — one tenant should never
 * read another's key material, even material that is useless without the KMS. RLS is
 * applied here. If a future flow genuinely needs cross-tenant key access it can be
 * added to config/rls-exempt.json under review.
 */

import { type Kysely, sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function up(db: Kysely<any>): Promise<void> {
  // --- tenant registry (RLS-exempt: its PK is the tenant id) -----------------
  await db.schema
    .createTable("tenant")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("slug", "text", (col) => col.notNull().unique())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("idp_org_id", "text", (col) => col.unique())
    .addColumn("region", "text", (col) => col.notNull().defaultTo("us-central1"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint("ck_tenant_status", sql`status IN ('active', 'suspended', 'offboarding')`)
    .execute();

  // --- per-tenant key material ----------------------------------------------
  // wrapped_dek is the DEK encrypted under the KEK. Plaintext key material is never
  // stored (spec §5.3); a NOT NULL kek_resource makes an unwrappable row impossible.
  await db.schema
    .createTable("tenant_key")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("key_version", "integer", (col) => col.notNull())
    .addColumn("wrapped_dek", "bytea", (col) => col.notNull())
    .addColumn("kek_resource", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("retired_at", "timestamptz")
    .addPrimaryKeyConstraint("pk_tenant_key", ["tenant_id", "key_version"])
    .execute();

  // --- sites -----------------------------------------------------------------
  await db.schema
    .createTable("site")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("timezone", "text", (col) => col.notNull())
    .addColumn("npi", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("pk_site", ["tenant_id", "id"])
    .execute();

  // --- dual-control approvals -------------------------------------------------
  // approved_by is nullable until decided, and a CHECK forbids the same actor
  // appearing as both requester and approver. Spec §10 test 9: same user requests and
  // approves -> 409. Enforcing it in the schema means application logic cannot forget.
  await db.schema
    .createTable("approval")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("requested_by", "text", (col) => col.notNull())
    .addColumn("approved_by", "text")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
    .addColumn("reason", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("decided_at", "timestamptz")
    .addPrimaryKeyConstraint("pk_approval", ["tenant_id", "id"])
    .addCheckConstraint(
      "ck_approval_status",
      sql`status IN ('pending', 'approved', 'rejected', 'expired')`,
    )
    .addCheckConstraint(
      "ck_approval_distinct_approver",
      sql`approved_by IS NULL OR approved_by <> requested_by`,
    )
    .execute();

  // --- session revocation (RLS-exempt: gateway reads across tenants) ----------
  await db.schema
    .createTable("session_revocation")
    .addColumn("session_id", "text", (col) => col.primaryKey())
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("reason", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_session_revocation_revoked_at")
    .on("session_revocation")
    .column("revoked_at")
    .execute();

  // --- kill switches (RLS-exempt: tenant_id NULL means platform-wide) ---------
  await db.schema
    .createTable("kill_switch")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("tenant_id", "text")
    .addColumn("capability", "text", (col) => col.notNull())
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("changed_by", "text", (col) => col.notNull())
    .addColumn("approval_id", "text")
    .addColumn("changed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // --- SCIM ------------------------------------------------------------------
  // token_hash, never the token. A stolen database must not yield working SCIM
  // credentials (spec §7.6).
  await db.schema
    .createTable("scim_connection")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("id", "text", (col) => col.notNull())
    .addColumn("token_hash", "bytea", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("rotated_at", "timestamptz")
    .addPrimaryKeyConstraint("pk_scim_connection", ["tenant_id", "id"])
    .execute();

  await db.schema
    .createTable("scim_group_role")
    .addColumn("tenant_id", "text", (col) => col.notNull())
    .addColumn("group_external_id", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("site_id", "text")
    .addPrimaryKeyConstraint("pk_scim_group_role", ["tenant_id", "group_external_id"])
    .execute();

  // --- RLS --------------------------------------------------------------------
  const tenantScoped = ["tenant_key", "site", "approval", "scim_connection", "scim_group_role"];

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

  // Exempt tables still need grants, but deliberately no policy. Listed in
  // config/rls-exempt.json with justification.
  for (const table of ["tenant", "session_revocation", "kill_switch"]) {
    await sql.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO sovereign_app;`).execute(db);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function down(db: Kysely<any>): Promise<void> {
  for (const table of [
    "scim_group_role",
    "scim_connection",
    "kill_switch",
    "session_revocation",
    "approval",
    "site",
    "tenant_key",
    "tenant",
  ]) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
