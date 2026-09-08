/**
 * @file PostgreSQL Persistence, Identity, Authority & RLS Integration Tests
 * @description Verifies PostgreSQL persistence roundtrips and ADR-0009 tenant-level Row Level Security (RLS)
 * using the separate runtime application role sovereign_app.
 */

import {
  type ActorId,
  type ActorIdentity,
  ActorKind,
  AuthorityClass,
  type AuthorityGrant,
  type AuthorityGrantId,
  AuthorityGrantStatus,
  type AuthorizationAuditRecord,
  AuthorizationOutcome,
  AuthorizationReasonCode,
  CanonicalCapabilities,
  type CausationId,
  type CorrelationId,
  type DecisionId,
  type OrganizationUnitId,
  type PatientId,
  RelationshipKind,
  type TenantId,
  computeGrantLifecycleStatus,
} from "@sovereign/domain";
import {
  PostgresActorRepository,
  PostgresAuthorityGrantRepository,
  PostgresAuthorizationAuditRepository,
  PostgresIdentityMappingRepository,
  type SovereignPostgresDatabase,
  clearTenantSession,
  createPostgresKysely,
  runMigrationsDown,
  runMigrationsUp,
  setTenantSession,
  withTenantTransaction,
} from "@sovereign/persistence";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_DB_URL =
  process.env.SOVEREIGN_DATABASE_URL ||
  "postgresql://sovereign_dev:sovereign_dev_password@localhost:5432/sovereign_test";

const APP_DB_URL =
  process.env.SOVEREIGN_APP_DATABASE_URL ||
  "postgresql://sovereign_app:sovereign_app_password@localhost:5432/sovereign_test";

describe("Sovereign PostgreSQL Identity, Authority & RLS Integration Suite", () => {
  let adminDb: Kysely<SovereignPostgresDatabase>;
  let appDb: Kysely<SovereignPostgresDatabase>;

  let actorRepo: PostgresActorRepository;
  let grantRepo: PostgresAuthorityGrantRepository;
  let auditRepo: PostgresAuthorizationAuditRepository;
  let mappingRepo: PostgresIdentityMappingRepository;

  const tenantA = "TENANT-SYS-ALPHA" as TenantId;
  const tenantB = "TENANT-SYS-BETA" as TenantId;
  const patientA = "PATIENT-ALPHA-01" as PatientId;
  const patientB = "PATIENT-BETA-01" as PatientId;
  const clinicianActorId = "ACTOR-CLINICIAN-01" as ActorId;

  beforeAll(async () => {
    adminDb = createPostgresKysely(ADMIN_DB_URL);
    await runMigrationsDown(adminDb);
    await runMigrationsUp(adminDb);

    appDb = createPostgresKysely(APP_DB_URL);

    actorRepo = new PostgresActorRepository(adminDb);
    grantRepo = new PostgresAuthorityGrantRepository(adminDb);
    auditRepo = new PostgresAuthorizationAuditRepository(adminDb);
    mappingRepo = new PostgresIdentityMappingRepository(adminDb);
  });

  afterAll(async () => {
    await appDb.destroy();
    await runMigrationsDown(adminDb);
    await adminDb.destroy();
  });

  // =========================================================================
  // Repository Roundtrip Tests
  // =========================================================================

  it("actorRepositorySavesAndLoadsClinicianIdentity", async () => {
    const clinician: ActorIdentity = {
      actorId: clinicianActorId,
      kind: ActorKind.HUMAN_CLINICIAN,
      tenantId: tenantA,
      displayName: "Dr. Gregory House",
      technicalSubjectId: "oidc-sub-ghouse",
      qualifications: [
        {
          credentialId: "CRED-1",
          credentialType: "MD",
          issuer: "State Board",
          jurisdiction: "US-NJ",
          effectiveDate: new Date("2020-01-01T00:00:00Z"),
          expirationDate: new Date("2030-01-01T00:00:00Z"),
          isRevoked: false,
        },
      ],
      relationships: [
        {
          relationshipId: "REL-1",
          sourceActorId: clinicianActorId,
          target: { type: "PATIENT", targetPatientId: patientA },
          kind: RelationshipKind.CARE_COORDINATOR,
          effectiveFrom: new Date("2026-01-01T00:00:00Z"),
          isVerified: true,
        },
      ],
      systemAttribution: "internal-registry",
    };

    await actorRepo.saveActor(clinician);
    const loaded = await actorRepo.getActorById(tenantA, clinicianActorId);

    expect(loaded).toBeDefined();
    expect(loaded?.displayName).toBe("Dr. Gregory House");
    expect(loaded?.kind).toBe(ActorKind.HUMAN_CLINICIAN);
    expect(loaded?.qualifications?.length).toBe(1);
    expect(loaded?.qualifications?.[0].credentialId).toBe("CRED-1");
    expect(loaded?.relationships?.length).toBe(1);

    // Cross-tenant get returns undefined
    const crossTenant = await actorRepo.getActorById(tenantB, clinicianActorId);
    expect(crossTenant).toBeUndefined();
  });

  it("authorityGrantRepositorySavesAndRevokesGrant", async () => {
    const grant: AuthorityGrant = {
      grantId: "GRANT-PERSIST-1" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patientA,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActorId,
      granteeActorId: clinicianActorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      authorizationBinding: {
        bindingType: "INTENT_ORDER",
        resourceIdentifier: "ORDER-RX-400",
      },
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
      expiresAt: new Date("2026-12-31T00:00:00Z"),
      correlationId: "corr-g1" as CorrelationId,
      causationId: "caus-g1" as CausationId,
      auditLineageId: "lin-g1",
      schemaVersion: 1,
    };

    await grantRepo.saveGrant(grant);
    const loaded = await grantRepo.getGrantById(tenantA, grant.grantId);

    expect(loaded).toBeDefined();
    expect(loaded?.permittedCapability).toBe(CanonicalCapabilities.ORDER_SIGN_TRANSACTION);
    expect(loaded?.authorizationBinding?.resourceIdentifier).toBe("ORDER-RX-400");
    expect(loaded?.revocation).toBeUndefined();

    // Revoke the grant
    const revocationRecord = {
      revokedAt: new Date("2026-06-01T12:00:00Z"),
      revokedByActorId: clinicianActorId,
      reasonCode: "DOSAGE_SUPERSEDED",
      correlationId: "corr-rev-1" as CorrelationId,
      causationId: "caus-rev-1" as CausationId,
    };
    await grantRepo.revokeGrant(tenantA, grant.grantId, revocationRecord);

    const revokedLoaded = await grantRepo.getGrantById(tenantA, grant.grantId);
    expect(revokedLoaded?.revocation).toBeDefined();
    expect(revokedLoaded?.revocation?.reasonCode).toBe("DOSAGE_SUPERSEDED");

    // Single source of truth checks survive persistence
    expect(computeGrantLifecycleStatus(revokedLoaded!, new Date("2026-06-15T00:00:00Z"))).toBe(
      AuthorityGrantStatus.REVOKED,
    );
  });

  it("identityMappingRepositoryMapsActorsAndPatients", async () => {
    await mappingRepo.saveActorMapping({
      mappingId: "MAP-ACTOR-1",
      tenantId: tenantA,
      idpIssuer: "https://accounts.google.com",
      idpSubject: "google-sub-998877",
      actorId: clinicianActorId,
      mappedAt: new Date(),
    });

    const actorId = await mappingRepo.getActorByExternalSubject(
      tenantA,
      "https://accounts.google.com",
      "google-sub-998877",
    );
    expect(actorId).toBe(clinicianActorId);

    // Cross-tenant mapping returns undefined (prevents confused deputy)
    const crossTenantActor = await mappingRepo.getActorByExternalSubject(
      tenantB,
      "https://accounts.google.com",
      "google-sub-998877",
    );
    expect(crossTenantActor).toBeUndefined();

    // Patient mapping
    await mappingRepo.savePatientMapping({
      mappingId: "MAP-PATIENT-1",
      tenantId: tenantA,
      externalSystem: "EPIC_EHR_CLINIC_A",
      externalPatientId: "MRN-100200",
      patientId: patientA,
      mappedAt: new Date(),
    });

    const resolvedPatientId = await mappingRepo.getPatientByExternalId(
      tenantA,
      "EPIC_EHR_CLINIC_A",
      "MRN-100200",
    );
    expect(resolvedPatientId).toBe(patientA);
  });

  it("authorizationAuditRepositoryRecordsAppendOnlyDecisions", async () => {
    const auditRecord: AuthorizationAuditRecord = {
      auditId: "AUDIT-REC-001",
      decisionId: "DEC-AUDIT-001" as DecisionId,
      tenantId: tenantA,
      patientId: patientA,
      actorId: clinicianActorId,
      actorKind: ActorKind.HUMAN_CLINICIAN,
      technicalSubjectId: "oidc-sub-ghouse",
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      evaluatedAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      outcome: AuthorizationOutcome.PERMIT,
      reasonCode: AuthorizationReasonCode.AUTH_PERMITTED,
      reasonFacts: {
        code: AuthorizationReasonCode.AUTH_PERMITTED,
        grantId: "GRANT-PERSIST-1" as AuthorityGrantId,
        capability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      },
      grantsConsidered: ["GRANT-PERSIST-1" as AuthorityGrantId],
      evaluatedPolicyVersion: "sovereign-v0.1",
      correlationId: "corr-aud-1" as CorrelationId,
      causationId: "caus-aud-1" as CausationId,
      occurredAt: new Date("2026-06-01T10:00:00Z"),
    };

    await auditRepo.appendDecision(auditRecord);

    const loaded = await auditRepo.getDecisionById(tenantA, auditRecord.decisionId);
    expect(loaded).toBeDefined();
    expect(loaded?.outcome).toBe(AuthorizationOutcome.PERMIT);
    expect(loaded?.reasonCode).toBe(AuthorizationReasonCode.AUTH_PERMITTED);
    expect(loaded?.reasonFacts.code).toBe(AuthorizationReasonCode.AUTH_PERMITTED);
    expect(loaded?.grantsConsidered.length).toBe(1);
  });

  // =========================================================================
  // PostgreSQL Row Level Security (RLS) & DB Role Boundary Tests (ADR-0009)
  // =========================================================================

  it("rlsMissingContextFailsClosedOnReadAndWrite", async () => {
    // Connect using runtime application role sovereign_app
    // Without setting app.current_tenant, read should return 0 rows
    const rows = await appDb.selectFrom("actors").selectAll().execute();
    expect(rows.length).toBe(0);

    // Attempt insert without setting app.current_tenant -> must fail with RLS check violation
    await expect(
      appDb
        .insertInto("actors")
        .values({
          id: "ACTOR-UNAUTH",
          tenant_id: tenantA,
          kind: "HUMAN_STAFF",
          display_name: "Unauthenticated Insert",
          technical_subject_id: "sub-unauth",
          qualifications_json: "[]",
          relationships_json: "[]",
          system_attribution: null,
        })
        .execute(),
    ).rejects.toThrow(/violates row-level security policy/);
  });

  it("rlsSeparatesTenantAAndTenantBRows", async () => {
    // Insert Tenant A and Tenant B actors using adminDb (privileged)
    await adminDb
      .insertInto("actors")
      .values([
        {
          id: "ACTOR-TENANT-A",
          tenant_id: tenantA,
          kind: "HUMAN_STAFF",
          display_name: "Staff in Tenant A",
          technical_subject_id: "sub-a",
          qualifications_json: "[]",
          relationships_json: "[]",
          system_attribution: null,
        },
        {
          id: "ACTOR-TENANT-B",
          tenant_id: tenantB,
          kind: "HUMAN_STAFF",
          display_name: "Staff in Tenant B",
          technical_subject_id: "sub-b",
          qualifications_json: "[]",
          relationships_json: "[]",
          system_attribution: null,
        },
      ])
      .execute();

    // Query as sovereign_app with tenantA context
    const tenantAResults = await withTenantTransaction(appDb, tenantA, async (trx) => {
      return trx.selectFrom("actors").selectAll().execute();
    });

    expect(tenantAResults.some((r) => r.tenant_id === tenantA)).toBe(true);
    expect(tenantAResults.some((r) => r.tenant_id === tenantB)).toBe(false);

    // Query as sovereign_app with tenantB context
    const tenantBResults = await withTenantTransaction(appDb, tenantB, async (trx) => {
      return trx.selectFrom("actors").selectAll().execute();
    });

    expect(tenantBResults.some((r) => r.tenant_id === tenantB)).toBe(true);
    expect(tenantBResults.some((r) => r.tenant_id === tenantA)).toBe(false);
  });

  it("rlsBlocksDeliberatelyForgedTenantInsertion", async () => {
    // Client authenticates as Tenant A, but attempts to insert a record tagged with Tenant B
    await expect(
      withTenantTransaction(appDb, tenantA, async (trx) => {
        return trx
          .insertInto("actors")
          .values({
            id: "ACTOR-FORGED",
            tenant_id: tenantB, // FORGED TENANT!
            kind: "HUMAN_STAFF",
            display_name: "Forged Tenant Actor",
            technical_subject_id: "sub-forged",
            qualifications_json: "[]",
            relationships_json: "[]",
            system_attribution: null,
          })
          .execute();
      }),
    ).rejects.toThrow(/violates row-level security policy/);
  });

  it("rlsConnectionPoolReuseDoesNotLeakPriorTenantContext", async () => {
    // Verify that sequential transactions on the same connection pool do not leak tenant context
    await withTenantTransaction(appDb, tenantA, async (trx) => {
      const rows = await trx.selectFrom("actors").selectAll().execute();
      expect(rows.every((r) => r.tenant_id === tenantA)).toBe(true);
    });

    // After transaction commit, querying without tenant context must return 0 rows
    const unauthenticatedQuery = await appDb.selectFrom("actors").selectAll().execute();
    expect(unauthenticatedQuery.length).toBe(0);

    // Now query for Tenant B
    await withTenantTransaction(appDb, tenantB, async (trx) => {
      const rows = await trx.selectFrom("actors").selectAll().execute();
      expect(rows.every((r) => r.tenant_id === tenantB)).toBe(true);
      expect(rows.some((r) => r.tenant_id === tenantA)).toBe(false);
    });
  });

  it("runtimeRoleCannotMutateOrDeleteAuthorizationAuditHistory", async () => {
    // First, insert an audit record using adminDb
    await adminDb
      .insertInto("authorization_audit_log")
      .values({
        id: "AUDIT-IMMUTABLE-1",
        decision_id: "DEC-IMMUTABLE-1",
        tenant_id: tenantA,
        organization_unit_id: null,
        patient_id: patientA,
        actor_id: clinicianActorId,
        actor_kind: "HUMAN_CLINICIAN",
        technical_subject_id: "sub-1",
        requested_capability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
        evaluated_authority_class: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
        outcome: AuthorizationOutcome.DENY,
        reason_code: AuthorizationReasonCode.ERR_GRANT_REVOKED,
        reason_facts_json: JSON.stringify({ code: AuthorizationReasonCode.ERR_GRANT_REVOKED }),
        grants_considered_json: "[]",
        evaluated_policy_version: "v0.1",
        correlation_id: "corr-1",
        causation_id: "caus-1",
        occurred_at: new Date(),
      })
      .execute();

    // sovereign_app attempting to UPDATE authorization_audit_log must fail with permission denied!
    await expect(
      withTenantTransaction(appDb, tenantA, async (trx) => {
        return trx
          .updateTable("authorization_audit_log")
          .set({ outcome: "PERMIT" }) // Malicious attempt to change DENY to PERMIT!
          .where("id", "=", "AUDIT-IMMUTABLE-1")
          .execute();
      }),
    ).rejects.toThrow(/permission denied for table authorization_audit_log/);

    // sovereign_app attempting to DELETE from authorization_audit_log must fail with permission denied!
    await expect(
      withTenantTransaction(appDb, tenantA, async (trx) => {
        return trx
          .deleteFrom("authorization_audit_log")
          .where("id", "=", "AUDIT-IMMUTABLE-1")
          .execute();
      }),
    ).rejects.toThrow(/permission denied for table authorization_audit_log/);
  });

  it("runtimeRoleCannotDisableOrBypassRls", async () => {
    // sovereign_app attempting to alter table to disable RLS must fail with permission denied
    await expect(
      sql`ALTER TABLE actors DISABLE ROW LEVEL SECURITY;`.execute(appDb),
    ).rejects.toThrow(/must be owner of table|permission denied/);
  });

  it("domainOutboxEventsTableIsIsolatedByTenantRls", async () => {
    // Clarification 4: Verify that actual table domain_outbox_events is protected by RLS
    await adminDb
      .insertInto("domain_outbox_events")
      .values([
        {
          id: "EVENT-TENANT-A",
          tenant_id: tenantA,
          patient_id: patientA,
          event_name: "CLINICAL_INTENT_DECIDED",
          aggregate_id: "INTENT-1",
          aggregate_version: 1,
          schema_version: 1,
          actor_id: clinicianActorId,
          correlation_id: "corr-1",
          causation_id: "caus-1",
          payload_json: "{}",
          occurred_at: new Date(),
          dispatched_at: null,
        },
        {
          id: "EVENT-TENANT-B",
          tenant_id: tenantB,
          patient_id: patientB,
          event_name: "CLINICAL_INTENT_DECIDED",
          aggregate_id: "INTENT-2",
          aggregate_version: 1,
          schema_version: 1,
          actor_id: clinicianActorId,
          correlation_id: "corr-2",
          causation_id: "caus-2",
          payload_json: "{}",
          occurred_at: new Date(),
          dispatched_at: null,
        },
      ])
      .execute();

    // Query domain_outbox_events as sovereign_app with tenantA context
    const outboxA = await withTenantTransaction(appDb, tenantA, async (trx) => {
      return trx.selectFrom("domain_outbox_events").selectAll().execute();
    });

    expect(outboxA.some((e) => e.tenant_id === tenantA)).toBe(true);
    expect(outboxA.some((e) => e.tenant_id === tenantB)).toBe(false);
  });
});
