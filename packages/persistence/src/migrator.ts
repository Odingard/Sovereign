/**
 * @file Sovereign Database Migration Runner
 */

import type { Kysely } from "kysely";
import * as initialMigration from "./migrations/001_initial_canonical_schema.js";
import * as identityAuthorityMigration from "./migrations/002_identity_and_authority_schema.js";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function runMigrationsUp(db: Kysely<any>): Promise<void> {
  await initialMigration.up(db);
  await identityAuthorityMigration.up(db);
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function runMigrationsDown(db: Kysely<any>): Promise<void> {
  await identityAuthorityMigration.down(db);
  await initialMigration.down(db);
}
