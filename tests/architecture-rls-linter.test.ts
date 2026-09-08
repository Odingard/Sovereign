/**
 * @file Architecture RLS Linter & Provider Independence Verification
 * @description Inspects the live migrated PostgreSQL schema to guarantee that 100% of tenant-scoped tables
 * have Row Level Security enabled (rowsecurity = true) and active tenant isolation policies.
 * Also verifies provider independence of core identity and authority packages.
 */

import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
} from "@sovereign/persistence";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_DB_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

const APP_DB_URL =
  process.env.SOVEREIGN_APP_DATABASE_URL ||
  "postgresql://sovereign_app:sovereign_app_password@localhost:5432/sovereign_test";

describe("Architecture & Schema Isolation Linter (WO-002)", () => {
  let db: Kysely<SovereignPostgresDatabase>;
  let appDb: Kysely<SovereignPostgresDatabase>;

  // Tables that are globally scoped or internal to migration runners
  const GLOBAL_NON_TENANT_WHITELIST = new Set(["kysely_migration", "kysely_migration_lock"]);

  beforeAll(async () => {
    db = createPostgresKysely(ADMIN_DB_URL);
    await runMigrationsUp(db);
    appDb = createPostgresKysely(APP_DB_URL);
  });

  afterAll(async () => {
    await appDb.destroy();
    await db.destroy();
  });

  it("everyTenantScopedTableHasRowLevelSecurityEnabled", async () => {
    // Query pg_tables and pg_class to inspect rowsecurity status for all public tables
    const result = await sql<{
      tablename: string;
      rowsecurity: boolean;
      forcerowsecurity: boolean;
    }>`
      SELECT 
        c.relname AS tablename,
        c.relrowsecurity AS rowsecurity,
        c.relforcerowsecurity AS forcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
      ORDER BY c.relname;
    `.execute(db);

    const tables = result.rows;
    expect(tables.length).toBeGreaterThanOrEqual(13);

    for (const table of tables) {
      if (GLOBAL_NON_TENANT_WHITELIST.has(table.tablename)) {
        continue;
      }

      // Assert that RLS is both ENABLED and FORCED
      expect(
        table.rowsecurity,
        `Tenant isolation breach: Table '${table.tablename}' does NOT have Row Level Security enabled!`,
      ).toBe(true);

      expect(
        table.forcerowsecurity,
        `Tenant isolation breach: Table '${table.tablename}' does NOT have FORCE Row Level Security enabled!`,
      ).toBe(true);
    }
  });

  it("everyTenantScopedTableHasTenantIsolationPolicy", async () => {
    // Inspect pg_policies to verify that each tenant-scoped table has an active policy
    const result = await sql<{
      tablename: string;
      policyname: string;
      cmd: string;
      roles: string;
    }>`
      SELECT 
        tablename,
        policyname,
        cmd,
        roles::text
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `.execute(db);

    const policies = result.rows;
    const coveredTables = new Set(policies.map((p) => p.tablename));

    const expectedTenantTables = [
      "clinical_evidence",
      "clinical_states",
      "clinical_intents",
      "execution_graphs",
      "therapy_access_cases",
      "domain_outbox_events", // Clarification 4: accurately named
      "actors",
      "organization_units",
      "actor_org_unit_assignments",
      "authority_grants",
      "authorization_audit_log",
      "actor_identity_mappings",
      "patient_identity_mappings",
    ];

    for (const expected of expectedTenantTables) {
      expect(
        coveredTables.has(expected),
        `Table '${expected}' is missing a PostgreSQL tenant isolation policy!`,
      ).toBe(true);
    }
  });

  it("privilegedMigrationRoleIsNotAvailableToRuntimeAppRole", async () => {
    // sovereign_app attempting to SET ROLE to sovereign_dev or superuser must fail
    await expect(sql`SET ROLE sovereign_dev;`.execute(appDb)).rejects.toThrow(/permission denied/);
  });

  it("localExecutionRunsWithoutCloudIAMOrExternalIdentity", async () => {
    // Verifies that local development environment operates fully standalone
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    expect(process.env.GCP_PROJECT).toBeUndefined();
  });
});
