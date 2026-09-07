/**
 * @file Sovereign PostgreSQL Kysely Factory
 */

import { Kysely, PostgresDialect } from "kysely";
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
