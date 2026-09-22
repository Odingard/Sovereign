import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
  withTenantTransaction,
} from "@sovereign/persistence";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";
const APP_URL = ADMIN_URL.replace(
  "sovereign_dev:sovereign_dev_password",
  "sovereign_app:sovereign_app_password",
);

const TENANT_A = "TENANT-SYN-S109-A";
const TENANT_B = "TENANT-SYN-S109-B";

describe("identity service schema (S1-09, migration 003)", () => {
  let admin: Kysely<SovereignPostgresDatabase>;
  let app: Kysely<SovereignPostgresDatabase>;

  beforeAll(async () => {
    admin = createPostgresKysely(ADMIN_URL);
    // Test files share one database and vitest runs them sequentially, so the schema
    // may already be migrated by an earlier file. runMigrationsUp is not idempotent,
    // so only run it when the identity tables are absent.
    const migrated = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenant'
      ) AS exists
    `
      .execute(admin)
      .then((r) => r.rows[0]?.exists === true);
    if (!migrated) {
      await runMigrationsUp(admin);
    }
    app = createPostgresKysely(APP_URL);
    for (const id of [TENANT_A, TENANT_B]) {
      await sql`INSERT INTO tenant (id, slug, display_name) VALUES (${id}, ${id.toLowerCase()}, ${id})
                ON CONFLICT (id) DO NOTHING`.execute(admin);
      await sql`INSERT INTO site (tenant_id, id, name, timezone)
                VALUES (${id}, ${`SITE-${id}`}, 'Synthetic Clinic', 'America/Chicago')
                ON CONFLICT DO NOTHING`.execute(admin);
    }
  });

  afterAll(async () => {
    await app?.destroy();
    await admin?.destroy();
  });

  it("isolates sites by tenant", async () => {
    const rows = await withTenantTransaction(app, TENANT_A, async (trx) =>
      sql<{ tenant_id: string }>`SELECT tenant_id FROM site`.execute(trx).then((r) => r.rows),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenant_id === TENANT_A)).toBe(true);
  });

  it("returns nothing from site without a tenant context", async () => {
    // Fails closed: no app.current_tenant means the policy matches no row.
    const rows = await sql<{ tenant_id: string }>`SELECT tenant_id FROM site`
      .execute(app)
      .then((r) => r.rows);
    expect(rows).toHaveLength(0);
  });

  it("refuses to write a site into another tenant", async () => {
    await expect(
      withTenantTransaction(app, TENANT_A, async (trx) =>
        sql`INSERT INTO site (tenant_id, id, name, timezone)
            VALUES (${TENANT_B}, 'SITE-FORGED', 'Forged', 'UTC')`.execute(trx),
      ),
    ).rejects.toThrow();
  });

  it("isolates wrapped key material by tenant", async () => {
    // Deliberately more restrictive than spec §7.1, which lists tenant_key as
    // RLS-exempt. One tenant must never read another's key material.
    for (const id of [TENANT_A, TENANT_B]) {
      await sql`INSERT INTO tenant_key (tenant_id, key_version, wrapped_dek, kek_resource)
                VALUES (${id}, 1, ${Buffer.from("synthetic-wrapped")}, 'fake://kek')
                ON CONFLICT DO NOTHING`.execute(admin);
    }
    const rows = await withTenantTransaction(app, TENANT_A, async (trx) =>
      sql<{ tenant_id: string }>`SELECT tenant_id FROM tenant_key`.execute(trx).then((r) => r.rows),
    );
    expect(rows.every((r) => r.tenant_id === TENANT_A)).toBe(true);
  });

  it("rejects an approval whose approver is its own requester", async () => {
    // Spec §10 test 9. Enforced by CHECK so application logic cannot forget it.
    await expect(
      sql`INSERT INTO approval (tenant_id, id, action, requested_by, approved_by, status)
          VALUES (${TENANT_A}, 'APPR-SELF', 'grant:create', 'ACTOR-1', 'ACTOR-1', 'approved')`.execute(
        admin,
      ),
    ).rejects.toThrow();
  });

  it("accepts an approval decided by a different actor", async () => {
    await expect(
      sql`INSERT INTO approval (tenant_id, id, action, requested_by, approved_by, status)
          VALUES (${TENANT_A}, 'APPR-OK', 'grant:create', 'ACTOR-1', 'ACTOR-2', 'approved')`.execute(
        admin,
      ),
    ).resolves.toBeDefined();
  });

  it("constrains tenant status to the documented set", async () => {
    await expect(
      sql`INSERT INTO tenant (id, slug, display_name, status)
          VALUES ('TENANT-BAD', 'bad', 'Bad', 'deleted')`.execute(admin),
    ).rejects.toThrow();
  });

  it("allows a platform-wide kill switch with no tenant", async () => {
    // tenant_id NULL means global. A tenant-scoped policy would hide it from
    // everyone, which is why kill_switch is RLS-exempt.
    await expect(
      sql`INSERT INTO kill_switch (id, tenant_id, capability, enabled, changed_by)
          VALUES ('KS-GLOBAL', NULL, 'ai.draft', false, 'ACTOR-SEC')`.execute(admin),
    ).resolves.toBeDefined();
  });

  it("stores only a hash for a SCIM connection token", async () => {
    const columns = await sql<{ column_name: string }>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'scim_connection'
    `
      .execute(admin)
      .then((r) => r.rows.map((c) => c.column_name));
    expect(columns).toContain("token_hash");
    expect(columns).not.toContain("token");
  });
});
