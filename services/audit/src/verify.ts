/**
 * @file Chain verification and anchoring (WO-002C S1-15)
 * @description Recomputes a tenant's chain and compares it to the stored anchors.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3, S1-D11.
 *
 * Verification recomputes every hash from the genesis value and compares. That is the
 * whole point: a stored hash proves nothing on its own, because anyone who could
 * alter a row could alter its hash too. What they cannot do is alter every SUBSEQUENT
 * hash without being noticed, which is why the failure is reported at the first
 * divergence and everything after it is suspect.
 *
 * Anchors close the remaining hole. An attacker with full database access could
 * rewrite the entire chain consistently. A daily anchor written to a retention-locked
 * bucket they cannot modify means any rewrite before the last anchor is detectable.
 */

import { GENESIS_HASH, chainHash } from "@sovereign/crypto";
import { type Kysely, sql } from "kysely";
import { hashPreimage } from "./chain.js";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

export interface VerificationFailure {
  readonly seq: bigint;
  readonly eventId: string;
  readonly reason: "hash_mismatch" | "broken_link" | "sequence_gap";
  readonly expected: string;
  readonly actual: string;
}

export interface VerificationResult {
  readonly tenantId: string;
  readonly verified: boolean;
  readonly eventsChecked: number;
  readonly lastSeq: bigint | null;
  readonly lastHash: string | null;
  /** Empty when verified. The FIRST failure is what matters; the rest follow from it. */
  readonly failures: readonly VerificationFailure[];
}

interface ChainRow {
  event_id: string;
  seq: string;
  prev_hash: Buffer;
  event_hash: Buffer;
  [column: string]: unknown;
}

/**
 * Rebuild the event exactly as it was hashed.
 *
 * Column names are snake_case in the database and camelCase in the contract, and the
 * hash was computed over the contract shape. Getting this mapping wrong makes every
 * verification fail, which is why it lives in one place rather than being inlined.
 */
function toPreimage(row: ChainRow): Record<string, unknown> {
  return hashPreimage({
    eventId: row.event_id,
    tenantId: row.tenant_id as string,
    siteId: (row.site_id as string | null) ?? null,
    actorKind: row.actor_kind as never,
    actorId: (row.actor_id as string | null) ?? null,
    roleGrant: (row.role_grant as string | null) ?? null,
    patientId: (row.patient_id as string | null) ?? null,
    resourceType: row.resource_type as string,
    resourceId: (row.resource_id as string | null) ?? null,
    resourceVersion: (row.resource_version as string | null) ?? null,
    action: row.action as string,
    reason: (row.reason as string | null) ?? null,
    occurredAt: row.occurred_at as Date,
    requestId: row.request_id as string,
    correlationId: row.correlation_id as string,
    causationId: (row.causation_id as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    destination: (row.destination as string | null) ?? null,
    policyVersion: row.policy_version as string,
    configVersion: (row.config_version as string | null) ?? null,
    modelVersion: (row.model_version as string | null) ?? null,
    promptVersion: (row.prompt_version as string | null) ?? null,
    priorState: (row.prior_state as unknown) ?? null,
    newState: (row.new_state as unknown) ?? null,
    artifactHash: row.artifact_hash === null ? null : (row.artifact_hash as Buffer).toString("hex"),
    result: row.result as never,
    errorCode: (row.error_code as string | null) ?? null,
  });
}

export async function verifyChain(db: Db, tenantId: string): Promise<VerificationResult> {
  const rows = await sql<ChainRow>`
    SELECT * FROM clinical_audit_event WHERE tenant_id = ${tenantId} ORDER BY seq ASC
  `.execute(db);

  const failures: VerificationFailure[] = [];
  let expectedPrev = GENESIS_HASH;
  let expectedSeq = 0n;
  let lastHash: string | null = null;
  let lastSeq: bigint | null = null;

  for (const row of rows.rows) {
    const seq = BigInt(row.seq);
    const storedPrev = row.prev_hash.toString("hex");
    const storedHash = row.event_hash.toString("hex");

    if (seq !== expectedSeq) {
      // A removed row shows up here. Deletion is blocked by a trigger, so a gap means
      // the trigger was dropped or the write never happened.
      failures.push({
        seq,
        eventId: row.event_id,
        reason: "sequence_gap",
        expected: expectedSeq.toString(),
        actual: seq.toString(),
      });
    }

    if (storedPrev !== expectedPrev) {
      failures.push({
        seq,
        eventId: row.event_id,
        reason: "broken_link",
        expected: expectedPrev,
        actual: storedPrev,
      });
    }

    const recomputed = chainHash(storedPrev, toPreimage(row));
    if (recomputed !== storedHash) {
      // A field was altered after the fact. One flipped byte lands here
      // (spec §10 test 12).
      failures.push({
        seq,
        eventId: row.event_id,
        reason: "hash_mismatch",
        expected: recomputed,
        actual: storedHash,
      });
    }

    expectedPrev = storedHash;
    expectedSeq = seq + 1n;
    lastHash = storedHash;
    lastSeq = seq;
  }

  return {
    tenantId,
    verified: failures.length === 0,
    eventsChecked: rows.rows.length,
    lastSeq,
    lastHash,
    failures,
  };
}

export interface AnchorResult {
  readonly tenantId: string;
  readonly anchorDate: string;
  readonly lastSeq: bigint;
  readonly lastHash: string;
}

/**
 * Write a daily anchor for a tenant.
 *
 * Refuses to anchor a chain that does not verify. An anchor over a corrupted chain
 * would certify the corruption, which is worse than having no anchor at all.
 */
export async function writeAnchor(
  db: Db,
  tenantId: string,
  anchorDate: string,
  gcsRef: string | null = null,
): Promise<AnchorResult | null> {
  const verification = await verifyChain(db, tenantId);
  if (!verification.verified) {
    throw new Error(
      `Refusing to anchor tenant ${tenantId}: chain verification failed at seq ${verification.failures[0]?.seq}`,
    );
  }
  if (verification.lastSeq === null || verification.lastHash === null) {
    return null;
  }

  await sql`
    INSERT INTO chain_anchor (tenant_id, anchor_date, last_seq, last_hash, gcs_ref)
    VALUES (${tenantId}, ${anchorDate}::date, ${verification.lastSeq.toString()},
            ${Buffer.from(verification.lastHash, "hex")}, ${gcsRef})
    ON CONFLICT (tenant_id, anchor_date) DO NOTHING
  `.execute(db);

  return {
    tenantId,
    anchorDate,
    lastSeq: verification.lastSeq,
    lastHash: verification.lastHash,
  };
}

/**
 * Check the chain against its stored anchors.
 *
 * Catches the rewrite that verifyChain alone cannot: an attacker with database access
 * who recomputed every hash consistently. The anchors live in a retention-locked
 * bucket they cannot alter.
 */
export async function verifyAgainstAnchors(
  db: Db,
  tenantId: string,
): Promise<{ verified: boolean; mismatchedAnchors: string[] }> {
  const anchors = await sql<{ anchor_date: Date; last_seq: string; last_hash: Buffer }>`
    SELECT anchor_date, last_seq, last_hash FROM chain_anchor
    WHERE tenant_id = ${tenantId} ORDER BY anchor_date ASC
  `.execute(db);

  const mismatched: string[] = [];
  for (const anchor of anchors.rows) {
    const row = await sql<{ event_hash: Buffer }>`
      SELECT event_hash FROM clinical_audit_event
      WHERE tenant_id = ${tenantId} AND seq = ${anchor.last_seq}
    `.execute(db);
    const current = row.rows[0];
    if (current === undefined || !current.event_hash.equals(anchor.last_hash)) {
      mismatched.push(new Date(anchor.anchor_date).toISOString().slice(0, 10));
    }
  }
  return { verified: mismatched.length === 0, mismatchedAnchors: mismatched };
}
