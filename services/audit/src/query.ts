/**
 * @file Audit query (WO-002C S1-15)
 * @description Filtered, tenant-scoped reads of the audit chain.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3 API — `GET /audit/events`, `audit:query`.
 *
 * An audit row names a patient, an actor and an action. Read together they are a record
 * of who looked at whom and when, which is exactly the material an insider wants and
 * exactly what an auditor needs. So this is a privileged read, and every query against
 * it is itself one of the Stage 1 minimum audited actions (§7.3): the caller emits
 * `audit.query` before the results reach anyone.
 *
 * The filters narrow. None of them can widen: `tenantId` is a separate parameter taken
 * from the verified context and is never reachable from the filter object.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

/** No caller gets an unbounded read of an audit chain, whatever it asks for. */
export const AUDIT_QUERY_MAX_LIMIT = 500;
export const AUDIT_QUERY_DEFAULT_LIMIT = 100;

export interface AuditQueryFilters {
  readonly patientId?: string;
  readonly actorId?: string;
  readonly action?: string;
  readonly correlationId?: string;
  /** Inclusive lower bound on `occurred_at`. */
  readonly from?: Date;
  /** Exclusive upper bound on `occurred_at`. */
  readonly to?: Date;
  readonly limit?: number;
  /** Resume after this `seq`. Keyset paging — an offset would skip or repeat rows. */
  readonly afterSeq?: bigint;
}

export interface AuditQueryRow {
  readonly eventId: string;
  readonly seq: bigint;
  readonly occurredAt: Date;
  readonly recordedAt: Date;
  readonly actorKind: string;
  readonly actorId: string | null;
  readonly patientId: string | null;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly action: string;
  readonly result: string;
  readonly errorCode: string | null;
  readonly correlationId: string;
}

export interface AuditQueryPage {
  readonly rows: readonly AuditQueryRow[];
  /** Pass as `afterSeq` to continue. Null when the page is the last one. */
  readonly nextAfterSeq: bigint | null;
  /** True when the limit was reached and more rows may exist. */
  readonly truncated: boolean;
}

interface RawRow {
  event_id: string;
  seq: string;
  occurred_at: Date;
  recorded_at: Date;
  actor_kind: string;
  actor_id: string | null;
  patient_id: string | null;
  resource_type: string;
  resource_id: string | null;
  action: string;
  result: string;
  error_code: string | null;
  correlation_id: string;
}

/**
 * Query one tenant's audit events.
 *
 * `tenantId` comes from the verified request context and appears as an explicit
 * predicate, not only as the RLS session variable — S1-22/G-50, and the same reason
 * the outbox relay carries one: a query whose tenant scoping lives entirely in a
 * setting somewhere else is scoped by convention.
 *
 * Ordered by `seq`, which for a hash chain is also chronological and, unlike
 * `occurred_at`, is unique and gapless. Paging on a timestamp with ties either repeats
 * or drops rows at the boundary, and an audit page that quietly drops a row is worse
 * than no paging.
 */
export async function queryAuditEvents(
  db: Db,
  tenantId: string,
  filters: AuditQueryFilters = {},
): Promise<AuditQueryPage> {
  const limit = Math.min(
    Math.max(1, filters.limit ?? AUDIT_QUERY_DEFAULT_LIMIT),
    AUDIT_QUERY_MAX_LIMIT,
  );

  // The tenant predicate is written literally into the template below, not pushed
  // onto this array. Everything here is an OPTIONAL narrowing; the one condition that
  // must always be present is the one that must not depend on an array being built
  // correctly, and it is also the one a static checker has to be able to see.
  const conditions: ReturnType<typeof sql>[] = [];
  if (filters.patientId !== undefined) {
    conditions.push(sql`patient_id = ${filters.patientId}`);
  }
  if (filters.actorId !== undefined) {
    conditions.push(sql`actor_id = ${filters.actorId}`);
  }
  if (filters.action !== undefined) {
    conditions.push(sql`action = ${filters.action}`);
  }
  if (filters.correlationId !== undefined) {
    conditions.push(sql`correlation_id = ${filters.correlationId}`);
  }
  if (filters.from !== undefined) {
    conditions.push(sql`occurred_at >= ${filters.from}`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`occurred_at < ${filters.to}`);
  }
  if (filters.afterSeq !== undefined) {
    conditions.push(sql`seq > ${filters.afterSeq.toString()}`);
  }

  const narrowing = conditions.length === 0 ? sql`` : sql` AND ${sql.join(conditions, sql` AND `)}`;

  const result = await sql<RawRow>`
    SELECT event_id, seq, occurred_at, recorded_at, actor_kind, actor_id, patient_id,
           resource_type, resource_id, action, result, error_code, correlation_id
    FROM clinical_audit_event
    WHERE tenant_id = ${tenantId}${narrowing}
    ORDER BY seq ASC
    LIMIT ${limit}
  `.execute(db);

  const rows = result.rows.map(
    (r): AuditQueryRow => ({
      eventId: r.event_id,
      seq: BigInt(r.seq),
      occurredAt: r.occurred_at,
      recordedAt: r.recorded_at,
      actorKind: r.actor_kind,
      actorId: r.actor_id,
      patientId: r.patient_id,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      action: r.action,
      result: r.result,
      errorCode: r.error_code,
      correlationId: r.correlation_id,
    }),
  );

  // `truncated` is reported rather than left for the caller to infer from the row
  // count. An auditor who cannot tell a complete answer from a first page will read a
  // truncated one as complete, and conclude that something did not happen.
  const truncated = rows.length === limit;
  const last = rows[rows.length - 1];
  return {
    rows,
    nextAfterSeq: truncated && last !== undefined ? last.seq : null,
    truncated,
  };
}
