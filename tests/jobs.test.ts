/**
 * Background job tests (WO-002C S1-15) — outbox relay and audit anchor.
 *
 * Both jobs run with @systemScope authority, which is the widest authority anything in
 * Sovereign holds. These tests are mostly about what that authority does NOT get to do.
 */

import type { AuditEventInput } from "@sovereign/contracts";
import { ActorKind } from "@sovereign/domain";
import { type AnchorStorage, runAnchorJob } from "@sovereign/job-audit-anchor";
import { type EventPublisher, type OutboxEvent, runRelayPass } from "@sovereign/job-outbox-relay";
import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
} from "@sovereign/persistence";
import { appendToChain } from "@sovereign/service-audit";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ADMIN_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

const TENANT_A = "TENANT-SYN-JOB-A";
const TENANT_B = "TENANT-SYN-JOB-B";
const TENANT_QUIET = "TENANT-SYN-JOB-QUIET";
const TENANTS = [TENANT_A, TENANT_B, TENANT_QUIET];

let db: Kysely<SovereignPostgresDatabase>;
let counter = 0;

/** Collects what was published so a test can assert on ordering and contents. */
/**
 * Collects published events, and exposes only this suite's tenants.
 *
 * `runRelayPass` drains every tenant in the database, which is what it is for. Other
 * suites leave their own undispatched rows behind, so a global count here would depend
 * on file order. Every assertion below is scoped to this suite's tenants instead.
 */
function recordingPublisher(failFor: readonly string[] = []) {
  const published: OutboxEvent[] = [];
  const publisher: EventPublisher = {
    async publish(_topic, event) {
      if (failFor.includes(event.tenantId)) {
        throw new Error("bus unreachable");
      }
      published.push(event);
    },
  };
  return {
    publisher,
    published,
    mine: () => published.filter((e) => TENANTS.includes(e.tenantId)),
  };
}

function recordingStorage(failFor: readonly string[] = []) {
  const written: { tenantId: string; body: string }[] = [];
  const storage: AnchorStorage = {
    async put(tenantId, anchorDate, body) {
      if (failFor.includes(tenantId)) {
        throw new Error("bucket unreachable");
      }
      written.push({ tenantId, body });
      return `gs://sovereign-anchors-syn/${tenantId}/${anchorDate}.json`;
    },
  };
  return {
    storage,
    written,
    mine: () => written.filter((w) => TENANTS.includes(w.tenantId)),
  };
}

/** Anchors it for this suite's tenants only — other suites register tenants too. */
function ours(tenantIds: readonly string[]): string[] {
  return tenantIds.filter((t) => TENANTS.includes(t));
}

async function insertOutboxEvent(tenantId: string, name: string, occurredAt: string) {
  counter += 1;
  await sql`
    INSERT INTO domain_outbox_events
      (id, tenant_id, event_name, aggregate_id, aggregate_version, schema_version,
       actor_id, correlation_id, causation_id, payload_json, occurred_at)
    VALUES (${`OBX-SYN-${counter}`}, ${tenantId}, ${name}, ${"AGG-SYN-1"}, 1, 1,
            ${"ACTOR-SYN-1"}, ${"CORR-SYN-1"}, ${"CAUS-SYN-1"},
            ${sql.lit('{"note":"synthetic"}')}::jsonb, ${occurredAt}::timestamptz)
  `.execute(db);
  return `OBX-SYN-${counter}`;
}

function auditEvent(tenantId: string): AuditEventInput {
  counter += 1;
  return {
    eventId: `10000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
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
  };
}

async function clean() {
  await sql`DELETE FROM domain_outbox_events WHERE tenant_id = ANY(${TENANTS})`.execute(db);
  await sql`DELETE FROM chain_anchor WHERE tenant_id = ANY(${TENANTS})`.execute(db);
  await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
  await sql`DELETE FROM clinical_audit_event WHERE tenant_id = ANY(${TENANTS})`.execute(db);
  await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);
}

beforeAll(async () => {
  db = createPostgresKysely(ADMIN_URL);
  const migrated = await sql<{ exists: boolean }>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='domain_outbox_events') AS exists
  `
    .execute(db)
    .then((r) => r.rows[0]?.exists === true);
  if (!migrated) {
    await runMigrationsUp(db);
  }
  for (const id of TENANTS) {
    await sql`
      INSERT INTO tenant (id, slug, display_name)
      VALUES (${id}, ${id.toLowerCase()}, ${id})
      ON CONFLICT (id) DO NOTHING
    `.execute(db);
  }
});

beforeEach(clean);

afterAll(async () => {
  await clean();
  await sql`DELETE FROM tenant WHERE id = ANY(${TENANTS})`.execute(db);
  await db?.destroy();
});

describe("outbox relay (S1-15, spec §5.2)", () => {
  it("publishes pending events and marks them dispatched", async () => {
    await insertOutboxEvent(TENANT_A, "patient.updated", "2026-09-21T10:00:00Z");
    const { publisher, mine } = recordingPublisher();

    await runRelayPass(db, publisher);

    expect(mine()).toHaveLength(1);
    expect(mine()[0]?.eventName).toBe("patient.updated");
    const pending = await sql<{ n: string }>`
      SELECT count(*) AS n FROM domain_outbox_events
      WHERE tenant_id = ${TENANT_A} AND dispatched_at IS NULL
    `.execute(db);
    expect(pending.rows[0]?.n).toBe("0");
  });

  it("does not republish an event it already dispatched", async () => {
    await insertOutboxEvent(TENANT_A, "patient.updated", "2026-09-21T10:00:00Z");
    const first = recordingPublisher();
    await runRelayPass(db, first.publisher);
    const second = recordingPublisher();
    await runRelayPass(db, second.publisher);
    expect(first.mine()).toHaveLength(1);
    expect(second.mine()).toHaveLength(0);
  });

  it("draws every tenant's events through that tenant's own context", async () => {
    // The whole reason this job iterates rather than issuing one cross-tenant query
    // (G-53). Both tenants must still be fully drained.
    await insertOutboxEvent(TENANT_A, "a.one", "2026-09-21T10:00:00Z");
    await insertOutboxEvent(TENANT_B, "b.one", "2026-09-21T10:01:00Z");
    const { publisher, mine } = recordingPublisher();

    await runRelayPass(db, publisher);

    expect(
      mine()
        .map((e) => e.tenantId)
        .sort(),
    ).toEqual([TENANT_A, TENANT_B]);
  });

  it("keeps one tenant's failure from stopping every other tenant", async () => {
    // A poison event or an unreachable topic for one clinic must not become an
    // outage for the platform.
    await insertOutboxEvent(TENANT_A, "a.one", "2026-09-21T10:00:00Z");
    await insertOutboxEvent(TENANT_B, "b.one", "2026-09-21T10:01:00Z");
    const { publisher, mine } = recordingPublisher([TENANT_A]);

    const result = await runRelayPass(db, publisher);

    expect(result.tenantsFailed.filter((t) => TENANTS.includes(t))).toEqual([TENANT_A]);
    expect(mine().map((e) => e.tenantId)).toEqual([TENANT_B]);
  });

  it("leaves an event undispatched when its publish failed", async () => {
    // Publish-then-mark, inside one transaction. The event must still be there for
    // the next pass — losing it is the single outcome the outbox exists to prevent.
    await insertOutboxEvent(TENANT_A, "a.one", "2026-09-21T10:00:00Z");
    await runRelayPass(db, recordingPublisher([TENANT_A]).publisher);

    const pending = await sql<{ n: string }>`
      SELECT count(*) AS n FROM domain_outbox_events
      WHERE tenant_id = ${TENANT_A} AND dispatched_at IS NULL
    `.execute(db);
    expect(pending.rows[0]?.n).toBe("1");

    const retry = recordingPublisher();
    await runRelayPass(db, retry.publisher);
    expect(retry.mine()).toHaveLength(1);
  });

  it("carries no event detail out with a failure", async () => {
    // The relay reports which tenant failed and nothing else. An error message that
    // quotes a payload turns a delivery failure into a PHI disclosure in the logs.
    await insertOutboxEvent(TENANT_A, "a.one", "2026-09-21T10:00:00Z");
    const result = await runRelayPass(db, recordingPublisher([TENANT_A]).publisher);
    expect(JSON.stringify(result)).not.toContain("synthetic");
    expect(JSON.stringify(result)).not.toContain("bus unreachable");
  });

  it("publishes in occurrence order within a tenant", async () => {
    await insertOutboxEvent(TENANT_A, "second", "2026-09-21T11:00:00Z");
    await insertOutboxEvent(TENANT_A, "first", "2026-09-21T09:00:00Z");
    const { publisher, mine } = recordingPublisher();
    await runRelayPass(db, publisher);
    expect(mine().map((e) => e.eventName)).toEqual(["first", "second"]);
  });

  it("bounds how much one tenant takes in a single pass", async () => {
    // Without a bound, one tenant's backlog delays every tenant behind it.
    await insertOutboxEvent(TENANT_A, "a.one", "2026-09-21T10:00:00Z");
    await insertOutboxEvent(TENANT_A, "a.two", "2026-09-21T10:01:00Z");
    await insertOutboxEvent(TENANT_A, "a.three", "2026-09-21T10:02:00Z");
    const { publisher, mine } = recordingPublisher();
    await runRelayPass(db, publisher, { batchSize: 2 });
    expect(mine()).toHaveLength(2);
  });

  it("does nothing, loudly or otherwise, when there is no work", async () => {
    const { publisher, mine } = recordingPublisher();
    await runRelayPass(db, publisher);
    expect(mine()).toHaveLength(0);
  });
});

describe("audit anchor (S1-15, spec §7.3)", () => {
  async function append(tenantId: string) {
    return db.transaction().execute((trx) => appendToChain(trx, auditEvent(tenantId)));
  }

  it("anchors each tenant at its own chain head", async () => {
    await append(TENANT_A);
    const aHead = await append(TENANT_A);
    const bHead = await append(TENANT_B);
    const { storage, mine } = recordingStorage();

    await runAnchorJob(db, storage, "2026-09-22");

    expect(
      mine()
        .map((w) => w.tenantId)
        .sort(),
    ).toEqual([TENANT_A, TENANT_B]);
    const rows = await sql<{ tenant_id: string; last_seq: string; last_hash: Buffer }>`
      SELECT tenant_id, last_seq, last_hash FROM chain_anchor
      WHERE anchor_date = '2026-09-22'::date AND tenant_id = ANY(${TENANTS})
      ORDER BY tenant_id
    `.execute(db);
    expect(rows.rows.map((r) => r.tenant_id)).toEqual([TENANT_A, TENANT_B]);
    expect(rows.rows[0]?.last_seq).toBe(aHead.seq.toString());
    expect(rows.rows[0]?.last_hash.toString("hex")).toBe(aHead.eventHash);
    expect(rows.rows[1]?.last_seq).toBe(bHead.seq.toString());
  });

  it("names a tenant whose chain is empty rather than skipping it silently", async () => {
    await append(TENANT_A);
    const result = await runAnchorJob(db, recordingStorage().storage, "2026-09-22");
    expect(ours(result.tenantsWithNoEvents).sort()).toEqual([TENANT_B, TENANT_QUIET]);
  });

  it("refuses to anchor a chain that does not verify", async () => {
    // An anchor over a rewritten chain launders the rewrite: it makes the corrupted
    // state the officially attested one. No anchor is strictly better.
    await append(TENANT_A);
    const target = await append(TENANT_A);
    await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
    await sql`
      UPDATE clinical_audit_event SET action = 'patient.export'
      WHERE tenant_id = ${TENANT_A} AND seq = ${target.seq.toString()}
    `.execute(db);
    await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);

    const { storage, mine } = recordingStorage();
    const result = await runAnchorJob(db, storage, "2026-09-22");

    expect(ours(result.tenantsFailingVerification)).toEqual([TENANT_A]);
    expect(mine()).toHaveLength(0);
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM chain_anchor WHERE tenant_id = ${TENANT_A}
    `.execute(db);
    expect(rows.rows[0]?.n).toBe("0");
  });

  it("still anchors every other tenant when one tenant's chain is broken", async () => {
    // A night with no anchors anywhere is a night in which any rewrite goes unseen.
    const target = await append(TENANT_A);
    await append(TENANT_B);
    await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
    await sql`
      UPDATE clinical_audit_event SET action = 'patient.export'
      WHERE tenant_id = ${TENANT_A} AND seq = ${target.seq.toString()}
    `.execute(db);
    await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);

    const { storage, mine } = recordingStorage();
    const result = await runAnchorJob(db, storage, "2026-09-22");

    expect(ours(result.tenantsFailingVerification)).toEqual([TENANT_A]);
    expect(mine().map((w) => w.tenantId)).toEqual([TENANT_B]);
  });

  it("writes no database row when the retention-locked write failed", async () => {
    // The row is the weaker record — it sits where an operator can reach it. It must
    // never claim an object exists in the locked bucket when none does.
    await append(TENANT_A);
    const { storage } = recordingStorage([TENANT_A]);
    await expect(runAnchorJob(db, storage, "2026-09-22")).rejects.toThrow();
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM chain_anchor WHERE tenant_id = ${TENANT_A}
    `.execute(db);
    expect(rows.rows[0]?.n).toBe("0");
  });

  it("records the storage reference on the anchor row", async () => {
    await append(TENANT_A);
    await runAnchorJob(db, recordingStorage().storage, "2026-09-22");
    const rows = await sql<{ gcs_ref: string | null }>`
      SELECT gcs_ref FROM chain_anchor WHERE tenant_id = ${TENANT_A}
    `.execute(db);
    expect(rows.rows[0]?.gcs_ref).toContain(TENANT_A);
  });

  it("is safe to run twice for the same date", async () => {
    // A retried nightly job must not produce two anchors for one day, and must not
    // fail on the second attempt either.
    await append(TENANT_A);
    await runAnchorJob(db, recordingStorage().storage, "2026-09-22");
    await runAnchorJob(db, recordingStorage().storage, "2026-09-22");
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM chain_anchor
      WHERE tenant_id = ${TENANT_A} AND anchor_date = '2026-09-22'::date
    `.execute(db);
    expect(rows.rows[0]?.n).toBe("1");
  });
});
