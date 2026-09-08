/**
 * @file PostgreSQL Authority Grant Repository Implementation
 */

import {
  type ActorId,
  type AuthorityClass,
  type AuthorityGrant,
  type AuthorityGrantId,
  type CapabilityIdentifier,
  type CausationId,
  type CorrelationId,
  type GrantRevocationRecord,
  type OrganizationUnitId,
  type PatientId,
  type TenantId,
  assertValidAuthorityGrant,
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

export class PostgresAuthorityGrantRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async saveGrant(grant: AuthorityGrant): Promise<void> {
    assertValidAuthorityGrant(grant);

    await this.db
      .insertInto("authority_grants")
      .values({
        id: grant.grantId,
        tenant_id: grant.tenantId,
        organization_unit_scope: grant.organizationUnitScope ?? null,
        patient_id_scope: grant.patientIdScope ?? null,
        target_resource_scope_json: grant.targetResourceScope
          ? JSON.stringify(grant.targetResourceScope)
          : null,
        required_authority_class: grant.requiredAuthorityClass,
        issuer_actor_id: grant.issuerActorId,
        grantee_actor_id: grant.granteeActorId,
        permitted_capability: grant.permittedCapability,
        authorization_binding_json: grant.authorizationBinding
          ? JSON.stringify(grant.authorizationBinding)
          : null,
        effective_from: grant.effectiveFrom,
        expires_at: grant.expiresAt,
        parent_grant_id: grant.parentGrantId ?? null,
        source_reference: grant.sourceReference ?? null,
        revocation_json: grant.revocation ? JSON.stringify(grant.revocation) : null,
        correlation_id: grant.correlationId,
        causation_id: grant.causationId,
        audit_lineage_id: grant.auditLineageId,
        schema_version: grant.schemaVersion,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "id"]).doUpdateSet({
          revocation_json: grant.revocation ? JSON.stringify(grant.revocation) : null,
          updated_at: new Date(),
        }),
      )
      .execute();
  }

  public async getGrantById(
    tenantId: TenantId,
    grantId: AuthorityGrantId,
  ): Promise<AuthorityGrant | undefined> {
    const row = await this.db
      .selectFrom("authority_grants")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", grantId)
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      grantId: row.id as AuthorityGrantId,
      tenantId: row.tenant_id as TenantId,
      organizationUnitScope: row.organization_unit_scope
        ? (row.organization_unit_scope as OrganizationUnitId)
        : undefined,
      patientIdScope: row.patient_id_scope ? (row.patient_id_scope as PatientId) : undefined,
      targetResourceScope: parseJsonField(row.target_resource_scope_json, undefined),
      requiredAuthorityClass: row.required_authority_class as AuthorityClass,
      issuerActorId: row.issuer_actor_id as ActorId,
      granteeActorId: row.grantee_actor_id as ActorId,
      permittedCapability: row.permitted_capability as CapabilityIdentifier,
      authorizationBinding: parseJsonField(row.authorization_binding_json, undefined),
      effectiveFrom: row.effective_from,
      expiresAt: row.expires_at,
      parentGrantId: row.parent_grant_id ? (row.parent_grant_id as AuthorityGrantId) : undefined,
      sourceReference: row.source_reference ?? undefined,
      revocation: parseJsonField<GrantRevocationRecord | undefined>(row.revocation_json, undefined),
      correlationId: row.correlation_id as CorrelationId,
      causationId: row.causation_id as CausationId,
      auditLineageId: row.audit_lineage_id,
      schemaVersion: row.schema_version,
    };
  }

  public async revokeGrant(
    tenantId: TenantId,
    grantId: AuthorityGrantId,
    revocation: GrantRevocationRecord,
  ): Promise<void> {
    await this.db
      .updateTable("authority_grants")
      .set({
        revocation_json: JSON.stringify(revocation),
        updated_at: new Date(),
      })
      .where("tenant_id", "=", tenantId)
      .where("id", "=", grantId)
      .execute();
  }
}
