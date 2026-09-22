import type { AuditEventInput } from "@sovereign/contracts";
import { ActorKind } from "@sovereign/domain";
import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
} from "@sovereign/persistence";
import {
  appendToChain,
  verifyAgainstAnchors,
  verifyChain,
  writeAnchor,
} from "@sovereign/service-audit";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

const TENANT_A = "TENANT-SYN-AUDIT-A";
const TENANT_B = "TENANT-SYN-AUDIT-B";

let db: Kysely<SovereignPostgresDatabase>;
let counter = 0;

function event(tenantId: string, overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  counter += 1;
  return {
    eventId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    tenantId,
    siteId: null,
    actorKind: ActorKind.HUMAN_CLINICIAN,
    actorId: "ACTOR-SYN-1",
    roleGrant: null,
    patientId: null,
    resourceType: "patient",
    resourceId: null,
    resourceVersion: null,
    action: "patient.read",
    reason: null,
    occurredAt: new Date("2026-09-21T12:00:00Z"),
    requestId: "REQ-1",
    correlationId: "CORR-1",
    causationId: null,
    source: null,
    destination: null,
    policyVersion: "capability-registry@1",
    configVersion: null,
    modelVersion: null,
    promptVersion: null,
    priorState: null,
    newState: null,
    artifactHash: null,
    result: "success",
    errorCode: null,
    ...overrides,
  };
}

async function append(e: AuditEventInput) {
  return db.transaction().execute((trx) => appendToChain(trx, e));
}

beforeAll(async () => {
  db = createPostgresKysely(ADMIN_URL);
  const migrated = await sql<{ exists: boolean }>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='clinical_audit_event') AS exists
  `
    .execute(db)
    .then((r) => r.rows[0]?.exists === true);
  if (!migrated) {
    await runMigrationsUp(db);
  }
  await sql`DELETE FROM chain_anchor WHERE tenant_id IN (${TENANT_A}, ${TENANT_B})`.execute(db);
  await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
  await sql`DELETE FROM clinical_audit_event WHERE tenant_id IN (${TENANT_A}, ${TENANT_B})`.execute(
    db,
  );
  await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);
});

afterAll(async () => {
  await db?.destroy();
});

describe("audit chain append (S1-15)", () => {
  it("starts a tenant chain at seq 0 from the genesis hash", async () => {
    const position = await append(event(TENANT_A));
    expect(position.seq).toBe(0n);
    expect(position.prevHash).toMatch(/^0{64}$/);
    expect(position.duplicate).toBe(false);
  });

  it("links each event to the one before it", async () => {
    const first = await append(event(TENANT_A));
    const second = await append(event(TENANT_A));
    expect(second.seq).toBe(first.seq + 1n);
    expect(second.prevHash).toBe(first.eventHash);
  });

  it("keeps tenant chains independent", async () => {
    // Tenant B starts at its own genesis regardless of how long A's chain is.
    const b = await append(event(TENANT_B));
    expect(b.seq).toBe(0n);
    expect(b.prevHash).toMatch(/^0{64}$/);
  });

  it("treats a redelivered event as a no-op", async () => {
    // Pub/Sub is at-least-once (§8.5). A second append would fork the chain for
    // everyone downstream, so the duplicate is absorbed (spec §10 test 11).
    const e = event(TENANT_A);
    const first = await append(e);
    const again = await append(e);
    expect(again.duplicate).toBe(true);
    expect(again.seq).toBe(first.seq);
    const count = await sql<{ n: string }>`
      SELECT count(*) AS n FROM clinical_audit_event WHERE event_id = ${e.eventId}
    `
      .execute(db)
      .then((r) => Number(r.rows[0]?.n));
    expect(count).toBe(1);
  });

  it("serialises concurrent appends into a linear chain", async () => {
    // The advisory lock is what stops two consumers claiming the same seq.
    const events = Array.from({ length: 12 }, () => event(TENANT_A));
    await Promise.all(events.map(append));
    const result = await verifyChain(db, TENANT_A);
    expect(result.verified).toBe(true);
  });
});

describe("append-only enforcement (S1-15)", () => {
  it("blocks UPDATE even for the table owner", async () => {
    // Role grants are layers 1 and 2; this trigger is layer 3 and fires for the owner
    // and a superuser too.
    await expect(
      sql`UPDATE clinical_audit_event SET action = 'tampered' WHERE tenant_id = ${TENANT_A}`.execute(
        db,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it("blocks DELETE even for the table owner", async () => {
    await expect(
      sql`DELETE FROM clinical_audit_event WHERE tenant_id = ${TENANT_A}`.execute(db),
    ).rejects.toThrow(/append-only/i);
  });

  it("refuses a duplicate sequence number for a tenant", async () => {
    await expect(
      sql`INSERT INTO clinical_audit_event (
            event_id, tenant_id, actor_kind, resource_type, action, occurred_at,
            request_id, correlation_id, policy_version, result, seq, prev_hash, event_hash
          ) VALUES ('dupe-seq', ${TENANT_A}, 'HUMAN_STAFF', 'patient', 'x', now(),
            'R', 'C', 'p@1', 'success', 0, '\\x00', '\\x00')`.execute(db),
    ).rejects.toThrow();
  });
});

describe("chain verification (S1-15)", () => {
  it("verifies a healthy chain", async () => {
    const result = await verifyChain(db, TENANT_A);
    expect(result.verified).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.eventsChecked).toBeGreaterThan(0);
  });

  it("detects a single flipped byte", async () => {
    // Spec §10 test 12. The trigger is disabled only to simulate an attacker who
    // already bypassed it; the point is that verification still catches them.
    const target = await sql<{ event_id: string }>`
      SELECT event_id FROM clinical_audit_event WHERE tenant_id = ${TENANT_B} ORDER BY seq LIMIT 1
    `
      .execute(db)
      .then((r) => r.rows[0]?.event_id);

    await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
    await sql`UPDATE clinical_audit_event SET action = 'silently.changed' WHERE event_id = ${target}`.execute(
      db,
    );
    await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);

    const result = await verifyChain(db, TENANT_B);
    expect(result.verified).toBe(false);
    expect(result.failures[0]?.reason).toBe("hash_mismatch");
    expect(result.failures[0]?.eventId).toBe(target);
  });

  it("reports an empty chain as verified with nothing checked", async () => {
    const result = await verifyChain(db, "TENANT-SYN-AUDIT-EMPTY");
    expect(result.verified).toBe(true);
    expect(result.eventsChecked).toBe(0);
    expect(result.lastSeq).toBeNull();
  });
});

describe("anchoring (S1-15)", () => {
  it("anchors a verified chain", async () => {
    const anchor = await writeAnchor(db, TENANT_A, "2026-09-21", "gs://audit-anchors-dev/a.json");
    expect(anchor).not.toBeNull();
    expect(anchor?.lastHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses to anchor a corrupted chain", async () => {
    // An anchor over a corrupted chain would certify the corruption, which is worse
    // than having no anchor.
    await expect(writeAnchor(db, TENANT_B, "2026-09-21")).rejects.toThrow(/verification failed/i);
  });

  it("returns null for a tenant with no events", async () => {
    expect(await writeAnchor(db, "TENANT-SYN-AUDIT-EMPTY", "2026-09-21")).toBeNull();
  });

  it("matches the chain against its anchors", async () => {
    expect((await verifyAgainstAnchors(db, TENANT_A)).verified).toBe(true);
  });

  it("detects a rewrite that recomputed every hash consistently", async () => {
    // The attack verifyChain alone cannot see: full database access, chain rebuilt so
    // it verifies internally. The anchor lives where they cannot reach it.
    const anchored = await sql<{ last_seq: string }>`
      SELECT last_seq FROM chain_anchor WHERE tenant_id = ${TENANT_A} LIMIT 1
    `
      .execute(db)
      .then((r) => r.rows[0]?.last_seq);

    await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
    await sql`UPDATE clinical_audit_event SET event_hash = ${Buffer.alloc(32, 0xab)}
              WHERE tenant_id = ${TENANT_A} AND seq = ${anchored}`.execute(db);
    await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);

    const result = await verifyAgainstAnchors(db, TENANT_A);
    expect(result.verified).toBe(false);
    expect(result.mismatchedAnchors).toContain("2026-09-21");
  });
});
