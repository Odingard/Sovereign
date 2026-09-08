/**
 * @file PostgreSQL Identity Mapping Repository Implementation
 */

import {
  type ActorId,
  type ActorIdentityMapping,
  type PatientId,
  type PatientIdentityMapping,
  type TenantId,
  assertValidActorIdentityMapping,
  assertValidPatientIdentityMapping,
} from "@sovereign/domain";
import type { Kysely } from "kysely";
import type { SovereignPostgresDatabase } from "../schema.js";

export class PostgresIdentityMappingRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async saveActorMapping(mapping: ActorIdentityMapping): Promise<void> {
    assertValidActorIdentityMapping(mapping);

    await this.db
      .insertInto("actor_identity_mappings")
      .values({
        id: mapping.mappingId,
        tenant_id: mapping.tenantId,
        idp_issuer: mapping.idpIssuer,
        idp_subject: mapping.idpSubject,
        actor_id: mapping.actorId,
        mapped_at: mapping.mappedAt,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "idp_issuer", "idp_subject"]).doUpdateSet({
          actor_id: mapping.actorId,
        }),
      )
      .execute();
  }

  public async getActorByExternalSubject(
    tenantId: TenantId,
    idpIssuer: string,
    idpSubject: string,
  ): Promise<ActorId | undefined> {
    const row = await this.db
      .selectFrom("actor_identity_mappings")
      .select("actor_id")
      .where("tenant_id", "=", tenantId)
      .where("idp_issuer", "=", idpIssuer)
      .where("idp_subject", "=", idpSubject)
      .executeTakeFirst();

    return row ? (row.actor_id as ActorId) : undefined;
  }

  public async savePatientMapping(mapping: PatientIdentityMapping): Promise<void> {
    assertValidPatientIdentityMapping(mapping);

    await this.db
      .insertInto("patient_identity_mappings")
      .values({
        id: mapping.mappingId,
        tenant_id: mapping.tenantId,
        external_system: mapping.externalSystem,
        external_patient_id: mapping.externalPatientId,
        patient_id: mapping.patientId,
        mapped_at: mapping.mappedAt,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "external_system", "external_patient_id"]).doUpdateSet({
          patient_id: mapping.patientId,
        }),
      )
      .execute();
  }

  public async getPatientByExternalId(
    tenantId: TenantId,
    externalSystem: string,
    externalPatientId: string,
  ): Promise<PatientId | undefined> {
    const row = await this.db
      .selectFrom("patient_identity_mappings")
      .select("patient_id")
      .where("tenant_id", "=", tenantId)
      .where("external_system", "=", externalSystem)
      .where("external_patient_id", "=", externalPatientId)
      .executeTakeFirst();

    return row ? (row.patient_id as PatientId) : undefined;
  }
}
