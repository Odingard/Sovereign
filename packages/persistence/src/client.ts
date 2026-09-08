/**
 * @file Sovereign PostgreSQL Kysely Factory
 */

import { Kysely, PostgresDialect, type Transaction, sql } from "kysely";
import { Pool } from "pg";
import type { SovereignPostgresDatabase } from "./schema.js";

export function createPostgresKysely(connectionString: string): Kysely<SovereignPostgresDatabase> {
  const pool = new Pool({
    connectionString,
  });

  return new Kysely<SovereignPostgresDatabase>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}

/**
 * Executes parameterized transaction-local tenant context binding for PostgreSQL RLS.
 * Parameter 3 (is_local = true) ensures the setting is cleared on COMMIT or ROLLBACK.
 */
export async function setTenantSession(
  trx: Transaction<SovereignPostgresDatabase> | Kysely<SovereignPostgresDatabase>,
  tenantId: string,
): Promise<void> {
  await sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`.execute(trx);
}

/**
 * Resets tenant session context.
 */
export async function clearTenantSession(
  trx: Transaction<SovereignPostgresDatabase> | Kysely<SovereignPostgresDatabase>,
): Promise<void> {
  await sql`SELECT set_config('app.current_tenant', '', true)`.execute(trx);
}

/**
 * Runs a transactional operation bound to a specific tenant context.
 */
export async function withTenantTransaction<T>(
  db: Kysely<SovereignPostgresDatabase>,
  tenantId: string,
  callback: (trx: Transaction<SovereignPostgresDatabase>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await setTenantSession(trx, tenantId);
    return callback(trx);
  });
}
