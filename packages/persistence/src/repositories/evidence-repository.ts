/**
 * @file Clinical Evidence Relational Repository (PostgreSQL)
 * @description Invariant: Tenant-scoped queries; optimistic concurrency; immutable source artifacts.
 */

import {
  ClinicalEvidenceAggregate,
  type EvidenceId,
  type TenantPatientContext,
} from "@sovereign/domain";
import { ConcurrencyConflictError } from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

import { parseJsonField } from "./json-helper.js";

export class PostgresClinicalEvidenceRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async insert(evidence: ClinicalEvidenceAggregate): Promise<void> {
    const p = evidence.props;
    await this.db
      .insertInto("clinical_evidence")
      .values({
        id: p.evidenceId,
        tenant_id: p.context.tenantId,
        patient_id: p.context.patientId,
        aggregate_version: p.aggregateVersion,
        schema_version: p.schemaVersion,
        source_system: p.provenance.sourceSystem,
        source_locator: p.provenance.sourceLocator,
        content_sha256: p.provenance.contentSha256,
        content_mime_type: p.provenance.contentMimeType,
        extraction_lineage: p.provenance.extractionLineage,
        sensitivity_classification: p.classification.sensitivity,
        provenance_origin: p.classification.origin,
        effective_time_json: JSON.stringify(p.temporal.effectiveClinicalTime),
        source_recorded_time_json: JSON.stringify(p.temporal.sourceRecordedTime),
        sovereign_ingestion_time: p.temporal.sovereignIngestionTime,
        assessments_json: JSON.stringify(p.assessments),
      })
      .execute();
  }

  public async updateWithOptimisticLock(
    evidence: ClinicalEvidenceAggregate,
    expectedVersion: number,
  ): Promise<void> {
    const p = evidence.props;
    const result = await this.db
      .updateTable("clinical_evidence")
      .set({
        aggregate_version: p.aggregateVersion,
        assessments_json: JSON.stringify(p.assessments),
        updated_at: new Date(),
      })
      .where("tenant_id", "=", p.context.tenantId)
      .where("id", "=", p.evidenceId)
      .where("aggregate_version", "=", expectedVersion)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) === 0) {
      throw new ConcurrencyConflictError(
        `Optimistic lock failure on Evidence '${p.evidenceId}'. Expected version ${expectedVersion}.`,
      );
    }
  }

  public async findById(
    context: TenantPatientContext,
    evidenceId: EvidenceId,
  ): Promise<ClinicalEvidenceAggregate | null> {
    const row = await this.db
      .selectFrom("clinical_evidence")
      .selectAll()
      .where("tenant_id", "=", context.tenantId)
      .where("patient_id", "=", context.patientId)
      .where("id", "=", evidenceId)
      .executeTakeFirst();

    if (!row) return null;

    const parsedAssessments = parseJsonField<any[]>(row.assessments_json, []);

    return ClinicalEvidenceAggregate.reconstitute({
      evidenceId: row.id as EvidenceId,
      context,
      provenance: {
        sourceSystem: row.source_system,
        sourceLocator: row.source_locator,
        contentSha256: row.content_sha256,
        contentMimeType: row.content_mime_type,
        extractionLineage: row.extraction_lineage as any,
      },
      temporal: {
        effectiveClinicalTime: parseJsonField<any>(row.effective_time_json),
        sourceRecordedTime: parseJsonField<any>(row.source_recorded_time_json),
        sovereignIngestionTime: new Date(row.sovereign_ingestion_time),
      },
      classification: {
        sensitivity: row.sensitivity_classification as any,
        origin: row.provenance_origin as any,
      },
      assessments: parsedAssessments,
      aggregateVersion: row.aggregate_version,
      schemaVersion: row.schema_version,
    });
  }
}
