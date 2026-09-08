/**
 * @file Append-Only PostgreSQL Authorization Audit Repository Implementation
 * @description Invariant: Authorization decisions are append-only.
 * Repository provides append and read methods only. No UPDATE or DELETE methods exist.
 */

import type {
  ActorId,
  ActorKind,
  AuthorityClass,
  AuthorityGrantId,
  AuthorizationAuditPort,
  AuthorizationAuditRecord,
  AuthorizationOutcome,
  AuthorizationReasonCode,
  CapabilityIdentifier,
  CausationId,
  CorrelationId,
  DecisionId,
  OrganizationUnitId,
  PatientId,
  TenantId,
} from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

function parseJsonField<T>(field: unknown, fallback: T): T {
  if (field === null || field === undefined) return fallback;
  if (typeof field === "object") return field as T;
  if (typeof field === "string") {
    try {
      return JSON.parse(field) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export class PostgresAuthorizationAuditRepository implements AuthorizationAuditPort {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async appendDecision(record: AuthorizationAuditRecord): Promise<void> {
    await this.db
      .insertInto("authorization_audit_log")
      .values({
        id: record.auditId,
        decision_id: record.decisionId,
        tenant_id: record.tenantId,
        organization_unit_id: record.organizationUnitId ?? null,
        patient_id: record.patientId ?? null,
        actor_id: record.actorId,
        actor_kind: record.actorKind,
        technical_subject_id: record.technicalSubjectId,
        requested_capability: record.requestedCapability,
        evaluated_authority_class: record.evaluatedAuthorityClass,
        outcome: record.outcome,
        reason_code: record.reasonCode,
        reason_facts_json: JSON.stringify(record.reasonFacts),
        grants_considered_json: JSON.stringify(record.grantsConsidered),
        evaluated_policy_version: record.evaluatedPolicyVersion,
        correlation_id: record.correlationId,
        causation_id: record.causationId,
        occurred_at: record.occurredAt,
      })
      .execute();
  }

  public async getDecisionById(
    tenantId: TenantId,
    decisionId: DecisionId,
  ): Promise<AuthorizationAuditRecord | undefined> {
    const row = await this.db
      .selectFrom("authorization_audit_log")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("decision_id", "=", decisionId)
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      auditId: row.id,
      decisionId: row.decision_id as DecisionId,
      tenantId: row.tenant_id as TenantId,
      organizationUnitId: row.organization_unit_id
        ? (row.organization_unit_id as OrganizationUnitId)
        : undefined,
      patientId: row.patient_id ? (row.patient_id as PatientId) : undefined,
      actorId: row.actor_id as ActorId,
      actorKind: row.actor_kind as ActorKind,
      technicalSubjectId: row.technical_subject_id,
      requestedCapability: row.requested_capability as CapabilityIdentifier,
      evaluatedAuthorityClass: row.evaluated_authority_class as AuthorityClass,
      outcome: row.outcome as AuthorizationOutcome,
      reasonCode: row.reason_code as AuthorizationReasonCode,
      reasonFacts: parseJsonField<AuthorizationReasonFacts>(row.reason_facts_json, {
        code: row.reason_code as AuthorizationReasonCode.AUTH_PERMITTED,
        capability: row.requested_capability as CapabilityIdentifier,
      }),
      grantsConsidered: parseJsonField<ReadonlyArray<AuthorityGrantId>>(
        row.grants_considered_json,
        [],
      ),
      evaluatedPolicyVersion: row.evaluated_policy_version,
      correlationId: row.correlation_id as CorrelationId,
      causationId: row.causation_id as CausationId,
      occurredAt: row.occurred_at,
    };
  }
}
