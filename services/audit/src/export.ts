/**
 * @file Audit export (WO-002C S1-15)
 * @description Signed, hashed JSONL export of a filtered slice of one tenant's chain.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3 API — `POST /audit/exports`,
 * `audit:export` (dual control), spec §6.3 dual control, S1-D10.
 *
 * An audit export is the largest single disclosure Sovereign can produce: a file that
 * leaves the platform containing who accessed which patient and when, for a whole date
 * range. That is why it is under dual control, why the file is hashed and signed, and
 * why the act of producing one is itself audited.
 *
 * Three properties, in the order they matter:
 *
 *   1. It cannot be produced by one person acting alone.
 *   2. What was produced can be proven later, by hash, without needing the file.
 *   3. Producing it leaves a row in the same chain it exports from.
 */

import { canonicalJson, sha256Hex } from "@sovereign/crypto";
import { dualControlRequired } from "@sovereign/kernel";
import type { Kysely } from "kysely";
import { AUDIT_QUERY_MAX_LIMIT, type AuditQueryFilters, queryAuditEvents } from "./query.js";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

/** An export names an approver twice at most; both names must be different people. */
export const REQUIRED_APPROVALS = 2;

export interface ExportApproval {
  readonly approverId: string;
  readonly approvedAt: Date;
}

export interface AuditExportRequest {
  readonly tenantId: string;
  readonly requestedBy: string;
  readonly approvals: readonly ExportApproval[];
  readonly filters: AuditQueryFilters;
  /** Upper bound on rows. An export is not a way around the query page limit. */
  readonly maxRows?: number;
}

export interface AuditExportManifest {
  readonly tenantId: string;
  readonly requestedBy: string;
  readonly approvedBy: readonly string[];
  readonly generatedAt: string;
  readonly rowCount: number;
  readonly firstSeq: string | null;
  readonly lastSeq: string | null;
  /** sha256 of the JSONL body, hex. Proves later what this export contained. */
  readonly contentHash: string;
  /** Echoed so the manifest states its own scope rather than implying it. */
  readonly filters: Record<string, string>;
  readonly complete: boolean;
}

export interface AuditExport {
  readonly manifest: AuditExportManifest;
  /** Detached signature over the canonical manifest. */
  readonly signature: string;
  readonly body: string;
}

/** Signs the manifest. Cloud KMS in a deployed environment; injectable for tests. */
export interface ExportSigner {
  sign(canonicalManifest: string): Promise<string>;
}

/**
 * Dual control, checked before a single row is read.
 *
 * Two DISTINCT approvers, neither of whom is the requester. Without the distinctness
 * check "dual control" is satisfied by one person approving twice, and without the
 * self-approval check it is satisfied by the requester approving their own request —
 * both of which are one person acting alone wearing a second name (§6.3).
 */
function assertDualControl(request: AuditExportRequest): readonly string[] {
  const approvers = [...new Set(request.approvals.map((a) => a.approverId))];
  if (approvers.length < REQUIRED_APPROVALS) {
    throw dualControlRequired(
      `Audit export requires ${REQUIRED_APPROVALS} distinct approvers, got ${approvers.length}`,
    );
  }
  if (approvers.includes(request.requestedBy)) {
    throw dualControlRequired("The requester of an audit export may not approve it");
  }
  return approvers.sort();
}

function describeFilters(filters: AuditQueryFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.patientId !== undefined) {
    out.patientId = filters.patientId;
  }
  if (filters.actorId !== undefined) {
    out.actorId = filters.actorId;
  }
  if (filters.action !== undefined) {
    out.action = filters.action;
  }
  if (filters.correlationId !== undefined) {
    out.correlationId = filters.correlationId;
  }
  if (filters.from !== undefined) {
    out.from = filters.from.toISOString();
  }
  if (filters.to !== undefined) {
    out.to = filters.to.toISOString();
  }
  return out;
}

/**
 * Build an export.
 *
 * Pages through the chain with the same tenant-scoped query the API uses rather than
 * issuing its own SQL. An export path with a second, looser query is how a filter that
 * holds at `/audit/events` stops holding at `/audit/exports`.
 *
 * The caller emits `audit.export` afterwards. That row lands in the chain this export
 * was taken from, so the next export shows the previous one — which is the point.
 */
export async function buildAuditExport(
  db: Db,
  request: AuditExportRequest,
  signer: ExportSigner,
  now: () => Date = () => new Date(),
): Promise<AuditExport> {
  const approvedBy = assertDualControl(request);
  const maxRows = Math.max(1, request.maxRows ?? 10_000);

  const lines: string[] = [];
  let afterSeq = request.filters.afterSeq;
  let firstSeq: bigint | null = null;
  let lastSeq: bigint | null = null;
  let complete = true;

  while (lines.length < maxRows) {
    const page = await queryAuditEvents(db, request.tenantId, {
      ...request.filters,
      afterSeq,
      limit: Math.min(AUDIT_QUERY_MAX_LIMIT, maxRows - lines.length),
    });
    for (const row of page.rows) {
      firstSeq ??= row.seq;
      lastSeq = row.seq;
      lines.push(canonicalJson({ ...row, seq: row.seq.toString() }));
    }
    if (page.nextAfterSeq === null) {
      break;
    }
    afterSeq = page.nextAfterSeq;
    if (lines.length >= maxRows) {
      // Say so in the manifest. An export truncated silently reads as a complete
      // record of the period, and someone will later conclude from it that an access
      // never happened.
      complete = false;
    }
  }

  const body = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  const manifest: AuditExportManifest = {
    tenantId: request.tenantId,
    requestedBy: request.requestedBy,
    approvedBy,
    generatedAt: now().toISOString(),
    rowCount: lines.length,
    firstSeq: firstSeq === null ? null : firstSeq.toString(),
    lastSeq: lastSeq === null ? null : lastSeq.toString(),
    contentHash: sha256Hex(body),
    filters: describeFilters(request.filters),
    complete,
  };

  // The signature covers the manifest, and the manifest covers the body by hash. A
  // signature over the body alone would leave the scope — whose data, which filters,
  // who approved — unsigned and editable.
  const signature = await signer.sign(canonicalJson(manifest));
  return { manifest, signature, body };
}

/**
 * Re-check an export against its manifest.
 *
 * Deliberately does NOT verify the signature: that needs the key, and this is the check
 * a recipient can run with the file alone. Signature verification belongs with whoever
 * holds the verification key.
 */
export function verifyExportBody(body: string, manifest: AuditExportManifest): boolean {
  return sha256Hex(body) === manifest.contentHash;
}
