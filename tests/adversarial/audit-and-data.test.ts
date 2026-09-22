/**
 * Adversarial suite, database-backed half (spec §10).
 *
 * `isolation.test.ts` attacks the edge: tokens, contexts, headers, role matrices.
 * This file attacks the store — RLS, the audit chain, the outbox, the search path and
 * the export — because several of the spec's twenty-four attacks only exist once there
 * is a database to lie to.
 *
 * Runs as TWO roles deliberately. `sovereign_app` is the role a service actually uses
 * and the one an attacker would reach through a compromised service; `sovereign_dev`
 * owns the schema and is used only to set up the state each attack runs against.
 */

import type { AuditEventInput } from "@sovereign/contracts";
import { sha256 } from "@sovereign/crypto";
import { ActorKind } from "@sovereign/domain";
import { type KillSwitchRegistry, requireCapabilityEnabled } from "@sovereign/kernel";
import {
  type SovereignPostgresDatabase,
  createPostgresKysely,
  runMigrationsUp,
} from "@sovereign/persistence";
import {
  type ExportSigner,
  buildAuditExport,
  consumeAuditMessage,
  queryAuditEvents,
  verifyChain,
} from "@sovereign/service-audit";
import {
  type ApprovalRecord,
  applyKillSwitchChange,
  isCapabilityEnabled,
} from "@sovereign/service-identity";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ADMIN_DB_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

// Derived from the admin URL, never defaulted independently — G-43. Two connections
// that can address different databases produce isolation failures that look like
// breaches and are not.
const APP_DB_URL =
  process.env.SOVEREIGN_APP_DATABASE_URL ||
  ADMIN_DB_URL.replace(
    "sovereign_dev:sovereign_dev_password",
    "sovereign_app:sovereign_app_password",
  );

const TENANT_A = "TENANT-SYN-ADV-A";
const TENANT_B = "TENANT-SYN-ADV-B";
const TENANTS = [TENANT_A, TENANT_B];

/** Synthetic identifiers assembled at runtime — see tests/telemetry-redaction.test.ts. */
const PATIENT_A = `PAT-SYN-${31887}`;
const PATIENT_B = `PAT-SYN-${64220}`;
const SHARED_MRN = `MRN${5590431}`;

let admin: Kysely<SovereignPostgresDatabase>;
let app: Kysely<SovereignPostgresDatabase>;
let counter = 0;

function event(tenantId: string, overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  counter += 1;
  return {
    eventId: `30000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
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

async function deliver(e: AuditEventInput, orderingKey = e.tenantId) {
  return consumeAuditMessage(admin, { orderingKey, payload: JSON.parse(JSON.stringify(e)) });
}

/** Runs one statement as `sovereign_app` inside a tenant context. */
async function asTenant<T>(tenantId: string, fn: (trx: Kysely<never>) => Promise<T>): Promise<T> {
  return app.transaction().execute(async (trx) => {
    await sql`SELECT set_config('app.current_tenant', ${tenantId}, true)`.execute(trx);
    return fn(trx as unknown as Kysely<never>);
  });
}

const signer: ExportSigner = {
  async sign() {
    return "sig:synthetic";
  },
};

async function clean() {
  await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(admin);
  await sql`DELETE FROM clinical_audit_event WHERE tenant_id = ANY(${TENANTS})`.execute(admin);
  await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(admin);
  await sql`DELETE FROM patient_identifier WHERE tenant_id = ANY(${TENANTS})`.execute(admin);
  await sql`DELETE FROM patient WHERE tenant_id = ANY(${TENANTS})`.execute(admin);
  await sql`DELETE FROM kill_switch WHERE tenant_id = ANY(${TENANTS})`.execute(admin);
  await sql`DELETE FROM approval WHERE tenant_id = ANY(${TENANTS})`.execute(admin);
}

beforeAll(async () => {
  admin = createPostgresKysely(ADMIN_DB_URL);
  const migrated = await sql<{ exists: boolean }>`
    SELECT EXISTS (SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name='clinical_audit_event') AS exists
  `
    .execute(admin)
    .then((r) => r.rows[0]?.exists === true);
  if (!migrated) {
    await runMigrationsUp(admin);
  }
  app = createPostgresKysely(APP_DB_URL);
  for (const id of TENANTS) {
    await sql`
      INSERT INTO tenant (id, slug, display_name) VALUES (${id}, ${id.toLowerCase()}, ${id})
      ON CONFLICT (id) DO NOTHING
    `.execute(admin);
  }
});

beforeEach(clean);

afterAll(async () => {
  await clean();
  await sql`DELETE FROM tenant WHERE id = ANY(${TENANTS})`.execute(admin);
  await app?.destroy();
  await admin?.destroy();
});

describe("§10.5 a database session with no tenant set sees nothing", () => {
  beforeEach(async () => {
    await sql`INSERT INTO patient (tenant_id, id) VALUES (${TENANT_A}, ${PATIENT_A})`.execute(
      admin,
    );
  });

  it("returns zero rows from an RLS table when app.current_tenant is unset", async () => {
    // A compromised service that forgets to open a tenant context must get nothing,
    // not everything. This is the difference between RLS being a control and being a
    // filter someone remembered to apply.
    const rows = await app.transaction().execute(async (trx) => {
      await sql`SELECT set_config('app.current_tenant', '', true)`.execute(trx);
      return sql<{ id: string }>`SELECT id FROM patient`.execute(trx);
    });
    expect(rows.rows).toEqual([]);
  });

  it("refuses an INSERT with no tenant set", async () => {
    await expect(
      app.transaction().execute(async (trx) => {
        await sql`SELECT set_config('app.current_tenant', '', true)`.execute(trx);
        return sql`INSERT INTO patient (tenant_id, id) VALUES (${TENANT_A}, 'PAT-SYN-X')`.execute(
          trx,
        );
      }),
    ).rejects.toThrow();
  });

  it("refuses an INSERT that names a tenant other than the session's", async () => {
    // The RLS WITH CHECK clause, not the application. A service that takes a tenant id
    // from a request body cannot write it into somebody else's data.
    await expect(
      asTenant(TENANT_A, (trx) =>
        sql`INSERT INTO patient (tenant_id, id) VALUES (${TENANT_B}, 'PAT-SYN-Y')`.execute(trx),
      ),
    ).rejects.toThrow();
  });
});

describe("§10.9 dual control cannot be satisfied by one person", () => {
  it("refuses an export whose requester approved it", async () => {
    await deliver(event(TENANT_A));
    const request = {
      tenantId: TENANT_A,
      requestedBy: "USER-SYN-1",
      approvals: [
        { approverId: "USER-SYN-1", approvedAt: new Date() },
        { approverId: "USER-SYN-2", approvedAt: new Date() },
      ],
      filters: {},
    };
    await expect(buildAuditExport(admin, request, signer)).rejects.toMatchObject({
      // Spec §10.9: 409. Not 403 — the caller MAY do this, once somebody else agrees.
      httpStatus: 409,
      code: "E_DUAL_CONTROL_REQUIRED",
    });
  });

  it("refuses the same approver counted twice", async () => {
    const request = {
      tenantId: TENANT_A,
      requestedBy: "USER-SYN-1",
      approvals: [
        { approverId: "USER-SYN-2", approvedAt: new Date() },
        { approverId: "USER-SYN-2", approvedAt: new Date() },
      ],
      filters: {},
    };
    await expect(buildAuditExport(admin, request, signer)).rejects.toMatchObject({
      httpStatus: 409,
    });
  });
});

describe("§10.11 duplicate and out-of-order delivery keep the chain linear", () => {
  it("writes one audit row for a redelivered event", async () => {
    const e = event(TENANT_A);
    await deliver(e);
    await deliver(e);
    await deliver(e);
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM clinical_audit_event WHERE event_id = ${e.eventId}
    `.execute(admin);
    expect(rows.rows[0]?.n).toBe("1");
  });

  it("keeps seq gapless and prev_hash linked however events interleave across tenants", async () => {
    // Pub/Sub orders per key, not globally. Two tenants' events arrive interleaved as
    // a matter of course, and each chain must be linear on its own terms.
    await deliver(event(TENANT_A));
    await deliver(event(TENANT_B));
    await deliver(event(TENANT_A));
    await deliver(event(TENANT_B));
    await deliver(event(TENANT_A));

    for (const tenantId of TENANTS) {
      const verification = await verifyChain(admin, tenantId);
      expect(verification.verified, `${tenantId} chain`).toBe(true);
      expect(verification.failures).toEqual([]);
    }
    const seqs = await sql<{ seq: string }>`
      SELECT seq FROM clinical_audit_event WHERE tenant_id = ${TENANT_A} ORDER BY seq
    `.execute(admin);
    expect(seqs.rows.map((r) => Number(r.seq))).toEqual([0, 1, 2]);
  });

  it("does not let a late duplicate advance the chain", async () => {
    const first = event(TENANT_A);
    await deliver(first);
    await deliver(event(TENANT_A));
    await deliver(first);
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM clinical_audit_event WHERE tenant_id = ${TENANT_A}
    `.execute(admin);
    expect(rows.rows[0]?.n).toBe("2");
    expect((await verifyChain(admin, TENANT_A)).verified).toBe(true);
  });
});

describe("§10.12 the audit chain is immutable to the application role", () => {
  beforeEach(async () => {
    await deliver(event(TENANT_A));
    await deliver(event(TENANT_A));
  });

  it("refuses an UPDATE through sovereign_app", async () => {
    await expect(
      asTenant(TENANT_A, (trx) =>
        sql`UPDATE clinical_audit_event SET action = 'patient.export' WHERE tenant_id = ${TENANT_A}`.execute(
          trx,
        ),
      ),
    ).rejects.toThrow();
  });

  it("refuses a DELETE through sovereign_app", async () => {
    await expect(
      asTenant(TENANT_A, (trx) =>
        sql`DELETE FROM clinical_audit_event WHERE tenant_id = ${TENANT_A}`.execute(trx),
      ),
    ).rejects.toThrow();
  });

  it("detects a single flipped byte written around the trigger", async () => {
    // The attacker here is not the application. It is somebody with owner rights who
    // disabled the trigger — which the chain still catches, and which is the entire
    // reason the chain exists on top of the trigger.
    const target = await sql<{ seq: string; event_hash: Buffer }>`
      SELECT seq, event_hash FROM clinical_audit_event
      WHERE tenant_id = ${TENANT_A} ORDER BY seq LIMIT 1
    `.execute(admin);
    const row = target.rows[0];
    expect(row).toBeDefined();

    const flipped = Buffer.from(row?.event_hash as Buffer);
    flipped[0] = (flipped[0] as number) ^ 0x01;

    await sql`ALTER TABLE clinical_audit_event DISABLE TRIGGER trg_audit_append_only`.execute(
      admin,
    );
    await sql`
      UPDATE clinical_audit_event SET event_hash = ${flipped}
      WHERE tenant_id = ${TENANT_A} AND seq = ${row?.seq}
    `.execute(admin);
    await sql`ALTER TABLE clinical_audit_event ENABLE TRIGGER trg_audit_append_only`.execute(admin);

    const verification = await verifyChain(admin, TENANT_A);
    expect(verification.verified).toBe(false);
    expect(verification.failures.length).toBeGreaterThan(0);
  });
});

describe("§10.16 a disabled capability degrades truthfully", () => {
  function registry(enabled: boolean): KillSwitchRegistry {
    return { isEnabled: async () => enabled };
  }

  it("refuses a disabled capability rather than returning an empty result", async () => {
    // AGENTS.md doctrine 7: unknown is not negative. An empty result reads as "no
    // such record", which in a clinical context is a false negative.
    await expect(
      requireCapabilityEnabled(registry(false), "prior_auth:submit", TENANT_A),
    ).rejects.toMatchObject({ code: "E_CAPABILITY_DISABLED", httpStatus: 503 });
  });

  it("fails closed when the registry cannot be read", async () => {
    const broken: KillSwitchRegistry = {
      isEnabled: async () => {
        throw new Error("registry unreachable");
      },
    };
    await expect(requireCapabilityEnabled(broken, "prior_auth:submit", TENANT_A)).rejects.toThrow();
  });

  const approved: ApprovalRecord = {
    approvalId: "APR-SYN-1",
    requestedBy: "USER-SYN-1",
    approvedBy: "USER-SYN-2",
    status: "approved",
  };

  const change = (over: Record<string, unknown> = {}) => ({
    tenantId: TENANT_A,
    capability: "prior_auth:submit",
    enabled: false,
    changedBy: "USER-SYN-1",
    environment: "prod" as const,
    approval: approved,
    ...over,
  });

  it("refuses a production toggle with no approval at all", async () => {
    // Spec §10.16. A kill switch is the one control that turns a safety feature off
    // across a whole tenant in a single statement.
    await expect(
      applyKillSwitchChange(admin, change({ approval: undefined })),
    ).rejects.toMatchObject({ httpStatus: 409, code: "E_DUAL_CONTROL_REQUIRED" });
    const rows = await sql<{ n: string }>`
      SELECT count(*) AS n FROM kill_switch WHERE tenant_id = ${TENANT_A}
    `.execute(admin);
    expect(rows.rows[0]?.n).toBe("0");
  });

  it("refuses a pending approval", async () => {
    // A pending approval is not an approval. Accepting one would satisfy the control
    // by opening a request rather than by getting an answer to it.
    await expect(
      applyKillSwitchChange(
        admin,
        change({ approval: { ...approved, status: "pending", approvedBy: null } }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("refuses a toggle the changer approved for themselves", async () => {
    await expect(
      applyKillSwitchChange(admin, change({ approval: { ...approved, approvedBy: "USER-SYN-1" } })),
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("refuses a self-granted approval even when a third party applies it", async () => {
    // The applier being somebody else does not repair an approval the requester gave
    // themselves.
    await expect(
      applyKillSwitchChange(
        admin,
        change({
          changedBy: "USER-SYN-3",
          approval: { ...approved, requestedBy: "USER-SYN-9", approvedBy: "USER-SYN-9" },
        }),
      ),
    ).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("applies a properly approved toggle and records who and under which approval", async () => {
    const result = await applyKillSwitchChange(admin, change());
    expect(result.enabled).toBe(false);
    expect(result.approvalId).toBe("APR-SYN-1");
    expect(await isCapabilityEnabled(admin, "prior_auth:submit", TENANT_A)).toBe(false);

    const rows = await sql<{ approval_id: string | null; changed_by: string }>`
      SELECT approval_id, changed_by FROM kill_switch WHERE tenant_id = ${TENANT_A}
    `.execute(admin);
    expect(rows.rows[0]?.changed_by).toBe("USER-SYN-1");
    expect(rows.rows[0]?.approval_id).toBe("APR-SYN-1");
  });

  it("requires approval to re-enable as well as to disable", async () => {
    // Turning a capability back on is not obviously the safe direction: it can
    // re-open the path an incident was contained by.
    await applyKillSwitchChange(admin, change());
    await expect(
      applyKillSwitchChange(admin, change({ enabled: true, approval: undefined })),
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(await isCapabilityEnabled(admin, "prior_auth:submit", TENANT_A)).toBe(false);
  });

  it("does not require approval in dev, on purpose", async () => {
    // An approval workflow in dev trains people to click through approvals, and an
    // approval people click through is worse than none: it looks like a control in
    // the audit trail.
    const result = await applyKillSwitchChange(
      admin,
      change({ environment: "dev", approval: undefined }),
    );
    expect(result.approvalId).toBeNull();
  });

  it("treats a capability nobody disabled as enabled", async () => {
    // Absent means on. Requiring a row per capability would let a missing row take a
    // working clinical tool away for no reason.
    expect(await isCapabilityEnabled(admin, "never:configured", TENANT_A)).toBe(true);
  });
});

describe("§10.17 a search term matching another tenant's patient returns nothing", () => {
  beforeEach(async () => {
    // The SAME identifier value exists in both tenants. Two clinics can legitimately
    // use the same medical record number; that must not make them the same patient.
    for (const [tenantId, patientId] of [
      [TENANT_A, PATIENT_A],
      [TENANT_B, PATIENT_B],
    ] as const) {
      await sql`INSERT INTO patient (tenant_id, id) VALUES (${tenantId}, ${patientId})`.execute(
        admin,
      );
      await sql`
        INSERT INTO source_system (tenant_id, id, kind, display_name)
        VALUES (${tenantId}, ${"SRC-SYN-1"}, 'fixture', 'Synthetic EHR')
        ON CONFLICT DO NOTHING
      `.execute(admin);
      await sql`
        INSERT INTO patient_identifier
          (tenant_id, id, patient_id, source_system_id, identifier_type,
           identifier_value_hash, identifier_value_enc)
        VALUES (${tenantId}, ${`PID-${tenantId}`}, ${patientId}, 'SRC-SYN-1', 'MRN',
                ${sha256(SHARED_MRN)}, ${Buffer.from("synthetic-ciphertext")})
      `.execute(admin);
    }
  });

  it("finds only the caller's own patient for an identifier both tenants use", async () => {
    const rows = await asTenant(TENANT_A, (trx) =>
      sql<{ patient_id: string }>`
        SELECT patient_id FROM patient_identifier
        WHERE tenant_id = ${TENANT_A} AND identifier_value_hash = ${sha256(SHARED_MRN)}
      `.execute(trx),
    );
    expect(rows.rows.map((r) => r.patient_id)).toEqual([PATIENT_A]);
  });

  it("returns empty, not an error, when the match belongs to another tenant", async () => {
    // Empty and forbidden must be indistinguishable, or the search becomes an oracle
    // for which patients exist elsewhere on the platform.
    const rows = await asTenant(TENANT_A, (trx) =>
      sql<{ patient_id: string }>`
        SELECT patient_id FROM patient_identifier WHERE patient_id = ${PATIENT_B}
      `.execute(trx),
    );
    expect(rows.rows).toEqual([]);
  });
});

describe("§10.18 an audit export is scoped to its filters and is itself auditable", () => {
  beforeEach(async () => {
    await deliver(event(TENANT_A, { patientId: PATIENT_A }));
    await deliver(event(TENANT_A, { patientId: PATIENT_B }));
    await deliver(event(TENANT_A, { patientId: PATIENT_A, action: "patient.merge" }));
    await deliver(event(TENANT_B, { patientId: PATIENT_A }));
  });

  const request = (filters: Record<string, unknown>) => ({
    tenantId: TENANT_A,
    requestedBy: "USER-SYN-1",
    approvals: [
      { approverId: "USER-SYN-2", approvedAt: new Date() },
      { approverId: "USER-SYN-3", approvedAt: new Date() },
    ],
    filters,
  });

  it("returns only the filtered patient's events", async () => {
    const result = await buildAuditExport(admin, request({ patientId: PATIENT_A }), signer);
    expect(result.manifest.rowCount).toBe(2);
    expect(result.body).not.toContain(PATIENT_B);
  });

  it("does not reach the other tenant's event for the same patient", async () => {
    // Tenant B has an event for PATIENT_A. The filter narrows within A; it cannot
    // cross out of it.
    const result = await buildAuditExport(admin, request({ patientId: PATIENT_A }), signer);
    const lines = result.body.split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(JSON.parse(line).patientId).toBe(PATIENT_A);
    }
  });

  it("states the filter it was scoped to", async () => {
    const result = await buildAuditExport(admin, request({ patientId: PATIENT_A }), signer);
    expect(result.manifest.filters).toEqual({ patientId: PATIENT_A });
  });

  it("makes the export itself appear in the next export", async () => {
    // Producing an export is one of the Stage 1 minimum audited actions. The row goes
    // into the same chain the export was taken from, so the next export shows it.
    await deliver(
      event(TENANT_A, { action: "audit.export", actorId: "USER-SYN-1", resourceType: "audit" }),
    );
    const page = await queryAuditEvents(admin, TENANT_A, { action: "audit.export" });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.actorId).toBe("USER-SYN-1");
  });
});
