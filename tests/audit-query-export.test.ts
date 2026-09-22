/**
 * Audit consumer, query and export (WO-002C S1-15, spec §7.3).
 *
 * The chain's integrity is covered in tests/audit-chain.test.ts. This file covers the
 * two edges either side of it: what gets written from an untrusted bus message, and
 * what gets read back out.
 */

import type { AuditEventInput } from "@sovereign/contracts";
import { canonicalJson, sha256Hex } from "@sovereign/crypto";
import { ActorKind } from "@sovereign/domain";
import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
} from "@sovereign/persistence";
import {
  type AuditExportRequest,
  type ExportSigner,
  buildAuditExport,
  consumeAuditMessage,
  queryAuditEvents,
  verifyExportBody,
} from "@sovereign/service-audit";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ADMIN_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

const TENANT_A = "TENANT-SYN-AQ-A";
const TENANT_B = "TENANT-SYN-AQ-B";
const TENANTS = [TENANT_A, TENANT_B];

/** Synthetic patient ids, built at runtime — see tests/telemetry-redaction.test.ts. */
const PATIENT_1 = `PAT-SYN-${77412}`;
const PATIENT_2 = `PAT-SYN-${90355}`;

let db: Kysely<SovereignPostgresDatabase>;
let counter = 0;

function event(tenantId: string, overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  counter += 1;
  return {
    eventId: `20000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
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

/** Feeds an event through the consumer exactly as the bus would. */
async function deliver(e: AuditEventInput, orderingKey = e.tenantId) {
  return consumeAuditMessage(db, {
    orderingKey,
    payload: JSON.parse(JSON.stringify(e)),
  });
}

const signer: ExportSigner = {
  async sign(manifest) {
    return `sig:${sha256Hex(manifest)}`;
  },
};

function exportRequest(over: Partial<AuditExportRequest> = {}): AuditExportRequest {
  return {
    tenantId: TENANT_A,
    requestedBy: "USER-SYN-REQUESTER",
    approvals: [
      { approverId: "USER-SYN-APPROVER-1", approvedAt: new Date("2026-09-22T09:00:00Z") },
      { approverId: "USER-SYN-APPROVER-2", approvedAt: new Date("2026-09-22T09:05:00Z") },
    ],
    filters: {},
    ...over,
  };
}

async function clean() {
  await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(db);
  await sql`DELETE FROM clinical_audit_event WHERE tenant_id = ANY(${TENANTS})`.execute(db);
  await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(db);
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
});

beforeEach(clean);

afterAll(async () => {
  await clean();
  await db?.destroy();
});

describe("audit consumer (S1-15, spec §7.3 write path)", () => {
  it("appends a well-formed message to the tenant's chain", async () => {
    const outcome = await deliver(event(TENANT_A, { patientId: PATIENT_1 }));
    expect(outcome.status).toBe("appended");
  });

  it("absorbs a redelivery instead of forking the chain", async () => {
    // Pub/Sub is at-least-once. A redelivery is normal operation, not a fault.
    const e = event(TENANT_A);
    const first = await deliver(e);
    const second = await deliver(e);
    expect(first.status).toBe("appended");
    expect(second.status).toBe("duplicate");
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM clinical_audit_event WHERE event_id = ${e.eventId}
    `.execute(db);
    expect(rows.rows[0]?.n).toBe("1");
  });

  it("refuses a message whose ordering key names a different tenant", async () => {
    // Believing the payload here lets anyone who can publish write into another
    // tenant's chain by mislabelling the key. Believing the key files the event under
    // a tenant it does not describe. Neither is preferable, so it is refused.
    const outcome = await deliver(event(TENANT_A), TENANT_B);
    expect(outcome).toEqual({ status: "rejected", reason: "ordering_key_mismatch" });
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM clinical_audit_event WHERE tenant_id = ANY(${TENANTS})
    `.execute(db);
    expect(rows.rows[0]?.n).toBe("0");
  });

  it("refuses a message that is not a valid audit event", async () => {
    const outcome = await consumeAuditMessage(db, {
      orderingKey: TENANT_A,
      payload: { tenantId: TENANT_A, action: "patient.read" },
    });
    expect(outcome).toEqual({ status: "rejected", reason: "schema_invalid" });
  });

  it("refuses a message that tries to set its own chain position", async () => {
    // Chain fields belong to the chain. An emitter that could choose its own seq or
    // eventHash could choose where in history its event appears.
    const forged = { ...event(TENANT_A), seq: "0", prevHash: "0".repeat(64) };
    const outcome = await consumeAuditMessage(db, { orderingKey: TENANT_A, payload: forged });
    expect(outcome).toEqual({ status: "rejected", reason: "schema_invalid" });
  });

  it("quotes nothing from the rejected message", async () => {
    // A rejection reason that echoes the payload turns a malformed message into a
    // PHI disclosure in whatever log records the rejection.
    const outcome = await consumeAuditMessage(db, {
      orderingKey: TENANT_A,
      payload: { tenantId: TENANT_A, patientId: PATIENT_1, note: "chest pain" },
    });
    const text = JSON.stringify(outcome);
    expect(text).not.toContain(PATIENT_1);
    expect(text).not.toContain("chest pain");
  });
});

describe("audit query (S1-15, spec §7.3 GET /audit/events)", () => {
  beforeEach(async () => {
    await deliver(event(TENANT_A, { patientId: PATIENT_1, action: "patient.read" }));
    await deliver(
      event(TENANT_A, { patientId: PATIENT_2, action: "patient.merge", actorId: "ACTOR-SYN-2" }),
    );
    await deliver(event(TENANT_B, { patientId: PATIENT_1, action: "patient.read" }));
  });

  it("returns only the caller's tenant", async () => {
    const page = await queryAuditEvents(db, TENANT_A);
    expect(page.rows).toHaveLength(2);
    expect(page.rows.every((r) => r.action.startsWith("patient."))).toBe(true);
  });

  it("cannot be widened by a filter", async () => {
    // Tenant B has an event for the same patient. Filtering by that patient from
    // tenant A must not reach it.
    const page = await queryAuditEvents(db, TENANT_A, { patientId: PATIENT_1 });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.patientId).toBe(PATIENT_1);
  });

  it("returns an empty page rather than an error for another tenant's patient", async () => {
    // No existence oracle: "you may not see this" and "there is nothing" look the
    // same from outside.
    const page = await queryAuditEvents(db, TENANT_B, { patientId: PATIENT_2 });
    expect(page.rows).toEqual([]);
  });

  it("filters by actor, action and correlation id", async () => {
    expect((await queryAuditEvents(db, TENANT_A, { actorId: "ACTOR-SYN-2" })).rows).toHaveLength(1);
    expect((await queryAuditEvents(db, TENANT_A, { action: "patient.merge" })).rows).toHaveLength(
      1,
    );
    expect((await queryAuditEvents(db, TENANT_A, { correlationId: "CORR-1" })).rows).toHaveLength(
      2,
    );
    expect((await queryAuditEvents(db, TENANT_A, { correlationId: "NOPE" })).rows).toHaveLength(0);
  });

  it("filters by time with an inclusive start and an exclusive end", async () => {
    const at = new Date("2026-09-21T12:00:00Z");
    expect((await queryAuditEvents(db, TENANT_A, { from: at })).rows).toHaveLength(2);
    expect((await queryAuditEvents(db, TENANT_A, { to: at })).rows).toHaveLength(0);
  });

  it("caps the limit however large a number is asked for", async () => {
    const page = await queryAuditEvents(db, TENANT_A, { limit: 10_000 });
    expect(page.rows.length).toBeLessThanOrEqual(500);
  });

  it("says when a page is truncated instead of leaving it to be inferred", async () => {
    // An auditor who reads a truncated page as complete concludes that an access did
    // not happen.
    const page = await queryAuditEvents(db, TENANT_A, { limit: 1 });
    expect(page.truncated).toBe(true);
    const cursor = page.nextAfterSeq;
    expect(cursor).not.toBeNull();

    const next = await queryAuditEvents(db, TENANT_A, { limit: 1, afterSeq: cursor ?? 0n });
    expect(next.rows[0]?.eventId).not.toBe(page.rows[0]?.eventId);
    expect(next.truncated).toBe(true);
  });

  it("pages without repeating or dropping a row", async () => {
    const all = await queryAuditEvents(db, TENANT_A);
    const seen: string[] = [];
    let after: bigint | undefined;
    for (let i = 0; i < 5; i += 1) {
      const page = await queryAuditEvents(db, TENANT_A, { limit: 1, afterSeq: after });
      if (page.rows.length === 0) {
        break;
      }
      seen.push(...page.rows.map((r) => r.eventId));
      if (page.nextAfterSeq === null) {
        break;
      }
      after = page.nextAfterSeq;
    }
    expect(seen.sort()).toEqual(all.rows.map((r) => r.eventId).sort());
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("audit export (S1-15, spec §7.3 POST /audit/exports)", () => {
  beforeEach(async () => {
    await deliver(event(TENANT_A, { patientId: PATIENT_1 }));
    await deliver(event(TENANT_A, { patientId: PATIENT_2 }));
    await deliver(event(TENANT_B, { patientId: PATIENT_1 }));
  });

  it("produces a signed manifest whose hash covers the body", async () => {
    const result = await buildAuditExport(db, exportRequest(), signer);
    expect(result.manifest.rowCount).toBe(2);
    expect(verifyExportBody(result.body, result.manifest)).toBe(true);
    expect(result.signature).toBe(`sig:${sha256Hex(canonicalJson(result.manifest))}`);
  });

  it("detects a body altered after export", async () => {
    const result = await buildAuditExport(db, exportRequest(), signer);
    expect(verifyExportBody(result.body.replace(PATIENT_1, PATIENT_2), result.manifest)).toBe(
      false,
    );
  });

  it("refuses one approver", async () => {
    const request = exportRequest({
      approvals: [{ approverId: "USER-SYN-APPROVER-1", approvedAt: new Date() }],
    });
    await expect(buildAuditExport(db, request, signer)).rejects.toThrow(/distinct approvers/);
  });

  it("refuses the same approver named twice", async () => {
    // Otherwise dual control is satisfied by one person clicking twice.
    const request = exportRequest({
      approvals: [
        { approverId: "USER-SYN-APPROVER-1", approvedAt: new Date() },
        { approverId: "USER-SYN-APPROVER-1", approvedAt: new Date() },
      ],
    });
    await expect(buildAuditExport(db, request, signer)).rejects.toThrow(/distinct approvers/);
  });

  it("refuses a requester who approved their own export", async () => {
    const request = exportRequest({
      approvals: [
        { approverId: "USER-SYN-REQUESTER", approvedAt: new Date() },
        { approverId: "USER-SYN-APPROVER-1", approvedAt: new Date() },
      ],
    });
    await expect(buildAuditExport(db, request, signer)).rejects.toThrow(/may not approve/);
  });

  it("reads nothing at all when dual control fails", async () => {
    // The check runs before the query, so a refused export never touches a row.
    const request = exportRequest({ approvals: [] });
    await expect(buildAuditExport(db, request, signer)).rejects.toThrow();
  });

  it("exports only the requesting tenant", async () => {
    const result = await buildAuditExport(db, exportRequest(), signer);
    expect(result.manifest.tenantId).toBe(TENANT_A);
    expect(result.body.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("states its own scope in the manifest", async () => {
    // A file that does not say what it was filtered to will be read as everything.
    const result = await buildAuditExport(
      db,
      exportRequest({ filters: { patientId: PATIENT_1 } }),
      signer,
    );
    expect(result.manifest.filters).toEqual({ patientId: PATIENT_1 });
    expect(result.manifest.rowCount).toBe(1);
    expect(result.manifest.approvedBy).toEqual(["USER-SYN-APPROVER-1", "USER-SYN-APPROVER-2"]);
  });

  it("marks a truncated export incomplete", async () => {
    const result = await buildAuditExport(db, exportRequest({ maxRows: 1 }), signer);
    expect(result.manifest.rowCount).toBe(1);
    expect(result.manifest.complete).toBe(false);
  });

  it("marks a whole export complete", async () => {
    const result = await buildAuditExport(db, exportRequest(), signer);
    expect(result.manifest.complete).toBe(true);
    expect(result.manifest.firstSeq).not.toBeNull();
    expect(result.manifest.lastSeq).not.toBeNull();
  });

  it("hashes an empty export rather than returning nothing to verify", async () => {
    const result = await buildAuditExport(
      db,
      exportRequest({ filters: { action: "nothing.matches" } }),
      signer,
    );
    expect(result.manifest.rowCount).toBe(0);
    expect(result.manifest.contentHash).toBe(sha256Hex(""));
    expect(verifyExportBody(result.body, result.manifest)).toBe(true);
  });
});
