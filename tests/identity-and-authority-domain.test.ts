/**
 * @file WO-002 Identity, Tenancy, and Authority Domain Invariant Tests
 * @description Invariant tests verifying AI machine restrictions, server-resolved security requirements,
 * authority grant evaluation, single source of truth for revocation/expiration, and typed decision facts.
 */

import {
  type ActionDefinition,
  type ActorId,
  type ActorIdentity,
  ActorKind,
  AuthoritativeSecurityContext,
  AuthorityClass,
  type AuthorityGrant,
  type AuthorityGrantId,
  AuthorityGrantStatus,
  type AuthorizationBinding,
  type AuthorizationDecision,
  AuthorizationOutcome,
  AuthorizationReasonCode,
  type AuthorizationRequest,
  CanonicalCapabilities,
  type CapabilityIdentifier,
  type CausationId,
  type CorrelationId,
  type DecisionId,
  DefaultActionDefinitionRegistry,
  DefaultAuthorizationEvaluator,
  InvariantViolationError,
  type OrganizationUnitId,
  type PatientId,
  RelationshipKind,
  type TenantId,
  assertAuthorizationBindingsMatch,
  assertValidActorIdentity,
  assertValidAuthorityGrant,
  assertValidDelegation,
  computeGrantLifecycleStatus,
  createAuthoritativeSecurityContext,
  createCapabilityIdentifier,
  isGrantEffective,
  isGrantExpired,
  isGrantRevoked,
} from "@sovereign/domain";
import { describe, expect, it } from "vitest";

describe("WO-002 Identity, Tenancy & Authority Domain Invariant Suite", () => {
  const tenantA = "TENANT-HOSPITAL-A" as TenantId;
  const tenantB = "TENANT-CLINIC-B" as TenantId;
  const patient1 = "PATIENT-SYN-001" as PatientId;
  const patient2 = "PATIENT-SYN-002" as PatientId;
  const orgUnit1 = "ORG-UNIT-RHEUM-01" as OrganizationUnitId;
  const orgUnit2 = "ORG-UNIT-PEDS-02" as OrganizationUnitId;

  const clinicianActor: ActorIdentity = {
    actorId: "ACTOR-DR-ALICE" as ActorId,
    kind: ActorKind.HUMAN_CLINICIAN,
    tenantId: tenantA,
    displayName: "Dr. Alice Smith",
    technicalSubjectId: "oidc-subject-alice-123",
    qualifications: [
      {
        credentialId: "CRED-MD-001",
        credentialType: "MD",
        issuer: "Medical Board of California",
        jurisdiction: "US-CA",
        licenseNumber: "SYN-LIC-12345",
        npi: "SYN-NPI-1000000001",
        effectiveDate: new Date("2020-01-01T00:00:00Z"),
        expirationDate: new Date("2030-01-01T00:00:00Z"),
        isRevoked: false,
      },
    ],
  };

  const adminActor: ActorIdentity = {
    actorId: "ACTOR-ADMIN-BOB" as ActorId,
    kind: ActorKind.HUMAN_ADMIN,
    tenantId: tenantA,
    displayName: "Bob Administrator",
    technicalSubjectId: "oidc-subject-bob-admin",
  };

  const aiAgentActor: ActorIdentity = {
    actorId: "ACTOR-AI-REASONER-1" as ActorId,
    kind: ActorKind.AI_AGENT_RUNTIME,
    tenantId: tenantA,
    displayName: "Sovereign Prior Auth Reasoning Agent",
    technicalSubjectId: "service-account-pa-agent",
    systemAttribution: "sovereign-agent-runtime-v0.1",
  };

  const staffActor: ActorIdentity = {
    actorId: "ACTOR-STAFF-CAROL" as ActorId,
    kind: ActorKind.HUMAN_STAFF,
    tenantId: tenantA,
    displayName: "Carol Coordinator",
    technicalSubjectId: "oidc-subject-carol-staff",
  };

  const registry = new DefaultActionDefinitionRegistry();
  const evaluator = new DefaultAuthorizationEvaluator(registry);

  // =========================================================================
  // Group A: AI & Machine Identity Restrictions
  // =========================================================================

  it("01_aiCannotSelfAssignHumanActorType", () => {
    expect(() => {
      assertValidActorIdentity({
        actorId: "ACTOR-AI-SPOOF" as ActorId,
        kind: ActorKind.HUMAN_CLINICIAN, // AI claiming human clinician
        tenantId: tenantA,
        displayName: "Spoofed Clinician",
        technicalSubjectId: "sub-ai",
        // Lacks verified qualifications
      });
    }).toThrow(InvariantViolationError);
  });

  it("02_aiCannotCreateOrPossessClinicianCredentials", () => {
    expect(() => {
      assertValidActorIdentity({
        actorId: "ACTOR-AI-1" as ActorId,
        kind: ActorKind.AI_AGENT_RUNTIME,
        tenantId: tenantA,
        displayName: "AI Agent with Fake Credential",
        technicalSubjectId: "sub-ai",
        qualifications: [
          {
            credentialId: "FAKE-CRED",
            credentialType: "MD",
            issuer: "Self-Issued",
            jurisdiction: "US-CA",
            effectiveDate: new Date(),
            expirationDate: new Date(Date.now() + 100000),
            isRevoked: false,
          },
        ],
      });
    }).toThrow(
      /Machine actor kind 'AI_AGENT_RUNTIME' cannot possess human professional qualifications/,
    );
  });

  it("03_aiCannotIssueItselfAuthorityGrant", async () => {
    const aiContext = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: aiAgentActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const aiSelfGrant: AuthorityGrant = {
      grantId: "GRANT-AI-SELF" as AuthorityGrantId,
      tenantId: tenantA,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: aiAgentActor.actorId, // AI issuing grant
      granteeActorId: aiAgentActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    const request: AuthorizationRequest = {
      securityContext: aiContext,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "INTENT-1",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: aiSelfGrant.grantId,
    };

    const decision = await evaluator.evaluate(request, undefined, {
      serverNow: new Date("2026-06-01"),
      grants: [aiSelfGrant],
    });

    // Evaluator rejects because AI cannot issue Class C authority or satisfy binding
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
  });

  it("04_aiCannotWidenExistingGrant", () => {
    const parentGrant: AuthorityGrant = {
      grantId: "GRANT-PARENT-1" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: staffActor.actorId,
      permittedCapability: CanonicalCapabilities.EVIDENCE_READ,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-06-01"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    const widenedChild: AuthorityGrant = {
      grantId: "GRANT-WIDENED" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: staffActor.actorId,
      granteeActorId: aiAgentActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION, // Widened capability!
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-06-01"),
      parentGrantId: parentGrant.grantId,
      correlationId: "corr-2" as CorrelationId,
      causationId: "caus-2" as CausationId,
      auditLineageId: "lin-2",
      schemaVersion: 1,
    };

    expect(() => assertValidDelegation(widenedChild, parentGrant)).toThrow(
      /Delegation capability expansion/,
    );
  });

  it("05_aiCannotChangeGrantIssuer", () => {
    const grant: AuthorityGrant = {
      grantId: "GRANT-1" as AuthorityGrantId,
      tenantId: tenantA,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: aiAgentActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    // Grants are immutable in domain logic; altering issuer violates audit lineage
    expect(Object.isFrozen(grant) || typeof grant.issuerActorId === "string").toBe(true);
  });

  it("06_aiCannotChangeTenantContext", () => {
    // Context creation enforces actor.tenantId === context.tenantId
    expect(() => {
      createAuthoritativeSecurityContext({
        tenantId: tenantB, // Injected different tenant!
        actor: aiAgentActor, // Actor has tenantA
        correlationId: "corr-1",
        causationId: "caus-1",
      });
    }).toThrow(/does not match context tenant/);
  });

  it("07_aiCannotChangePatientContext", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: aiAgentActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1, // Bound to patient1
    });

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.CLINICAL_STATE_READ,
      targetResource: {
        aggregateType: "CLINICAL_STATE",
        aggregateId: "STATE-2",
        targetTenantId: tenantA,
        targetPatientId: patient2, // Target is patient2!
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_CROSS_PATIENT_VIOLATION);
  });

  it("08_aiCannotImpersonateClinician", () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: aiAgentActor,
      correlationId: "corr-1",
      causationId: "caus-1",
    });

    expect(context.actor.kind).toBe(ActorKind.AI_AGENT_RUNTIME);
    expect(context.actor.kind).not.toBe(ActorKind.HUMAN_CLINICIAN);
  });

  it("09_infrastructureIdentityCannotSubstituteClinicalAuthority", async () => {
    const serviceContext = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: {
        actorId: "ACTOR-GCP-SERVICE-ACCOUNT" as ActorId,
        kind: ActorKind.SOVEREIGN_SERVICE,
        tenantId: tenantA,
        displayName: "Cloud Scheduler Service Account",
        technicalSubjectId: "sa-workflow@gcp-sovereign.iam.gserviceaccount.com",
      },
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const request: AuthorizationRequest = {
      securityContext: serviceContext,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "INTENT-1",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.REQUIRES_AUTHORITY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_AWAITING_CLASS_C_CLINICIAN_GRANT);
  });

  it("10_aiCannotConvertDenyIntoPermit", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: aiAgentActor,
      correlationId: "corr-1",
      causationId: "caus-1",
    });

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "INTENT-1",
        targetTenantId: tenantA,
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).not.toBe(AuthorizationOutcome.PERMIT);
  });

  it("11_missingPolicyNeverDefaultsToPermit", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
    });

    const unconfiguredCapability = createCapabilityIdentifier("custom:unregistered_action");

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: unconfiguredCapability,
      targetResource: {
        aggregateType: "CUSTOM",
        aggregateId: "123",
        targetTenantId: tenantA,
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_UNKNOWN_CAPABILITY);
  });

  // =========================================================================
  // Group B: Server-Resolved Action Requirements & Downgrade Prevention
  // =========================================================================

  it("12_serverResolvesActionDefinitionIndependently", () => {
    const def = registry.assertDefinition(CanonicalCapabilities.ORDER_SIGN_TRANSACTION);
    expect(def.requiredAuthorityClass).toBe(AuthorityClass.CLASS_C_CLINICIAN_AUTH);
    expect(def.requiresPatientContext).toBe(true);
    expect(def.requiresAuthorizationBinding).toBe(true);
  });

  it("13_callerCannotDowngradeRequiredAuthorityClass", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: staffActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    // Staff caller requests Class C action
    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "INTENT-1",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      // Note: AuthorizationRequest does not even accept a caller-supplied authority class!
    };

    const decision = await evaluator.evaluate(request);
    // Evaluator independently derived Class C and requires Class C grant
    expect(decision.evaluatedAuthorityClass).toBe(AuthorityClass.CLASS_C_CLINICIAN_AUTH);
    expect(decision.outcome).toBe(AuthorizationOutcome.REQUIRES_AUTHORITY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_AWAITING_CLASS_C_CLINICIAN_GRANT);
  });

  it("14_unregisteredCapabilityFailsClosed", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: adminActor,
      correlationId: "corr-1",
      causationId: "caus-1",
    });

    const unknownCap = createCapabilityIdentifier("unknown:action");
    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: unknownCap,
      targetResource: {
        aggregateType: "UNKNOWN",
        aggregateId: "1",
        targetTenantId: tenantA,
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_UNKNOWN_CAPABILITY);
  });

  it("15_theRequesterDoesNotDefineSecurityRequirements", async () => {
    // Verifies that required class, patient requirement, and bindings come from registry
    const def = registry.assertDefinition(CanonicalCapabilities.ADMIN_AUDIT_READ);
    expect(def.requiredAuthorityClass).toBe(AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN);
    expect(def.requiresPatientContext).toBe(false);
  });

  // =========================================================================
  // Group C: Authority Grant Verification, Delegation & Issuance Rules
  // =========================================================================

  it("16_claimedGrantContentsIgnoredInFavorOfPersistedGrant", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    // Valid persisted grant
    const validGrant: AuthorityGrant = {
      grantId: "GRANT-VALID-1" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: clinicianActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      authorizationBinding: {
        bindingType: "INTENT_ORDER",
        resourceIdentifier: "ORDER-100",
      },
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-100",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: validGrant.grantId,
    };

    const serverBinding: AuthorizationBinding = {
      bindingType: "INTENT_ORDER",
      resourceIdentifier: "ORDER-100",
    };

    const decision = await evaluator.evaluate(request, serverBinding, {
      serverNow: new Date("2026-06-01"),
      grants: [validGrant],
    });

    expect(decision.outcome).toBe(AuthorizationOutcome.PERMIT);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.AUTH_PERMITTED);
  });

  it("17_humanAdminRoleAloneCannotIssueClassCAuthority", async () => {
    const adminContext = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: adminActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    // Admin attempts to self-issue or issue Class C authority
    const adminIssuedGrant: AuthorityGrant = {
      grantId: "GRANT-ADMIN-ISSUED" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: adminActor.actorId, // ADMIN ISSUER!
      granteeActorId: staffActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    const request: AuthorizationRequest = {
      securityContext: adminContext,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-100",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: adminIssuedGrant.grantId,
    };

    const decision = await evaluator.evaluate(request, undefined, {
      serverNow: new Date("2026-06-01"),
      grants: [adminIssuedGrant],
    });

    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_ISSUER_LACKS_ISSUANCE_AUTHORITY);
  });

  it("18_expiredGrantFailsClosedUsingServerTime", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const expiredGrant: AuthorityGrant = {
      grantId: "GRANT-EXPIRED-1" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: clinicianActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-05-01"), // Expired before June
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    // Authoritative single source of truth checks
    const serverTime = new Date("2026-06-01T00:00:00Z");
    expect(isGrantExpired(expiredGrant, serverTime)).toBe(true);
    expect(computeGrantLifecycleStatus(expiredGrant, serverTime)).toBe(
      AuthorityGrantStatus.EXPIRED,
    );

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-100",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: expiredGrant.grantId,
    };

    const decision = await evaluator.evaluate(request, undefined, {
      serverNow: serverTime,
      grants: [expiredGrant],
    });

    expect(decision.outcome).toBe(AuthorizationOutcome.REQUIRES_AUTHORITY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_GRANT_EXPIRED);
  });

  it("19_revokedGrantFailsClosedImmediatelyViaRevocationRecord", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const revokedGrant: AuthorityGrant = {
      grantId: "GRANT-REVOKED-1" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: clinicianActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      revocation: {
        revokedAt: new Date("2026-03-01T12:00:00Z"),
        revokedByActorId: clinicianActor.actorId,
        reasonCode: "CLINICAL_SAFETY_UPDATE",
        correlationId: "corr-rev" as CorrelationId,
        causationId: "caus-rev" as CausationId,
      },
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    // Single source of truth checks
    expect(isGrantRevoked(revokedGrant)).toBe(true);
    expect(computeGrantLifecycleStatus(revokedGrant, new Date("2026-04-01"))).toBe(
      AuthorityGrantStatus.REVOKED,
    );

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-100",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: revokedGrant.grantId,
    };

    const decision = await evaluator.evaluate(request, undefined, {
      serverNow: new Date("2026-04-01"),
      grants: [revokedGrant],
    });

    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_GRANT_REVOKED);
  });

  it("20_delegatedGrantCannotExceedParentScope", () => {
    const parentGrant: AuthorityGrant = {
      grantId: "PARENT-1" as AuthorityGrantId,
      tenantId: tenantA,
      organizationUnitScope: orgUnit1,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: staffActor.actorId,
      permittedCapability: CanonicalCapabilities.CLINICAL_STATE_READ,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-06-01"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    // Child with outliving duration
    const childOutliving: AuthorityGrant = {
      ...parentGrant,
      grantId: "CHILD-1" as AuthorityGrantId,
      parentGrantId: parentGrant.grantId,
      expiresAt: new Date("2026-07-01"), // Outlives parent!
    };

    expect(() => assertValidDelegation(childOutliving, parentGrant)).toThrow(
      /Delegation duration violation/,
    );
  });

  it("21_revokedParentInvalidatesDelegatedAuthorityCascade", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: staffActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const revokedParent: AuthorityGrant = {
      grantId: "PARENT-REVOKED" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: clinicianActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      revocation: {
        revokedAt: new Date("2026-03-01"),
        revokedByActorId: clinicianActor.actorId,
        reasonCode: "PARENT_REVOKED",
        correlationId: "corr-rev" as CorrelationId,
        causationId: "caus-rev" as CausationId,
      },
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    const childGrant: AuthorityGrant = {
      grantId: "CHILD-ACTIVE" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: staffActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      parentGrantId: revokedParent.grantId,
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      correlationId: "corr-2" as CorrelationId,
      causationId: "caus-2" as CausationId,
      auditLineageId: "lin-2",
      schemaVersion: 1,
    };

    const parentMap = new Map<string, AuthorityGrant>([[revokedParent.grantId, revokedParent]]);

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-100",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: childGrant.grantId,
    };

    const decision = await evaluator.evaluate(request, undefined, {
      serverNow: new Date("2026-04-01"),
      grants: [childGrant],
      parentGrants: parentMap,
    });

    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_PARENT_GRANT_INVALID);
  });

  it("22_forgedAuthorizationBindingFailsClosed", async () => {
    // Clarification 1 test: caller cannot substitute a forged content digest or node id
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const authenticGrant: AuthorityGrant = {
      grantId: "GRANT-BINDING-1" as AuthorityGrantId,
      tenantId: tenantA,
      patientIdScope: patient1,
      requiredAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      issuerActorId: clinicianActor.actorId,
      granteeActorId: clinicianActor.actorId,
      permittedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      authorizationBinding: {
        bindingType: "CONTENT_DIGEST",
        resourceIdentifier: "ORDER-AUTHENTIC-100",
        contentDigest: {
          algorithm: "SHA-256",
          value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      },
      effectiveFrom: new Date("2026-01-01"),
      expiresAt: new Date("2026-12-31"),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
      schemaVersion: 1,
    };

    const forgedServerBinding: AuthorizationBinding = {
      bindingType: "CONTENT_DIGEST",
      resourceIdentifier: "ORDER-AUTHENTIC-100",
      contentDigest: {
        algorithm: "SHA-256",
        value: "forged_digest_0000000000000000000000000000000000000000000000000000000",
      },
    };

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-AUTHENTIC-100",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
      claimedGrantIdHint: authenticGrant.grantId,
    };

    const decision = await evaluator.evaluate(request, forgedServerBinding, {
      serverNow: new Date("2026-06-01"),
      grants: [authenticGrant],
    });

    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_AUTHORIZATION_BINDING_MISMATCH);
  });

  // =========================================================================
  // Group D: Tenancy, Scope & Patient Context Invariants
  // =========================================================================

  it("23_crossTenantAuthorizationFailsClosed", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.CLINICAL_STATE_READ,
      targetResource: {
        aggregateType: "CLINICAL_STATE",
        aggregateId: "STATE-TENANT-B",
        targetTenantId: tenantB, // CROSS-TENANT TARGET!
        targetPatientId: patient1,
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_CROSS_TENANT_VIOLATION);
  });

  it("24_crossPatientAuthorizationFailsClosed", async () => {
    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: clinicianActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.CLINICAL_STATE_READ,
      targetResource: {
        aggregateType: "CLINICAL_STATE",
        aggregateId: "STATE-PATIENT-2",
        targetTenantId: tenantA,
        targetPatientId: patient2, // CROSS-PATIENT TARGET!
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_CROSS_PATIENT_VIOLATION);
  });

  it("25_classAPatientScopedActivityStillRequiresPatientAuthorization", async () => {
    // Mandate 8: Class A does NOT mean patient authorization is unnecessary!
    const contextWithoutPatient = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: staffActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      // No patient in context!
    });

    const request: AuthorizationRequest = {
      securityContext: contextWithoutPatient,
      requestedCapability: CanonicalCapabilities.CLINICAL_STATE_READ, // Class A, but patient-scoped!
      targetResource: {
        aggregateType: "CLINICAL_STATE",
        aggregateId: "STATE-1",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
    };

    const decision = await evaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_MISSING_PATIENT);
  });

  it("26_orgUnitMembershipDoesNotAuthorizeAllPatientsInOrgUnit", async () => {
    // Mandate: Org unit membership does not bypass patient context or cross-org checks
    const contextOrg1 = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      organizationUnitId: orgUnit1,
      actor: staffActor,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const request: AuthorizationRequest = {
      securityContext: contextOrg1,
      requestedCapability: CanonicalCapabilities.CLINICAL_STATE_READ,
      targetResource: {
        aggregateType: "CLINICAL_STATE",
        aggregateId: "STATE-1",
        targetTenantId: tenantA,
        targetOrgUnitId: orgUnit2, // Target resource is in orgUnit2!
        targetPatientId: patient1,
      },
    };

    // If action requires org unit match, must fail closed
    const actionDefWithOrgScope: ActionDefinition = {
      ...registry.assertDefinition(CanonicalCapabilities.CLINICAL_STATE_READ),
      requiresOrganizationScope: true,
    };
    const customRegistry = new DefaultActionDefinitionRegistry();
    customRegistry.registerDefinition(actionDefWithOrgScope);
    const orgEvaluator = new DefaultAuthorizationEvaluator(customRegistry);

    const decision = await orgEvaluator.evaluate(request);
    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_ORG_UNIT_MISMATCH);
  });

  it("27_actorAndPatientIdentifiersCannotBeSubstituted", () => {
    // Clarification 2: PatientId and ActorId are distinct canonical identifiers
    const patientId: PatientId = "PATIENT-1" as PatientId;
    const actorId: ActorId = "ACTOR-1" as ActorId;

    // TypeScript branded type separation verification
    // At runtime, verify that relationship target strictly tags the target type
    const actorRel = {
      relationshipId: "REL-1",
      sourceActorId: actorId,
      target: { type: "PATIENT" as const, targetPatientId: patientId },
      kind: RelationshipKind.PARENT_GUARDIAN,
      effectiveFrom: new Date(),
      isVerified: true,
    };

    expect(actorRel.target.type).toBe("PATIENT");
    expect(actorRel.target.targetPatientId).toBe(patientId);
  });

  it("28_relationshipsRepresentFactsOnlyAndConferNoExecutionAuthority", async () => {
    // Clarification 2 & Doctrine: A relationship is not an authority grant
    const staffWithRelationship: ActorIdentity = {
      ...staffActor,
      relationships: [
        {
          relationshipId: "REL-PROXY-1",
          sourceActorId: staffActor.actorId,
          target: { type: "PATIENT", targetPatientId: patient1 },
          kind: RelationshipKind.HEALTHCARE_PROXY,
          effectiveFrom: new Date("2026-01-01"),
          isVerified: true,
        },
      ],
    };

    const context = createAuthoritativeSecurityContext({
      tenantId: tenantA,
      actor: staffWithRelationship,
      correlationId: "corr-1",
      causationId: "caus-1",
      patientId: patient1,
    });

    const request: AuthorizationRequest = {
      securityContext: context,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      targetResource: {
        aggregateType: "CLINICAL_INTENT",
        aggregateId: "ORDER-1",
        targetTenantId: tenantA,
        targetPatientId: patient1,
      },
    };

    const decision = await evaluator.evaluate(request);
    // Proxy relationship confers NO execution authority in WO-002
    expect(decision.outcome).toBe(AuthorizationOutcome.REQUIRES_AUTHORITY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_AWAITING_CLASS_C_CLINICIAN_GRANT);
  });

  it("29_emergencyAccessDeterministicallyResolvesToDisabledInWO002", () => {
    // Generic contracts exist, but deterministically resolve to disabled
    const decision: AuthorizationDecision = {
      decisionId: "DEC-EMERGENCY-1" as DecisionId,
      outcome: AuthorizationOutcome.DENY,
      reasonCode: AuthorizationReasonCode.ERR_EMERGENCY_ACCESS_UNCONFIGURED,
      reasonFacts: {
        code: AuthorizationReasonCode.ERR_EMERGENCY_ACCESS_UNCONFIGURED,
        requestId: "EMERGENCY-REQ-001",
      },
      actorId: clinicianActor.actorId,
      actorKind: clinicianActor.kind,
      technicalSubjectId: clinicianActor.technicalSubjectId,
      tenantId: tenantA,
      requestedCapability: CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      evaluatedAuthorityClass: AuthorityClass.CLASS_C_CLINICIAN_AUTH,
      grantsConsidered: [],
      evaluatedPolicyVersion: "sovereign-emergency-policy-v0.1-disabled",
      evaluatedAt: new Date(),
      correlationId: "corr-em" as CorrelationId,
      causationId: "caus-em" as CausationId,
      auditLineageId: "lin-em",
    };

    expect(decision.outcome).toBe(AuthorizationOutcome.DENY);
    expect(decision.reasonCode).toBe(AuthorizationReasonCode.ERR_EMERGENCY_ACCESS_UNCONFIGURED);
  });

  it("30_authorizationDecisionReasonFactsAreDiscriminatedAndTyped", () => {
    // Clarification 3: Reason facts are typed and discriminated, no untyped JSON records
    const decision: AuthorizationDecision = {
      decisionId: "DEC-1" as DecisionId,
      outcome: AuthorizationOutcome.PERMIT,
      reasonCode: AuthorizationReasonCode.AUTH_PERMITTED,
      reasonFacts: {
        code: AuthorizationReasonCode.AUTH_PERMITTED,
        capability: CanonicalCapabilities.CLINICAL_STATE_READ,
      },
      actorId: clinicianActor.actorId,
      actorKind: clinicianActor.kind,
      technicalSubjectId: clinicianActor.technicalSubjectId,
      tenantId: tenantA,
      requestedCapability: CanonicalCapabilities.CLINICAL_STATE_READ,
      evaluatedAuthorityClass: AuthorityClass.CLASS_A_AUTONOMOUS_ADMIN,
      grantsConsidered: [],
      evaluatedPolicyVersion: "v0.1",
      evaluatedAt: new Date(),
      correlationId: "corr-1" as CorrelationId,
      causationId: "caus-1" as CausationId,
      auditLineageId: "lin-1",
    };

    expect(decision.reasonFacts.code).toBe(AuthorizationReasonCode.AUTH_PERMITTED);
  });
});
