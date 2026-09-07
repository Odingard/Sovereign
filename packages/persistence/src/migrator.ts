/**
 * @file Sovereign Database Migration Runner
 */

import type { Kysely } from "kysely";
import * as initialMigration from "./migrations/001_initial_canonical_schema.js";

export async function runMigrationsUp(db: Kysely<any>): Promise<void> {
  await initialMigration.up(db);
}

export async function runMigrationsDown(db: Kysely<any>): Promise<void> {
  await initialMigration.down(db);
}
