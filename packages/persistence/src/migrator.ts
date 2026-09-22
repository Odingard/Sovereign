/**
 * @file Sovereign Database Migration Runner
 */

import type { Kysely } from "kysely";
import * as initialMigration from "./migrations/001_initial_canonical_schema.js";
import * as identityAuthorityMigration from "./migrations/002_identity_and_authority_schema.js";
import * as identityServiceMigration from "./migrations/003_identity_service_schema.js";
import * as auditChainMigration from "./migrations/004_audit_chain_schema.js";
import * as patientContextMigration from "./migrations/005_patient_context_schema.js";
import * as retentionMigration from "./migrations/006_retention_and_legal_hold.js";
import * as siemExportMigration from "./migrations/007_siem_export.js";

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function runMigrationsUp(db: Kysely<any>): Promise<void> {
  await initialMigration.up(db);
  await identityAuthorityMigration.up(db);
  await identityServiceMigration.up(db);
  await auditChainMigration.up(db);
  await patientContextMigration.up(db);
  await retentionMigration.up(db);
  await siemExportMigration.up(db);
}

// biome-ignore lint/suspicious/noExplicitAny: Kysely migration runner standard type
export async function runMigrationsDown(db: Kysely<any>): Promise<void> {
  await siemExportMigration.down(db);
  await retentionMigration.down(db);
  await patientContextMigration.down(db);
  await auditChainMigration.down(db);
  await identityServiceMigration.down(db);
  await identityAuthorityMigration.down(db);
  await initialMigration.down(db);
}
