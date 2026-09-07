/**
 * @file Execution Graph Relational Repository (PostgreSQL)
 * @description Invariant: Tenant-scoped queries; optimistic concurrency; Execution Graph ownership.
 */

import {
  ConcurrencyConflictError,
  ExecutionGraphAggregate,
  type ExecutionGraphId,
  type ExecutionNodeId,
  type ExecutionNodeProps,
  type IntentId,
  type TenantPatientContext,
} from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

import { parseJsonField } from "./json-helper.js";

export class PostgresExecutionGraphRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async insert(graph: ExecutionGraphAggregate): Promise<void> {
    const p = graph.props;
    const nodesObj: Record<string, ExecutionNodeProps> = {};
    for (const [id, node] of p.nodes) {
      nodesObj[id] = node;
    }

    await this.db
      .insertInto("execution_graphs")
      .values({
        id: p.graphId,
        tenant_id: p.context.tenantId,
        patient_id: p.context.patientId,
        aggregate_version: p.aggregateVersion,
        schema_version: p.schemaVersion,
        traceable_intent_ids_json: JSON.stringify(p.traceableIntentIds),
        nodes_json: JSON.stringify(nodesObj),
        is_cancelled: p.isCancelled,
      })
      .execute();
  }

  public async updateWithOptimisticLock(
    graph: ExecutionGraphAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const p = graph.props;
    const nodesObj: Record<string, ExecutionNodeProps> = {};
    for (const [id, node] of p.nodes) {
      nodesObj[id] = node;
    }

    const result = await this.db
      .updateTable("execution_graphs")
      .set({
        aggregate_version: p.aggregateVersion,
        nodes_json: JSON.stringify(nodesObj),
        is_cancelled: p.isCancelled,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", p.context.tenantId)
      .where("id", "=", p.graphId)
      .where("aggregate_version", "=", expectedVersion)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConcurrencyConflictError(
        `Optimistic lock failure on Execution Graph '${p.graphId}'. Expected version ${expectedVersion}.`,
      );
    }
  }

  public async findById(
    context: TenantPatientContext,
    graphId: ExecutionGraphId,
  ): Promise<ExecutionGraphAggregate | null> {
    const row = await this.db
      .selectFrom("execution_graphs")
      .selectAll()
      .where("tenant_id", "=", context.tenantId)
      .where("patient_id", "=", context.patientId)
      .where("id", "=", graphId)
      .executeTakeFirst();

    if (!row) return null;

    const traceableIntentIds = parseJsonField<IntentId[]>(row.traceable_intent_ids_json, []);
    const nodesRecord = parseJsonField<Record<string, ExecutionNodeProps>>(row.nodes_json, {});
    const nodesMap = new Map<ExecutionNodeId, ExecutionNodeProps>();
    for (const [id, node] of Object.entries(nodesRecord)) {
      nodesMap.set(id as ExecutionNodeId, node);
    }

    return ExecutionGraphAggregate.reconstitute({
      graphId: row.id as ExecutionGraphId,
      context,
      traceableIntentIds,
      nodes: nodesMap,
      isCancelled: Boolean(row.is_cancelled),
      aggregateVersion: row.aggregate_version,
      schemaVersion: row.schema_version,
    });
  }
}
