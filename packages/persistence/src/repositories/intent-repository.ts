/**
 * @file Clinical Intent Relational Repository (PostgreSQL)
 * @description Invariant: Tenant-scoped queries; optimistic concurrency; complete 12-state lifecycle.
 */

import {
  type ActorId,
  type AuthorityClass,
  ClinicalIntentAggregate,
  type ClinicalIntentStage,
  ConcurrencyConflictError,
  type ExtensibleActionConcept,
  type IntentId,
  type ProvenanceTemporalContext,
  type TenantPatientContext,
} from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

import { parseJsonField } from "./json-helper.js";

export class PostgresClinicalIntentRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async insert(intent: ClinicalIntentAggregate): Promise<void> {
    const p = intent.props;
    await this.db
      .insertInto("clinical_intents")
      .values({
        id: p.intentId,
        tenant_id: p.context.tenantId,
        patient_id: p.context.patientId,
        aggregate_version: p.aggregateVersion,
        schema_version: p.schemaVersion,
        stage: p.stage,
        action_category: p.actionConcept.category,
        action_verb: p.actionConcept.actionVerb,
        target_concept_code: p.actionConcept.targetConcept.code,
        target_concept_name: p.actionConcept.targetConcept.displayName,
        action_concept_json: JSON.stringify(p.actionConcept),
        authority_class: p.authorityClass,
        authority_reference: p.authorityReference || null,
        clinician_actor_id: p.clinicianActorId,
        supporting_evidence_ids_json: JSON.stringify(p.supportingEvidenceIds),
        superseded_by_intent_id: p.supersededByIntentId || null,
        supersedes_intent_id: p.supersedesIntentId || null,
        effective_time_json: JSON.stringify(p.temporal.effectiveClinicalTime),
        source_recorded_time_json: JSON.stringify(p.temporal.sourceRecordedTime),
        sovereign_ingestion_time: p.temporal.sovereignIngestionTime,
        supersession_time: p.temporal.supersessionTime || null,
        rationale_narrative: p.rationaleNarrative || null,
      })
      .execute();
  }

  public async updateWithOptimisticLock(
    intent: ClinicalIntentAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const p = intent.props;
    const result = await this.db
      .updateTable("clinical_intents")
      .set({
        aggregate_version: p.aggregateVersion,
        stage: p.stage,
        authority_reference: p.authorityReference || null,
        superseded_by_intent_id: p.supersededByIntentId || null,
        supersession_time: p.temporal.supersessionTime || null,
        updated_at: new Date(),
      })
      .where("tenant_id", "=", p.context.tenantId)
      .where("id", "=", p.intentId)
      .where("aggregate_version", "=", expectedVersion)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConcurrencyConflictError(
        `Optimistic lock failure on Clinical Intent '${p.intentId}'. Expected version ${expectedVersion}.`,
      );
    }
  }

  public async findById(
    context: TenantPatientContext,
    intentId: IntentId,
  ): Promise<ClinicalIntentAggregate | null> {
    const row = await this.db
      .selectFrom("clinical_intents")
      .selectAll()
      .where("tenant_id", "=", context.tenantId)
      .where("patient_id", "=", context.patientId)
      .where("id", "=", intentId)
      .executeTakeFirst();

    if (!row) return null;

    const actionConcept = parseJsonField<ExtensibleActionConcept>(row.action_concept_json);
    const supportingEvidenceIds = parseJsonField<any[]>(row.supporting_evidence_ids_json, []);

    const temporal: ProvenanceTemporalContext = {
      effectiveClinicalTime: parseJsonField<any>(row.effective_time_json),
      sourceRecordedTime: parseJsonField<any>(row.source_recorded_time_json),
      sovereignIngestionTime: new Date(row.sovereign_ingestion_time),
      supersessionTime: row.supersession_time ? new Date(row.supersession_time) : undefined,
    };

    return ClinicalIntentAggregate.reconstitute({
      intentId: row.id as IntentId,
      context,
      stage: row.stage as ClinicalIntentStage,
      actionConcept,
      temporal,
      clinicianActorId: row.clinician_actor_id as ActorId,
      authorityClass: row.authority_class as AuthorityClass,
      authorityReference: row.authority_reference || undefined,
      rationaleNarrative: row.rationale_narrative || undefined,
      supportingEvidenceIds,
      supersededByIntentId: row.superseded_by_intent_id
        ? (row.superseded_by_intent_id as IntentId)
        : undefined,
      supersedesIntentId: row.supersedes_intent_id
        ? (row.supersedes_intent_id as IntentId)
        : undefined,
      aggregateVersion: row.aggregate_version,
      schemaVersion: row.schema_version,
    });
  }
}
