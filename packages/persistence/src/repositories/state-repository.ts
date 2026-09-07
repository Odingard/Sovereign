/**
 * @file Clinical State Relational Repository (PostgreSQL)
 * @description Invariant: Tenant-scoped queries; optimistic concurrency; versioned assertions.
 */

import {
  type ClinicalAssertion,
  ClinicalStateAggregate,
  type ClinicalStateId,
  ConcurrencyConflictError,
  type TenantPatientContext,
} from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

import { parseJsonField } from "./json-helper.js";

export class PostgresClinicalStateRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async insert(state: ClinicalStateAggregate): Promise<void> {
    const p = state.props;
    const assertionsObj: Record<string, ClinicalAssertion> = {};
    for (const [id, assertion] of p.assertions) {
      assertionsObj[id] = assertion;
    }

    await this.db
      .insertInto("clinical_states")
      .values({
        id: p.stateId,
        tenant_id: p.context.tenantId,
        patient_id: p.context.patientId,
        aggregate_version: p.aggregateVersion,
        schema_version: p.schemaVersion,
        assertions_json: JSON.stringify(assertionsObj),
        last_evaluated_at: p.lastEvaluatedAt,
      })
      .execute();
  }

  public async updateWithOptimisticLock(
    state: ClinicalStateAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const p = state.props;
    const assertionsObj: Record<string, ClinicalAssertion> = {};
    for (const [id, assertion] of p.assertions) {
      assertionsObj[id] = assertion;
    }

    const result = await this.db
      .updateTable("clinical_states")
      .set({
        aggregate_version: p.aggregateVersion,
        assertions_json: JSON.stringify(assertionsObj),
        last_evaluated_at: p.lastEvaluatedAt,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", p.context.tenantId)
      .where("id", "=", p.stateId)
      .where("aggregate_version", "=", expectedVersion)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConcurrencyConflictError(
        `Optimistic lock failure on Clinical State '${p.stateId}'. Expected version ${expectedVersion}.`,
      );
    }
  }

  public async findById(
    context: TenantPatientContext,
    stateId: ClinicalStateId,
  ): Promise<ClinicalStateAggregate | null> {
    const row = await this.db
      .selectFrom("clinical_states")
      .selectAll()
      .where("tenant_id", "=", context.tenantId)
      .where("patient_id", "=", context.patientId)
      .where("id", "=", stateId)
      .executeTakeFirst();

    if (!row) return null;

    const assertionsRecord = parseJsonField<Record<string, ClinicalAssertion>>(
      row.assertions_json,
      {},
    );
    const assertionsMap = new Map<string, ClinicalAssertion>();
    for (const [id, assertion] of Object.entries(assertionsRecord)) {
      assertionsMap.set(id, assertion);
    }

    return ClinicalStateAggregate.reconstitute({
      stateId: row.id as ClinicalStateId,
      context,
      assertions: assertionsMap,
      lastEvaluatedAt: new Date(row.last_evaluated_at),
      aggregateVersion: row.aggregate_version,
      schemaVersion: row.schema_version,
    });
  }
}
