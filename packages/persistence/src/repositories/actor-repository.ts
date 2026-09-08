/**
 * @file PostgreSQL Actor Repository Implementation
 */

import {
  type ActorId,
  type ActorIdentity,
  type ActorKind,
  type TenantId,
  assertValidActorIdentity,
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

export class PostgresActorRepository {
  constructor(private readonly db: Kysely<SovereignPostgresDatabase>) {}

  public async saveActor(actor: ActorIdentity): Promise<void> {
    assertValidActorIdentity(actor);

    await this.db
      .insertInto("actors")
      .values({
        id: actor.actorId,
        tenant_id: actor.tenantId,
        kind: actor.kind,
        display_name: actor.displayName,
        technical_subject_id: actor.technicalSubjectId,
        qualifications_json: JSON.stringify(actor.qualifications ?? []),
        relationships_json: JSON.stringify(actor.relationships ?? []),
        system_attribution: actor.systemAttribution ?? null,
      })
      .onConflict((oc) =>
        oc.columns(["tenant_id", "id"]).doUpdateSet({
          display_name: actor.displayName,
          technical_subject_id: actor.technicalSubjectId,
          qualifications_json: JSON.stringify(actor.qualifications ?? []),
          relationships_json: JSON.stringify(actor.relationships ?? []),
          system_attribution: actor.systemAttribution ?? null,
          updated_at: new Date(),
        }),
      )
      .execute();
  }

  public async getActorById(
    tenantId: TenantId,
    actorId: ActorId,
  ): Promise<ActorIdentity | undefined> {
    const row = await this.db
      .selectFrom("actors")
      .selectAll()
      .where("tenant_id", "=", tenantId)
      .where("id", "=", actorId)
      .executeTakeFirst();

    if (!row) return undefined;

    return {
      actorId: row.id as ActorId,
      kind: row.kind as ActorKind,
      tenantId: row.tenant_id as TenantId,
      displayName: row.display_name,
      technicalSubjectId: row.technical_subject_id,
      qualifications: parseJsonField(row.qualifications_json, []),
      relationships: parseJsonField(row.relationships_json, []),
      systemAttribution: row.system_attribution ?? undefined,
    };
  }
}
