# Sovereign — Stage 1 Foundation Build Specification (v1.2, repository-reconciled)

> Reconciled to accepted ADRs per ADR-0011: Fastify (not NestJS), Kysely (not Drizzle), Node 20 LTS, the domain `AuthorizationEvaluator` for application authorization (OPA/Conftest only for infrastructure policy-as-code), Temporal behind the `WorkflowRuntime` port. Package tiers follow ADR-0006; the IdP is an adapter selected via the Service Eligibility Matrix. Executed through WO-002A, WO-002B, WO-002C; WO acceptance criteria are authoritative where this document and a WO differ.

> **Repository mapping.** Where this specification names a component, use the existing repository location: `identity-policy` → `services/identity` + `adapters/identity-oidc` + `adapters/identity-scim`; `patient-context` → `services/patient-context`; `audit-evidence` → `services/audit` + `packages/audit`; `apps/web` → `apps/admin` (Stage 1), `apps/clinician`, `apps/operations`; `apps/gateway` (new); `packages/db` → `packages/persistence` (existing); `packages/kernel`, `packages/crypto`, `packages/telemetry` (new tier packages, depend only on `contracts`/`domain`); `config/policy` → `infra/policy` (Conftest); `config/roles` → `packages/domain/src/authority` capability registry + `config/roles/matrix.yaml`; `jobs/*` → `jobs/*` (new). The `services/*` directories are README-only today; this stage creates their first code.

**Product:** Sovereign (Sovereign Health AI LLC)
**Scope:** Master plan Phase 1 (+ Phase 2 design, + Phase 5 pipeline) — Tenant/IAM, patient context, provenance, audit
**Exit gate:** Repo G1 + WO-002A/B/C gate records (plan Gate 1)
**Traceability:** PRD FR-001 … FR-008, FR-038, FR-040, FR-043, FR-044, FR-045, FR-047; NFR-004, -005, -006, -009, -010, -011, -013, -014, -017, -018
**Audience:** implementing developer. Every item here is a build instruction, not a discussion.

---

## 0. What Stage 1 is and is not

Stage 1 builds the platform kernel that every later stage depends on. Nothing clinical ships in this stage. There is no EHR adapter, no AI generation, no external side effect, no patient-facing surface.

**In scope**
1. Monorepo, toolchain, and shared service kernel.
2. Infrastructure as code for three isolated environments.
3. CI/CD with the full security gate set.
4. Identity: OIDC/SAML federation, MFA for privileged roles, session/revocation, SCIM.
5. Tenancy: tenant derived from identity only; Postgres RLS on every tenant table (existing, ADR-0009); per-tenant encryption keys.
6. Authorization: domain `AuthorizationEvaluator` (existing, ADR-0010), deny-by-default, dual control, break-glass.
7. Patient context: patient entity, source registry, source artifacts, deterministic matching, reconciliation queue.
8. Provenance: source-artifact integrity hashes and fact/artifact lineage model.
9. Audit: append-only, hash-chained audit events with anchoring, verification, authorized query and export.
10. Observability with PHI redaction; integration-health endpoint; kill-switch registry.
11. Adversarial tenant-isolation test suite.

**Out of scope (later work orders)** — EHR/FHIR adapters, ambient capture, note drafting, care plans, workflow activities, medication access, messaging, analytics dashboards, patient portal, any model call, any PHI.

Architecture diagram: `docs/figures/stage1-foundation-architecture.svg`

---

## 1. Decisions (locked for Stage 1)

| ID | Decision | Rationale |
|---|---|---|
| S1-D01 | Cloud: **Google Cloud**, one GCP project per environment (`sovereign-dev`, `sovereign-staging`, `sovereign-prod`), all under one folder with org policies. | HIPAA BAA available; CMEK, VPC-SC, Workload Identity Federation. Every GCP service remains `RESEARCH / NOT APPROVED FOR PHI` until promoted in the eligibility matrix. |
| S1-D02 | Compute: **Cloud Run** (services, gateway, web) + **Cloud Run Jobs** (outbox relay, migrations, anchors). | No cluster to operate. Move to GKE only if an adapter needs long-lived connections. |
| S1-D03 | Language: **TypeScript** end to end. Node 20 LTS (`.nvmrc`). Services on **Fastify** (ADR-0006). Web on **Next.js (App Router)**. | One toolchain, one contracts package, shared kernel. |
| S1-D04 | Monorepo: **pnpm workspaces** (Biome + tsc per ADR-0006). | Per-package ownership; existing tooling. |
| S1-D05 | Database: **Cloud SQL for PostgreSQL 16**, one instance per environment, one **schema per service**, private IP only, CMEK. | Service boundaries enforced at schema level without operating multiple instances. |
| S1-D06 | Migrations: **Kysely** typed queries and explicit reversible migrations (ADR-0006), committed, run by a Cloud Run Job as `sovereign_admin` before deploy. Raw SQL for RLS/policies. | Existing pattern; reviewable SQL. |
| S1-D07 | Identity provider: adapter behind ADR-0010 ports. **Auth0 (Organizations)** is the leading candidate under a signed BAA; Keycloak on Cloud Run is the fallback. Selection recorded in the eligibility matrix before WO-002B starts. | SSO + MFA + org isolation without owning an IdP; identity stays separate from authority. |
| S1-D08 | Authorization: the domain **`AuthorizationEvaluator`** (ADR-0010) with server-resolved `ActionDefinition`s is the sole application/clinical policy engine. **OPA/Conftest** is used only as policy-as-code over Terraform plans and CI. | Identity is not authority; one evaluator; no second policy language for clinical decisions. |
| S1-D09 | Event bus: **Pub/Sub**, fed only by the existing transactional outbox (`domain_outbox_events`). Services never publish directly. | PRD §8.10; AGENTS.md replay-safe consumers. |
| S1-D10 | Encryption: TLS 1.3 preferred / 1.2 minimum; Cloud SQL/GCS CMEK; **per-tenant DEK** (AES-256-GCM) wrapped by a Cloud KMS KEK, for designated PHI columns and all GCS objects. | ADR-0007; tenant-level crypto-shred. |
| S1-D11 | Audit store: Postgres `audit` schema, append-only (`sovereign_app` INSERT/SELECT only), SHA-256 hash chain per tenant, daily anchor hash written to GCS with object retention lock. | NFR-006, FR-040; WO-015 dictionary. |
| S1-D12 | Observability: **OpenTelemetry** → Cloud Logging / Monitoring / Trace. Structured JSON logs with allowlisted fields only. **No third-party error tracker** in PHI-capable apps without a BAA (Sentry `PROHIBITED` for PHI apps). | FR-047, NFR-010, ADR-0007 §5. |
| S1-D13 | CI/CD: **GitHub Actions**, deploys via **Workload Identity Federation** (no service-account keys). | NFR-018. |
| S1-D14 | Secrets: **Secret Manager** only. `.env` files forbidden outside local dev and gitignored. | ADR-0007 §3. |
| S1-D15 | Region: `us-central1` for all environments. | PRD O-006; US-only at launch. |
| S1-D16 | Provisioning: **SCIM 2.0** endpoint (`/scim/v2`) in `adapters/identity-scim`; the IdP acts as SCIM client for enterprise connections; deprovision = immediate grant revocation + session revocation. | Master plan Phase 1.1. |
| S1-D17 | Service-to-service auth: Google-signed **ID tokens** (audience = target service) from Cloud Run service identities **plus** mTLS internal ingress; the signed context header carries user context only and is never sufficient alone. | Master plan Phase 1.1. |
| S1-D18 | Rollout rings: **Internal canary → Ring 0 (1%) → Ring 1 (10%) → Ring 2 (50%) → 100%**, each held ≥15 min against SLO burn and P99; automatic rollback. Proven on dev before prod exists. | Master plan Phase 7.1. |
| S1-D19 | **BYOK**: enterprise tenants may supply their own KEK (customer project Cloud KMS or Cloud EKM); `tenant_key.kek_resource` points at the KEK, so BYOK is configuration, not a code path. | Master plan Phase 2.1. |
| S1-D20 | Retention/erasure: every table carries `retention_class`; erasure = crypto-shred (destroy tenant DEK version) + tombstone + legal-hold check; record-level erasure = tombstone + key-per-record envelope where required. | Master plan Phase 2.1; `DATA_CLASSIFICATION_SCHEDULE.md`. |
| S1-D21 | **SIEM export**: `audit-events` topic fans out to a `siem-export` subscription; HEC/Sentinel/Chronicle-compatible ECS JSON; HMAC-signed push per tenant. | Master plan Phase 4.2. |
| S1-D22 | **DAST** (OWASP ZAP baseline + authenticated) runs on PR preview and nightly on staging; high findings block promotion. | Master plan Phase 5.1. |
| S1-D23 | External **penetration test** engaged before repo G6; remediation tracked as blocking; annual thereafter. | Master plan Phase 5.2. |
| S1-D24 | **Chaos/DR**: quarterly drills — Cloud SQL failover, zone loss, Pub/Sub backlog, KMS unavailability, IdP outage; DR restore drill with measured RTO/RPO vs NFR-002. First drill before Gate 1 sign-off. | Master plan Phase 6.1. |
| S1-D25 | **Status page** (private in Stage 1, public at GA), on-call tiers (T1 founder/on-call, T2 developer, T3 vendor), PIR template in `docs/runbooks/pir-template.md`; every Sev1/Sev2 gets a PIR within 5 business days. | Master plan Phase 7.2. |

---

## 2. Repository layout (target state after WO-002A–C)

```
Sovereign/
├── apps/
│   ├── admin/                    # Next.js — admin + auditor UI (Stage 1 slice)
│   ├── clinician/  operations/   # later work orders
│   ├── marketing-site/           # public site (no PHI; Sentry permitted here only)
│   └── gateway/                  # Fastify BFF — auth, tenant resolution, routing, validation
├── services/
│   ├── identity/                 # users, orgs, sites, grants, approvals, revocations, kill switches
│   ├── patient-context/          # patients, source registry, source artifacts, reconciliation
│   └── audit/                    # audit chain ingest, verification, query, export
├── adapters/
│   ├── identity-oidc/            # IdP federation (OIDC/SAML) behind IdentityProviderPort
│   ├── identity-scim/            # SCIM 2.0 server behind ProvisioningPort
│   └── siem-export/              # HEC / Sentinel / Chronicle / webhook sinks
├── jobs/
│   ├── outbox-relay/             # polls domain_outbox_events → Pub/Sub
│   ├── migrate/                  # runs Kysely migrations (sovereign_admin)
│   └── audit-anchor/             # daily chain anchor → GCS locked bucket
├── packages/
│   ├── domain/ contracts/ application/ persistence/ workflow-runtime/ audit/   # existing (ADR-0006)
│   ├── kernel/                   # request context, tenant guard, capability guard, audit emitter, idempotency, outbox helper
│   ├── crypto/                   # envelope encryption, DEK cache, hashing, KeyManagementPort
│   ├── telemetry/                # OTel setup, PHI-redacting logger, metrics
│   └── ui/                       # design tokens + shared components
├── config/roles/matrix.yaml      # role → capability matrix (compiled into the capability registry)
├── infra/
│   ├── modules/                  # terraform modules: project, network, kms, cloudsql, gcs, pubsub, iam, cloudrun-service, monitoring, secrets
│   ├── envs/{dev,staging,prod}/  # one root per environment
│   └── policy/                   # Conftest policies over Terraform plans
├── tests/
│   ├── adversarial/              # tenant isolation + authorization attack suite (runs against a deployed env)
│   └── contract/                 # consumer/provider contract tests
├── docs/  work-orders/  evals/  specs/  test-data/synthetic-only/   # existing governance
└── .github/workflows/            # ci.yml, security-supply-chain.yml, deploy-*.yml
```

**Rules**
- A service may import from `packages/*` only. Services never import each other. Cross-service calls go through the gateway-published HTTP contract or events.
- A service owns exactly one Postgres schema and is the only writer to it.
- Every mutating endpoint requires an `Idempotency-Key` header (see §6.4).
- ADR-0006 dependency direction is enforced by `scripts/verify-architecture.ts`; new packages are added to that check.

---

## 3. Environments and infrastructure

### 3.1 Environment matrix

| | dev | staging | prod |
|---|---|---|---|
| GCP project | `sovereign-dev` | `sovereign-staging` | `sovereign-prod` |
| Data | synthetic only | synthetic only | synthetic until G0-B GO; PHI only after G6 |
| Deploy trigger | merge to `main` | merge to `main` after dev rings + adversarial suite | manual approval + 2 reviewers (one security CODEOWNER) |
| Cloud SQL | `db-custom-2-8192`, no HA | prod shape, HA | HA, PITR 7d, backups 35d |
| IdP tenant | `sovereign-dev` | `sovereign-staging` | `sovereign-prod` |
| KMS keyring | `sovereign-dev-kr` | `sovereign-staging-kr` | `sovereign-prod-kr` (HSM protection level) |
| Prod access | n/a | n/a | JIT via PAM, ticket ID required, 4 h max, all sessions logged |

### 3.2 Terraform modules (build in this order)

1. `project` — project, APIs, org policies: `constraints/compute.vmExternalIpAccess` (deny), `constraints/iam.disableServiceAccountKeyCreation`, `constraints/gcp.resourceLocations = us-central1`, `constraints/storage.uniformBucketLevelAccess`, `constraints/sql.restrictPublicIp`.
2. `network` — VPC, private subnet, Private Service Connect for Cloud SQL, Serverless VPC connector, Cloud NAT with **deny-all egress** except allowlisted destinations (IdP tenant domain, googleapis). Egress allowlist is data in the module; adding an entry requires security review.
3. `kms` — keyring; KEKs: `db-kek`, `gcs-kek`, `tenant-kek` (wraps per-tenant DEKs). Rotation 90 days. Services get `cloudkms.cryptoKeyEncrypterDecrypter` on `tenant-kek` only.
4. `cloudsql` — Postgres 16, CMEK, private IP, `cloudsql.iam_authentication=on`, flags: `log_connections=on`, `log_disconnections=on`, `log_min_duration_statement=1000`, `pgaudit.log='ddl,role'`. One database `sovereign`; schemas created by migrations. Roles `sovereign_admin` (DDL, BYPASSRLS, migrations only) and `sovereign_app` (runtime, NOBYPASSRLS) per ADR-0009.
5. `gcs` — buckets: `artifacts-{env}` (CMEK, per-tenant prefix, versioning), `audit-anchors-{env}` (retention policy locked 7 y, no delete), `exports-{env}` (7-day lifecycle), `tfstate-{env}` (versioned). All uniform access, no public.
6. `pubsub` — topics `domain-events`, `audit-events`, `metering-events`; dead-letter topics; subscriptions with ordering key = `tenant_id`.
7. `iam` — one service account per Cloud Run service/job, least privilege; WIF pool for GitHub.
8. `cloudrun-service` — reusable module: min instances (prod ≥1 for gateway), VPC egress all-traffic through connector, ingress internal-and-load-balancer, binary authorization required, secrets mounted from Secret Manager, OTel env vars, non-root container.
9. `monitoring` — uptime checks, SLO (availability 99.9% gateway), alert policies: error rate, p95 latency > 2.5 s, Cloud SQL CPU/storage, outbox lag, audit-chain verification failure, egress-denied spike, break-glass activation.
10. `secrets` — placeholders only; values set out-of-band; access bound to service identities.

State: GCS backend per environment with object versioning; `terraform plan` + Conftest on PR, `apply` on merge (dev), manual approval (staging/prod).

---

## 4. Identity

### 4.1 IdP configuration (Auth0 as candidate; port-neutral)
- One IdP **Organization** per Sovereign tenant. Organization metadata: `tenant_id` (UUID generated by Sovereign, never by the IdP).
- Connections: Username-Password (pilot only, MFA enforced), OIDC/SAML enterprise connections attached per organization.
- MFA policy: always for `HUMAN_CLINICIAN`, `HUMAN_ADMIN`, security/auditor roles; never optional in prod.
- Access token: RS256, audience `https://api.sovereign.health`, lifetime 15 min. Refresh rotation on, absolute lifetime 8 h, reuse detection on.
- Post-login action adds custom claims:

```json
{
  "https://sovereign.health/tenant_id": "uuid",
  "https://sovereign.health/org_id": "org_xxx",
  "https://sovereign.health/user_id": "uuid",
  "https://sovereign.health/roles": ["clinician"],
  "https://sovereign.health/site_ids": ["uuid"],
  "https://sovereign.health/mfa": true,
  "https://sovereign.health/session_id": "uuid"
}
```

- Roles and grants are **not** stored in the IdP as source of truth; the login action calls `services/identity` (`GET /internal/grants/{idp_subject}`) with a bound M2M token. The IdP holds authentication only (ADR-0010).

### 4.2 Session and revocation
- Gateway verifies JWT (JWKS cached 10 min), checks `aud`, `iss`, `exp`, and presence of `tenant_id`, `user_id`, `session_id`. Missing → 401, audited.
- `services/identity` keeps `session_revocation`. Gateway holds an in-process LRU of revoked session IDs refreshed every 30 s. Revoke user → all sessions dead ≤30 s plus IdP refresh-token revocation.
- Idle timeout 15 min client-side; server-side via token lifetime.

---

## 5. Tenancy

### 5.1 Request context (packages/kernel)

```ts
interface RequestContext {
  tenantId: string;        // from JWT only — never from body/query/header
  userId: string;
  sessionId: string;
  roles: Role[];
  siteIds: string[];
  actorType: 'user' | 'service' | 'system';
  correlationId: string;   // X-Correlation-Id or generated
  causationId?: string;
  idempotencyKey?: string;
  requestedAt: Date;
}
```

Populated once in the gateway, propagated to services as signed internal headers (`X-Sovereign-Context`, HMAC with a per-environment secret, 60 s validity) **in addition to** the bound service ID token / mTLS (S1-D17). Services reject requests without both. **Any code path that reads `tenant_id` from user-controlled input fails review.**

### 5.2 Database enforcement
- Every table holding tenant data has `tenant_id text NOT NULL` (existing convention: composite primary key `(tenant_id, id)` per migrations 001/002).
- RLS enabled and forced on every such table. Policy template (matches migration 002):

```sql
ALTER TABLE patient_context.patient ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_context.patient FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON patient_context.patient
  USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text);
```

- `packages/persistence` already exposes `withTenantTransaction(db, tenantId, fn)`; the kernel wraps it as `withTenant(ctx, fn)`, which opens a transaction, runs `SELECT set_config('app.current_tenant', $1, true)` plus `app.actor_id` and `app.correlation_id` the same way, executes `fn`, and commits. **No query runs outside `withTenant` except migrations and explicitly tagged `@systemScope` jobs**, which use a separate DB role that also has RLS forced and a policy granting only the tenant in `app.current_tenant` (system jobs iterate tenants explicitly).
- Runtime role `sovereign_app`: `NOBYPASSRLS`, no table ownership, no DDL. Migration role `sovereign_admin`: DDL + `BYPASSRLS`, never available to runtime code (ADR-0009).
- Table-level lint (existing `tests/architecture-rls-linter.test.ts`): any tenant table without forced RLS fails the build unless listed in `config/rls-exempt.json` with justification (e.g., the `tenant` table itself).
- Repositories keep explicit `WHERE tenant_id = ?` predicates; RLS is defense in depth, never the sole control (ADR-0009).

### 5.3 Per-tenant encryption (packages/crypto)
- On tenant creation: generate 256-bit DEK, wrap with `tenant-kek` via `KeyManagementPort`, store wrapped DEK in `identity.tenant_key` (never plaintext). Local dev/CI: file-backed fake KMS implementation of the port.
- `encryptField(ctx, plaintext)` → `{ v:1, kid, iv, ct, tag }` stored in `bytea`. Designated PHI columns in Stage 1: `patient.demographics_enc`, `source_artifact.payload_ref` metadata. GCS objects: client-side encrypted with tenant DEK before upload, plus bucket CMEK.
- DEK cache in-process, 5 min TTL, cleared on tenant suspend.
- Tenant offboarding = destroy wrapped DEK version (crypto-shred) after legal-hold check; procedure in runbook, dual control.

---

## 6. Authorization

### 6.1 Model
- **Actor kinds** are the ADR-0010 set (`HUMAN_CLINICIAN`, `HUMAN_STAFF`, `HUMAN_ADMIN`, `HUMAN_PATIENT`, `SOVEREIGN_SERVICE`, `AI_AGENT_RUNTIME`, `EXTERNAL_SYSTEM`, `SYSTEM_ANONYMOUS`).
- **Roles** (PRD §9.1 + ops), each mapped to a human actor kind: `clinician`, `app` (advanced practice provider), `nurse_ma`, `pa_specialist`, `infusion_coordinator`, `practice_manager`, `org_admin`, `security_admin`, `auditor`, `support_readonly`, `patient` (not enabled in Stage 1).
- **Grants** are `AuthorityGrant`s (ADR-0010): scoped to tenant, actor, authority class, capabilities, site/patient constraints, temporal validity, delegation chain, revocation record.
- **Capabilities** are `resource:action` strings registered as `ActionDefinition`s, e.g. `patient:read`, `patient:reconcile`, `audit:query`, `audit:export`, `grant:create`, `config:approve_high_risk`, `killswitch:toggle`.
- `config/roles/matrix.yaml` is the single source of truth for role → capability defaults; a build step compiles it into the capability registry consumed by the domain evaluator. A role is not a grant; grants are issued per actor.

### 6.2 Policy evaluation
- Every route declares its capability; the kernel resolves the `ActionDefinition` server-side and calls the domain `AuthorizationEvaluator` with the `AuthoritativeSecurityContext` (ADR-0010). Decision input shape:

```json
{
  "subject": { "user_id":"…", "tenant_id":"…", "roles":["clinician"], "site_ids":["…"], "mfa":true, "actor_kind":"HUMAN_CLINICIAN" },
  "action": "patient:read",
  "resource": { "type":"patient", "id":"…", "tenant_id":"…", "site_id":"…" },
  "context": { "env":"prod", "killswitch": {"ai": false} }
}
```

- Decision logic (implemented in TypeScript in `packages/domain/src/authority/authorization-evaluator.ts`):

```
PERMIT iff  context.tenant == resource.tenant
        and an unexpired, unrevoked AuthorityGrant permits the capability
        and (resource.site is null or resource.site in context.sites or actor is HUMAN_ADMIN)
        and (capability not privileged or context.mfa)
        and actorKind is permitted by the ActionDefinition (AI never Class C/D)
else DENY with structured AuthorizationReasonFacts
```

- **Dual control**: capabilities tagged `dual_control` in the matrix (`killswitch:toggle` in prod, `grant:create` for `security_admin`/`org_admin`, `config:approve_high_risk`, `audit:export`, `tenant:erase`) create a `pending_approval` record; a second distinct human with the required role approves; both events audited. Implement in `services/identity` as a generic `approvals` table.
- Capability registry version is included in every audit event.
- Evaluator unit tests required for every rule; coverage gate 100% on `packages/domain/src/authority/*`.

### 6.3 Break-glass
- `support_readonly` cannot read PHI columns by default. Emergency PHI access requires `breakglass:request` → dual approval → time-boxed grant (max 4 h) → every read audited with `reason` mandatory. Alert fires on activation. AI principals can never use break-glass.

### 6.4 Idempotency
- Mutating endpoints require `Idempotency-Key` (UUID). Kernel stores `(tenant_id, user_id, key, request_hash, response, expires_at)` in `kernel.idempotency` (24 h TTL). Same key + same hash → replay stored response; same key + different hash → 409.

---

## 7. Service specifications

> Schemas below are target shapes. Reconcile against migrations 001/002 (composite primary key `(tenant_id, id)`, `tenant_id text`, existing `actors`, `patients`, `identity_mappings`, `authority_grants`, `authorization_audit_log`, `domain_outbox_events`): **extend existing tables, never duplicate them.** New columns/tables land as Kysely migration 003+.

### 7.1 services/identity

**Schema `identity`**

```sql
tenant(id text pk, slug text unique, display_name text, status text check in ('active','suspended','offboarding'),
       idp_org_id text unique, region text, created_at, updated_at)
tenant_key(tenant_id fk, key_version int, wrapped_dek bytea, kek_resource text, created_at, retired_at, pk(tenant_id,key_version))
site(tenant_id, id, name text, timezone text, npi text null, status text, created_at, pk(tenant_id,id))
app_user  -- existing `actors` table extended: idp_subject, email_enc bytea, status, last_login_at
grant     -- existing `authority_grants` (ADR-0010); add site constraint and approved_by if absent
approval(tenant_id, id, action text, payload jsonb, requested_by, approved_by null, status text, reason text, created_at, decided_at, pk(tenant_id,id))
session_revocation(session_id text pk, tenant_id, actor_id, revoked_at, reason text)
kill_switch(id text pk, tenant_id text null, capability text, enabled bool, changed_by, approval_id, changed_at)
scim_connection(tenant_id, id, token_hash bytea, status, created_at, rotated_at, pk(tenant_id,id))
scim_group_role(tenant_id, group_external_id text, role text, site_id null, pk(tenant_id,group_external_id))
```

Note: `tenant`, `tenant_key`, `session_revocation`, `kill_switch(tenant_id null)` are RLS-exempt with justification in `config/rls-exempt.json`; all others RLS.

**API (all under gateway `/v1`)**

| Method | Path | Capability | Notes |
|---|---|---|---|
| POST | `/tenants` | platform operator only (`SOVEREIGN_SERVICE`) | creates tenant, DEK, IdP organization |
| GET | `/tenants/current` | any authenticated | |
| POST | `/sites` | `site:create` | |
| GET | `/sites` | `site:read` | |
| POST | `/users/invite` | `user:invite` | creates IdP organization membership invite |
| GET | `/users` | `user:read` | |
| POST | `/grants` | `grant:create` (dual control) | |
| DELETE | `/grants/{id}` | `grant:revoke` | |
| POST | `/sessions/{id}/revoke` | `session:revoke` | |
| POST | `/approvals/{id}/decide` | role-dependent | second approver ≠ requester |
| GET/POST | `/kill-switches` | `killswitch:read` / `killswitch:toggle` (dual control in prod) | registry + kernel enforcement hook (WO-002C) |
| GET | `/internal/grants/{idp_subject}` | bound M2M token | called by the IdP login action |
| * | `/scim/v2/*` | SCIM bearer (per connection) | `adapters/identity-scim` |

**Events emitted** (`domain-events`): `tenant.created`, `site.created`, `user.invited`, `user.activated`, `user.deprovisioned`, `grant.created`, `grant.revoked`, `session.revoked`, `killswitch.changed`, `approval.decided`.

### 7.2 services/patient-context

**Schema `patient_context`** (extends existing `patients`)

```sql
source_system(tenant_id, id, kind text check in ('ehr','lab','pharmacy','payer','manual','fixture'),
              vendor text, display_name text, config_ref text, status text, created_at, pk(tenant_id,id))
patient   -- existing; add: primary_site_id, demographics_enc bytea, match_state check in ('confirmed','uncertain','duplicate_suspect','merged'), merged_into
patient_identifier(tenant_id, id, patient_id, source_system_id, identifier_type text,
                   identifier_value_hash bytea, identifier_value_enc bytea, is_primary bool, created_at,
                   pk(tenant_id,id), unique(tenant_id, source_system_id, identifier_type, identifier_value_hash))
source_artifact(tenant_id, id, source_system_id, patient_id null, artifact_type text,
                external_id text, external_version text, author text, effective_at, received_at,
                storage_ref text, content_hash bytea, mime_type text, supersedes null, created_at, pk(tenant_id,id))
clinical_fact(tenant_id, id, patient_id, fact_type text, code_system text, code text, value jsonb,
              status text, effective_at, source_artifact_id, source_location text,
              origin check in ('recorded','derived','human_correction'), state check in ('current','superseded','conflict','stale','unknown'),
              supersedes null, created_by null, created_at, pk(tenant_id,id))
reconciliation_item(tenant_id, id, kind check in ('uncertain_match','duplicate','conflict'),
                    subject_ids text[], candidate_ids text[], score numeric, reason text, status text,
                    resolved_by null, resolution jsonb, created_at, resolved_at, pk(tenant_id,id))
```

**Matching rules (PRD FR-005)** — deterministic only in Stage 1:
1. Exact match on `(source_system_id, identifier_type='MRN', identifier_value_hash)` → confirmed.
2. Else exact match on normalized `(last_name, first_name, dob, sex)` across the tenant → `uncertain` + reconciliation item; the record is created but flagged; **no clinical fact attaches to an uncertain patient**.
3. Else create new `confirmed` patient.
4. No probabilistic matching. Merges only via `POST /patients/{id}/merge` with capability `patient:reconcile`, reason mandatory, both records preserved (`merged_into`), audited. AI cannot merge, split, invent, or reassign identities (AGENTS.md §9).

**Provenance rules (PRD §8.13, ADR-0001/0002)** enforced in code:
- `source_artifact.content_hash` computed on ingest; artifact bytes are immutable in GCS (object versioning + no overwrite).
- `clinical_fact` is insert-only; corrections insert a new row with `origin='human_correction'`, `supersedes` set, and the old row moves to `superseded`. `unknown` is a first-class state and is never coerced to negative.
- `state='stale'` set by a job when `effective_at` is older than a configurable threshold per `fact_type` (default 365 days).

**API**

| Method | Path | Capability |
|---|---|---|
| POST | `/source-systems` | `source:manage` |
| POST | `/patients` | `patient:create` |
| GET | `/patients/{id}` | `patient:read` (site-scoped) |
| GET | `/patients?identifier=…` | `patient:read` |
| POST | `/patients/{id}/merge` | `patient:reconcile` |
| POST | `/artifacts` (multipart) | `artifact:ingest` — Stage 1 accepts `fixture`/`manual` sources only |
| GET | `/artifacts/{id}` | `artifact:read` — metadata + signed short-lived GCS URL |
| POST | `/facts` | `fact:record` — manual/fixture facts with mandatory `source_artifact_id` |
| POST | `/facts/{id}/correct` | `fact:correct` |
| GET | `/patients/{id}/timeline` | `patient:read` — facts ordered by `effective_at` with state flags |
| GET | `/reconciliation` | `patient:reconcile` |
| POST | `/reconciliation/{id}/resolve` | `patient:reconcile` |

**Events**: `patient.created`, `patient.merged`, `artifact.ingested`, `fact.recorded`, `fact.corrected`, `reconciliation.opened`, `reconciliation.resolved`.

### 7.3 services/audit

**Schema `audit`**

```sql
clinical_audit_event(
  event_id text pk, tenant_id text not null, site_id text null,
  actor_kind text, actor_id text null, role_grant text null,
  patient_id text null, resource_type text, resource_id text null, resource_version text null,
  action text, reason text null, occurred_at timestamptz, recorded_at timestamptz default now(),
  request_id text, correlation_id text, causation_id text null,
  source text null, destination text null,
  policy_version text, config_version text null, model_version text null, prompt_version text null,
  prior_state jsonb null, new_state jsonb null, artifact_hash bytea null,
  result text check in ('success','denied','error'), error_code text null,
  seq bigint not null, prev_hash bytea not null, event_hash bytea not null,
  unique(tenant_id, seq))
chain_anchor(tenant_id, anchor_date date, last_seq bigint, last_hash bytea, gcs_ref text, pk(tenant_id, anchor_date))
```

- `sovereign_app` has `INSERT, SELECT` only on the chain; `UPDATE/DELETE` revoked at role level and blocked by a trigger that raises.
- `event_hash = sha256(prev_hash || canonical_json(event without hashes))`; `seq` assigned under a per-tenant advisory lock to keep the chain linear.
- **Write path**: services do not call the audit service synchronously. `packages/kernel` `audit.emit(ctx, event)` inserts into `domain_outbox_events` in the same transaction as the business write; the relay publishes to `audit-events`; `services/audit` consumes with ordering key `tenant_id`, dedupes on `event_id`, and appends to the chain. A consequential operation whose audit row cannot commit fails (AGENTS.md; WO-015).
- Denied authorization decisions and 401s are audited from the gateway with `result='denied'`.
- `jobs/audit-anchor`: nightly per tenant, writes `{tenant_id, last_seq, last_hash}` to the retention-locked bucket and to `chain_anchor`.
- `GET /audit/verify?tenant&from&to` recomputes the chain and compares to anchors; failure alerts.

**API**

| Method | Path | Capability |
|---|---|---|
| GET | `/audit/events?patient_id&actor_id&action&from&to&correlation_id` | `audit:query` |
| POST | `/audit/exports` | `audit:export` (dual control) — signed, hashed JSONL in `exports-{env}`, scoped to filters, itself audited |
| GET | `/audit/verify` | `audit:verify` |

**Minimum audited actions in Stage 1**: login success/failure, token rejection, every authorization deny, tenant/site/user/grant CRUD, approval decisions, kill-switch change, patient create/read/merge, artifact ingest/read, fact record/correct, reconciliation open/resolve, audit query/export, break-glass request/approve/use, SCIM operations, configuration/capability-registry deploy.

### 7.4 apps/gateway

- Routes `/v1/*` to services; JWT verification, `AuthoritativeSecurityContext` construction and signing, per-tenant rate limiting (token bucket keyed by `tenant_id`, default 50 rps / burst 200), body schema validation from `packages/contracts`, response shaping, `Idempotency-Key` enforcement, security headers (HSTS, CSP nonce, no-sniff, frame-deny), request size limit 10 MB, upload content-type allowlist and ClamAV scan for artifacts (Cloud Run sidecar).
- `GET /health/live`, `GET /health/ready`, `GET /v1/integration-health` (PRD FR-038): per-dependency `{healthy|degraded|unavailable|misconfigured, last_success_at, last_failure_at}` for `db`, `pubsub`, `kms`, `idp`, `gcs`. No secrets, no PHI, no stack traces.

### 7.5 apps/admin (Stage 1 surfaces only)

- Login (IdP universal login), organization picker if multi-org.
- Admin: tenants (operator), sites, users, grants, approvals inbox, session revocation, kill-switch registry.
- Auditor: audit search, event detail (prior/new state diff), export request, chain verification status.
- Patient context: patient search, patient record, timeline with fact-state badges (recorded / derived / human correction / conflict / stale / unknown), reconciliation queue.
- Integration health page.
- Accessibility: WCAG 2.2 AA from the first component (PRD NFR-007); `packages/ui` ships tokens, focus states, axe checks in CI.

### 7.6 SCIM 2.0 (adapters/identity-scim)

- Endpoints: `/scim/v2/Users`, `/scim/v2/Groups`, `/scim/v2/ServiceProviderConfig`, `/scim/v2/Schemas`, `/scim/v2/ResourceTypes`. Bearer token per enterprise connection, stored hashed, rotatable, scoped to one tenant.
- Group → role mapping via `scim_group_role`; membership changes create/revoke grants; user `active=false` revokes all grants and sessions within 30 s.
- Every SCIM operation audited with `actor_kind='EXTERNAL_SYSTEM'` and the connection ID.

### 7.7 SIEM export (adapters/siem-export)

- Per-tenant export config: `siem_export(tenant_id, kind ∈ {hec, sentinel, chronicle, webhook}, endpoint_enc, secret_enc, enabled, last_success_at, last_failure_at)`.
- Delivery: at-least-once, HMAC-SHA256 signature header, exponential backoff (1 m → 1 h, 24 h max), dead-letter with alert; PHI fields excluded unless tenant enables `include_phi` under dual control.
- Schema: flat JSON matching `contracts/AuditEvent` plus `@timestamp`, `event.category`, `event.action`, `event.outcome` (ECS-compatible).

### 7.8 Retention, erasure, and legal hold

- `retention_class` enum per `DATA_CLASSIFICATION_SCHEDULE.md`: `legal_clinical` (10 y), `audit` (7 y), `operational` (30 d), `recording`, `generated_draft`, `support`, `analytics`, `synthetic`. Defaults in `config/retention.yaml`.
- `legal_hold(tenant_id, scope, subject_id, placed_by, placed_at, released_at)` — every erasure job checks holds first and refuses.
- Tenant erasure: verify contract termination → dual-control approval → DEK version destroyed (crypto-shred) → tombstone rows retain IDs and hashes only → certificate of destruction generated and audited.

---

## 8. Shared kernel behaviors (packages/kernel)

1. `RequestContext` guard — rejects unsigned/expired context and requests without a bound service identity.
2. Capability guard — server-resolved `ActionDefinition` + domain `AuthorizationEvaluator` before every handler; deny → 403 (404 for cross-tenant objects) + audit.
3. `withTenant` transaction wrapper — the only DB entry point for tenant data.
4. `audit.emit()` — validates against `contracts/AuditEvent`; writes to `domain_outbox_events` in-transaction.
5. Outbox relay — polls with `FOR UPDATE SKIP LOCKED`, publishes, marks published; exactly-once at consumer via `processed_event(event_id)`.
6. Idempotency middleware (§6.4).
7. Errors — typed taxonomy mapped to safe HTTP codes; `error_code` only, never internal messages, in responses.
8. Telemetry — OTel spans with `tenant_id`, `correlation_id`; logger with **allowlist** serializer: only fields registered in `contracts/LogFields` are emitted; anything else → `[redacted]`. Unit test asserts seeded synthetic PHI never appears in log output.
9. Kill-switch hook — every AI capability and external-action path checks the registry before executing; disabled → truthful degraded response, manual path surfaced.

---

## 9. CI/CD pipeline

`.github/workflows/ci.yml` (existing) + `security-supply-chain.yml` (new) on PR:
1. `pnpm install --frozen-lockfile`; `biome check`; `tsc --noEmit`.
2. `pnpm run verify` (PHI scan, architecture boundaries, vitest) — coverage ≥ 80% packages, 100% on `packages/domain/src/authority/*`, `crypto`, `audit` chain.
3. RLS linter (existing) — fails on any tenant table lacking forced RLS.
4. Contract tests (`tests/contract`) — gateway ↔ services against `packages/contracts`.
5. Integration tests — Postgres 16 + Pub/Sub emulator; migrations applied from scratch and from previous tag (migration replay).
6. Security: `gitleaks` (existing), `semgrep` (OWASP + custom rule: any read of `tenant_id` from `req.body|query|headers` outside gateway = error), `pnpm audit --audit-level=high`, `trivy` (fs + image), `checkov` + Conftest on Terraform.
7. SBOM (`syft`, CycloneDX + SPDX) attached; image signed (`cosign` keyless via WIF); provenance attestation (SLSA L3).
8. DAST: ZAP baseline against the PR's ephemeral preview; authenticated ZAP nightly on staging; `high` blocks.
9. `terraform plan` for changed env roots, plan posted to PR.
10. Accessibility (`axe`) on admin app.

`deploy-dev.yml` (on merge to `main`): build → Artifact Registry → `migrate` job → Cloud Run rings (internal canary → 1% → 10% → 50% → 100%, ≥15 min each, auto-rollback on SLO burn or P99 breach) → **adversarial suite against dev** (§10) → on pass, staging deploy → prod requires environment approval (2 reviewers, one security CODEOWNER).

Rollback: `gcloud run services update-traffic --to-revisions=PREV=100`; migrations are expand/contract; destructive migrations require a `## Rollback` section and a separate PR.

Branch protection: `main` requires PR, signed commits, linear history, all checks green; 2 reviews for `infra/`, `packages/crypto`, `packages/kernel`, `.github/`, `docs/adr/`.

---

## 10. Adversarial tenant-isolation and authorization suite (`tests/adversarial`)

Runs against a deployed environment with two seeded synthetic tenants (A, B) and users of every role. Each test is a build blocker.

1. Token of tenant A requests every `GET /v1/**` resource ID belonging to B → 404 (not 403; no existence leak).
2. Tenant A user tampers `tenant_id` in body/query/header on every mutating endpoint → ignored, resource lands in A, audit shows attempt.
3. Forged/expired signed context to a service directly → 401.
4. JWT with missing `tenant_id`, wrong `aud`, wrong `iss`, `alg=none`, expired, future `nbf` → 401.
5. Direct DB session without `app.current_tenant` set → zero rows from every RLS table; INSERT fails.
6. Role matrix sweep: every (role × capability) combination executed; result must equal `matrix.yaml`; any drift fails.
7. Site scoping: user granted site X reads patient in site Y → 404.
8. Privileged action without MFA claim → 403.
9. Dual control: same user requests and approves → 409.
10. Idempotency: replay same key → identical response; same key different body → 409; 100 concurrent identical POSTs → one resource.
11. Outbox/consumer: duplicate delivery → single audit row; out-of-order → chain still linear per tenant.
12. Audit immutability: UPDATE/DELETE via app role → error; chain verification detects one flipped byte.
13. Log leakage: full suite with seeded synthetic PHI; grep logs/traces/error responses → zero hits.
14. Egress: service fetch to a non-allowlisted host → blocked, alert fires.
15. Break-glass: PHI column read by `support_readonly` without active grant → denied; with grant → allowed, reason recorded, alert fires.
16. Kill switch toggle in prod without approval → 409; with approval → both events audited; disabled capability returns truthful degraded response.
17. Cross-tenant search: term matching B's patient from A's token → empty.
18. Export scoping: audit export filtered to patient P returns only P's events; export creation audited.
19. SCIM: user deactivated via SCIM → grants revoked and sessions dead ≤30 s; SCIM token of A cannot touch B.
20. M2M: valid user-context header without a bound service ID token / mTLS identity → 401.
21. SIEM: A's export endpoint never receives a B event under replay, reordering, or dead-letter redelivery.
22. Erasure: after DEK destruction, encrypted rows unrecoverable, tombstones remain; erasure under legal hold → refused and audited.
23. Ring rollback: inject 5% errors in Ring 0 → automatic rollback ≤2 min, incident auto-opened.
24. AI principal (`AI_AGENT_RUNTIME`) attempts Class C/D capability, break-glass, or identity merge → DENY with reason facts (WO-002 invariant preserved end-to-end through the HTTP edge).

---

## 11. Observability and operations

- SLOs (gateway): availability 99.9%/30 d; p95 latency ≤ 2.5 s. Error-budget alerts at 50%/90% burn.
- Dashboards: request rate/error/latency per service; outbox lag; audit consumer lag; authorization deny rate; RLS-exempt query count (~0 outside jobs); KMS errors; Cloud SQL connections; break-glass activations.
- Runbooks (`docs/runbooks/`): deploy/rollback, migration failure, outbox backlog, audit chain mismatch, IdP outage (existing sessions continue to expiry, new logins blocked, truthful banner), KMS unavailable (fail closed: PHI reads/writes 503, non-PHI continues), tenant suspend/offboard/erase, break-glass, incident/breach assessment intake (`INCIDENT_RESPONSE_PLAN.md`), backup restore drill (quarterly, PITR to scratch instance, checksum comparison), PIR template.
- Chaos/DR calendar: quarterly per S1-D24; first execution is a Gate 1 exit criterion.
- Status page (private) with a component per service; on-call tiers per S1-D25.
- Load model: k6 at 2× and 5× expected pilot load across two tenants; pool and autoscale triggers validated; report attached to Gate 1 evidence.

---

## 12. Compliance artifacts produced in Stage 1

1. ADR-0011 accepted; ADRs for any deviation from §1.
2. STRIDE/DREAD threat model per trust boundary — `docs/threat-model/` (expands `THREAT_MODEL.md`).
3. Data inventory: every table/column/bucket classified per `DATA_CLASSIFICATION_SCHEDULE.md` with retention and encryption class.
4. Data Residency & Sovereignty Matrix; subprocessor list with BAA status (GCP, IdP, GitHub — GitHub holds no PHI).
5. Service Eligibility Matrix updated for every service touched.
6. Access-review procedure (quarterly grant review export from `services/identity`).
7. Evidence bundle for Gate 1: CI logs, adversarial suite report, DAST report, load report, restore/DR drill, SBOM/provenance for the release tag.
8. Pen-test scope statement and vendor selection (execution before G6).
9. SIEM export schema and tenant onboarding guide.

---

## 13. Work breakdown (ordered; maps to WO-002A/B/C acceptance criteria)

| # | Ticket | Exit criteria | WO / trace |
|---|---|---|---|
| S1-01 | Kernel/crypto/telemetry package scaffolds added to ADR-0006 tiers and `verify-architecture.ts`; `--frozen-lockfile` on | `pnpm run verify` green; boundary test covers new packages | 002A AC-05 |
| S1-02 | Terraform: project, network, KMS, secrets, IAM, WIF | `plan`/`apply` dev via CI; org-policy assertions pass | 002A AC-01/02 |
| S1-03 | Terraform: Cloud SQL, GCS, Pub/Sub, monitoring | private connectivity proven; alerts fire on synthetic error | 002A AC-03/04 |
| S1-04 | `packages/contracts`: RequestContext, AuditEvent, LogFields allowlist | schema tests pass | 002C |
| S1-05 | `packages/telemetry`: redacting logger + OTel | PHI-leak test passes; traces in Cloud Trace | 002C AC-06 |
| S1-06 | `packages/kernel`: context guard, capability guard, `withTenant`, idempotency, outbox helper, `audit.emit`, kill-switch hook | kernel integration suite green | 002B AC-06/07; 002C AC-07 |
| S1-07 | `packages/crypto`: envelope encryption, `KeyManagementPort` (fake + Cloud KMS), DEK cache, KAT/rotation tests | 100% coverage | 002C AC-01 |
| S1-08 | IdP tenants (dev/staging/prod), organizations, login action, enterprise connection template, MFA policy | token carries all claims; MFA enforced | 002B AC-01 |
| S1-09 | `services/identity`: migration 003 (tenant, tenant_key, site, approval, session_revocation, kill_switch, scim tables), APIs, events | contract tests; dual-control tests | 002B AC-02/09 |
| S1-10 | `config/roles/matrix.yaml` + registry compiler + evaluator tests | 100% rule coverage; drift test | 002B AC-06 |
| S1-11 | `apps/gateway`: JWT, context signing, routing, rate limit, validation, health, integration-health | adversarial 1–4, 8, 10 pass | 002B AC-03/06/07 |
| S1-12 | `adapters/identity-scim` | adversarial 19 passes; IdP SCIM round-trip | 002B AC-04 |
| S1-13 | Service-to-service auth: ID tokens + mTLS ingress | adversarial 20 passes | 002B AC-05 |
| S1-14 | `services/patient-context`: migration 004, matching, artifacts (fixture/manual), facts, corrections, timeline, reconciliation | adversarial 7, 17 pass; provenance tests | 002B/002C |
| S1-15 | `services/audit`: chain, consumer, verify, query, export; `jobs/outbox-relay`; `jobs/audit-anchor` | adversarial 11, 12, 18 pass; anchor in locked bucket | 002C AC-03/04/05 |
| S1-16 | Retention classes, legal hold, erasure jobs, BYOK path | adversarial 22 passes; BYOK tenant in staging | 002C AC-02/08 |
| S1-17 | `adapters/siem-export` + tenant config + ECS schema | adversarial 21 passes; HEC + webhook verified | 002C AC-09 |
| S1-18 | Metering `billable_unit` projection + collector | reconciles 100% on sampled window | 002C AC-10 |
| S1-19 | `apps/admin` Stage 1 slice + `packages/ui` | axe clean; keyboard walkthrough recorded | 002B |
| S1-20 | `security-supply-chain.yml`: semgrep, pnpm audit, trivy, checkov/conftest, SBOM, cosign, SLSA, DAST | all gates required on `main` | 002A AC-05/06/07 |
| S1-21 | `deploy-dev.yml`/`deploy-staging.yml`/`deploy-prod.yml` with rings, rollback, migration job | rollback injection test passes | 002A AC-08 |
| S1-22 | Adversarial suite complete, wired into deploy-dev | 24 tests green on dev and staging | 002A/B/C |
| S1-23 | Threat model, residency matrix, data inventory, subprocessor list, eligibility updates | reviewed and signed | 002A AC-10/12 |
| S1-24 | Load model, first chaos/DR drill, status page, on-call, PIR template, runbooks | drill report with measured RTO/RPO | 002A AC-11 |
| S1-25 | Stage review: walkthrough of every RLS-exempt table and `@systemScope` job; gate records for 002A/B/C with named approvers | Gate 1 evidence bundle | G1 |

**Definition of done for the stage**: every ticket's exit criteria has committed evidence in a gate record; adversarial suite green on staging for 7 consecutive daily runs; no critical/high findings open; WO-003 implementation may begin.

---

## 14. Handoff notes to the developer

1. Build in ticket order. S1-01 through S1-07 are prerequisites; do not start a service before the kernel exists.
2. If a choice in §1 must change, write the ADR first and get it approved before code.
3. Any code that reads tenant identity from user input, writes an audit row outside the outbox path, logs an unregistered field, runs a tenant query outside `withTenant`, or lets an AI principal reach Class C/D is a defect regardless of test results.
4. Synthetic data only in every environment until G0-B GO; `scripts/verify-synthetic-data.ts` stays required in CI.
5. Deliver the Gate 1 evidence bundle as a tagged release (`v0.2.0-foundation`) with SBOM and provenance attached, plus gate records for WO-002A, WO-002B, WO-002C signed by named humans.
