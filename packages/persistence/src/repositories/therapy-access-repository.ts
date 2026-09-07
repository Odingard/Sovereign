/**
 * @file Therapy Access Case Relational Repository (PostgreSQL)
 * @description Invariant: Tenant-scoped queries; optimistic concurrency; longitudinal tracking.
 */

import {
  ConcurrencyConflictError,
  type EvidenceId,
  type ExecutionGraphId,
  type GenericTherapyAccessStage,
  type IntentId,
  type ProvenanceTemporalContext,
  type TenantPatientContext,
  type TherapyAccessCaseId,
  TherapyAccessStateAggregate,
} from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

import { parseJsonField } from "./json-helper.js";

export class PostgresTherapyAccessRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async insert(accessCase: TherapyAccessStateAggregate): Promise<void> {
    const p = accessCase.props;
    await this.db
      .insertInto("therapy_access_cases")
      .values({
        id: p.caseId,
        tenant_id: p.context.tenantId,
        patient_id: p.context.patientId,
        aggregate_version: p.aggregateVersion,
        schema_version: p.schemaVersion,
        stage: p.stage,
        associated_intent_ids_json: JSON.stringify(p.associatedIntentIds),
        associated_graph_ids_json: JSON.stringify(p.associatedGraphIds),
        verified_evidence_ids_json: JSON.stringify(p.verifiedMilestoneEvidenceIds),
        closure_reason: p.closureReason || null,
        effective_time_json: JSON.stringify(p.temporal.effectiveClinicalTime),
        source_recorded_time_json: JSON.stringify(p.temporal.sourceRecordedTime),
        sovereign_ingestion_time: p.temporal.sovereignIngestionTime,
      })
      .execute();
  }

  public async updateWithOptimisticLock(
    accessCase: TherapyAccessStateAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const p = accessCase.props;
    const result = await this.db
      .updateTable("therapy_access_cases")
      .set({
        aggregate_version: p.aggregateVersion,
        stage: p.stage,
        associated_graph_ids_json: JSON.stringify(p.associatedGraphIds),
        verified_evidence_ids_json: JSON.stringify(p.verifiedMilestoneEvidenceIds),
        closure_reason: p.closureReason || null,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", p.context.tenantId)
      .where("id", "=", p.caseId)
      .where("aggregate_version", "=", expectedVersion)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConcurrencyConflictError(
        `Optimistic lock failure on Therapy Access Case '${p.caseId}'. Expected version ${expectedVersion}.`,
      );
    }
  }

  public async findById(
    context: TenantPatientContext,
    caseId: TherapyAccessCaseId,
  ): Promise<TherapyAccessStateAggregate | null> {
    const row = await this.db
      .selectFrom("therapy_access_cases")
      .selectAll()
      .where("tenant_id", "=", context.tenantId)
      .where("patient_id", "=", context.patientId)
      .where("id", "=", caseId)
      .executeTakeFirst();

    if (!row) return null;

    const associatedIntentIds = parseJsonField<IntentId[]>(row.associated_intent_ids_json, []);
    const associatedGraphIds = parseJsonField<ExecutionGraphId[]>(
      row.associated_graph_ids_json,
      [],
    );
    const verifiedEvidenceIds = parseJsonField<EvidenceId[]>(row.verified_evidence_ids_json, []);

    const temporal: ProvenanceTemporalContext = {
      effectiveClinicalTime: parseJsonField<any>(row.effective_time_json),
      sourceRecordedTime: parseJsonField<any>(row.source_recorded_time_json),
      sovereignIngestionTime: new Date(row.sovereign_ingestion_time),
    };

    return TherapyAccessStateAggregate.reconstitute({
      caseId: row.id as TherapyAccessCaseId,
      context,
      associatedIntentIds,
      associatedGraphIds,
      stage: row.stage as GenericTherapyAccessStage,
      temporal,
      verifiedMilestoneEvidenceIds: verifiedEvidenceIds,
      closureReason: row.closure_reason || undefined,
      aggregateVersion: row.aggregate_version,
      schemaVersion: row.schema_version,
    });
  }
}
