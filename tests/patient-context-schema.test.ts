import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
} from "@sovereign/persistence";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

const TENANT = "TENANT-SYN-PCTX";
let db: Kysely<SovereignPostgresDatabase>;

beforeAll(async () => {
  db = createPostgresKysely(ADMIN_URL);
  const migrated = await sql<{ exists: boolean }>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='clinical_fact') AS exists
  `
    .execute(db)
    .then((r) => r.rows[0]?.exists === true);
  if (!migrated) {
    await runMigrationsUp(db);
  }
  await sql`INSERT INTO source_system (tenant_id, id, kind, display_name)
            VALUES (${TENANT}, 'SRC-FIXTURE', 'fixture', 'Synthetic fixture feed')
            ON CONFLICT DO NOTHING`.execute(db);
  await sql`INSERT INTO patient (tenant_id, id, match_state)
            VALUES (${TENANT}, 'PAT-1', 'confirmed') ON CONFLICT DO NOTHING`.execute(db);
  await sql`INSERT INTO source_artifact (tenant_id, id, source_system_id, artifact_type, content_hash)
            VALUES (${TENANT}, 'ART-1', 'SRC-FIXTURE', 'note', ${Buffer.alloc(32, 1)})
            ON CONFLICT DO NOTHING`.execute(db);
});

afterAll(async () => {
  await db?.destroy();
});

describe("patient context schema (S1-14, migration 005)", () => {
  it("refuses a merged patient with no merge target", async () => {
    // Without this a record can be marked merged and lose the pointer, which is how a
    // merge becomes an unrecoverable deletion.
    await expect(
      sql`INSERT INTO patient (tenant_id, id, match_state) VALUES (${TENANT}, 'PAT-BAD', 'merged')`.execute(
        db,
      ),
    ).rejects.toThrow();
  });

  it("refuses an unmerged patient that points at a merge target", async () => {
    await expect(
      sql`INSERT INTO patient (tenant_id, id, match_state, merged_into)
          VALUES (${TENANT}, 'PAT-BAD2', 'confirmed', 'PAT-1')`.execute(db),
    ).rejects.toThrow();
  });

  it("refuses a patient merged into itself", async () => {
    await expect(
      sql`INSERT INTO patient (tenant_id, id, match_state, merged_into)
          VALUES (${TENANT}, 'PAT-SELF', 'merged', 'PAT-SELF')`.execute(db),
    ).rejects.toThrow();
  });

  it("constrains match_state to the documented set", async () => {
    await expect(
      sql`INSERT INTO patient (tenant_id, id, match_state) VALUES (${TENANT}, 'PAT-X', 'probably')`.execute(
        db,
      ),
    ).rejects.toThrow();
  });

  it("enforces one identifier value per source system and type", async () => {
    // This uniqueness is what makes "exact MRN match" a single lookup rather than a
    // scan with a tie-break.
    const insert = (id: string) =>
      sql`INSERT INTO patient_identifier
            (tenant_id, id, patient_id, source_system_id, identifier_type,
             identifier_value_hash, identifier_value_enc)
          VALUES (${TENANT}, ${id}, 'PAT-1', 'SRC-FIXTURE', 'MRN',
                  ${Buffer.alloc(32, 7)}, ${Buffer.from("enc")})`.execute(db);
    await insert("PID-1");
    await expect(insert("PID-2")).rejects.toThrow();
  });

  it("stores identifier values encrypted, with no plaintext column", async () => {
    const columns = await sql<{ column_name: string }>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'patient_identifier'
    `
      .execute(db)
      .then((r) => r.rows.map((c) => c.column_name));
    expect(columns).toContain("identifier_value_hash");
    expect(columns).toContain("identifier_value_enc");
    expect(columns).not.toContain("identifier_value");
  });

  it("refuses a correction that does not say what it supersedes", async () => {
    await expect(
      sql`INSERT INTO clinical_fact
            (tenant_id, id, patient_id, fact_type, source_artifact_id, origin, state)
          VALUES (${TENANT}, 'FACT-BAD', 'PAT-1', 'condition', 'ART-1', 'human_correction', 'current')`.execute(
        db,
      ),
    ).rejects.toThrow();
  });

  it("blocks DELETE on a clinical fact", async () => {
    await sql`INSERT INTO clinical_fact
                (tenant_id, id, patient_id, fact_type, source_artifact_id, origin, state)
              VALUES (${TENANT}, 'FACT-1', 'PAT-1', 'condition', 'ART-1', 'recorded', 'current')
              ON CONFLICT DO NOTHING`.execute(db);
    await expect(
      sql`DELETE FROM clinical_fact WHERE tenant_id = ${TENANT} AND id = 'FACT-1'`.execute(db),
    ).rejects.toThrow(/insert-only/i);
  });

  it("blocks editing a clinical fact's content", async () => {
    // ADR-0001: preserve source data, append corrections. A correction inserts a new
    // row; it never rewrites the old one.
    await expect(
      sql`UPDATE clinical_fact SET fact_type = 'rewritten'
          WHERE tenant_id = ${TENANT} AND id = 'FACT-1'`.execute(db),
    ).rejects.toThrow(/insert-only/i);
  });

  it("permits only the supersession state flag on an existing fact", async () => {
    await expect(
      sql`UPDATE clinical_fact SET state = 'superseded'
          WHERE tenant_id = ${TENANT} AND id = 'FACT-1'`.execute(db),
    ).resolves.toBeDefined();
  });

  it("keeps unknown as a first-class fact state", async () => {
    // AGENTS.md doctrine 7: unknown is not negative, and it is not an error either.
    await expect(
      sql`INSERT INTO clinical_fact
            (tenant_id, id, patient_id, fact_type, source_artifact_id, origin, state)
          VALUES (${TENANT}, 'FACT-UNK', 'PAT-1', 'screening', 'ART-1', 'recorded', 'unknown')`.execute(
        db,
      ),
    ).resolves.toBeDefined();
  });
});
