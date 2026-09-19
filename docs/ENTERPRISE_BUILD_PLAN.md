# Sovereign — Enterprise SaaS Master Build & Execution Plan (Instantiated)

> Adopted by ADR-0011. Repository release gates G0–G6 remain in force and are mapped to plan Gates 0–4 in the matrix below; neither set waives the other. Stage 1 executes as WO-002A/B/C.

Instantiation of the immutable Enterprise SaaS Master Build & Execution Plan for Sovereign. Nothing from the master plan is removed; healthcare (HIPAA) items are added on top. Every bracketed option in the master plan is resolved below.

| Field | Value |
|---|---|
| Application | Sovereign (initial specialty: Rheumatology) |
| Executive Sponsor | Founder / Managing Member, Sovereign Health AI LLC |
| Principal Architect | Founder (architecture authority) with external Architecture Review Board (see §Governance) |
| Target Infrastructure | Google Cloud, single region `us-central1`, single-cloud (multi-cloud explicitly deferred) |
| Deployment Model | Multi-Tenant SaaS (Pool model with RLS + per-tenant keys); Isolated-Pod option reserved for enterprise tenants |
| Compliance Baselines | HIPAA (Security/Privacy/Breach rules, BAA), SOC 2 Type II (Security, Availability, Confidentiality); HITRUST r2 after GA; GDPR/FedRAMP not targeted |

## Governance (who signs)

Founder-led company; sign-off authorities from the master gate matrix are mapped to real people/functions so no gate is self-approved where the plan requires independence.

| Master role | Sovereign holder |
|---|---|
| Architecture Review Board (ARB) | Andre Byrd (Founder) + Roger (Architect) + Michael (Security); decisions recorded as ADRs with reviewer sign-off |
| Principal Architect | Andre Byrd (Founder); Roger as independent architecture reviewer |
| Platform Engineering Lead | Contract developer (build owner) |
| Product Management & Finance | Founder + fractional CFO/bookkeeper for Gate 2 |
| CISO | Michael (Security reviewer) — required signer for Gate 3; independent of the founder |
| VP Engineering & Head of SRE | Founder (VP Eng) + contract developer (SRE) — Gate 4 additionally requires the pen-test vendor's remediation letter and a physician partner's pilot sign-off |
| Clinical Safety Approver | Mark (Clinical reviewer), plus physician partner(s) per PRD RG-00/RG-03 |

---

## Phase 0 — Vision, Architecture Review & Governance Baseline

**Tenant boundary model:** Pool — shared compute, shared Postgres instance, schema-per-service, forced Row-Level Security on every tenant table (ADR-0009), per-tenant DEK under Cloud KMS KEK (BYOK/EKM for enterprise). Hybrid escape hatch: Isolated Pod (dedicated project + Cloud SQL, same code) for tenants that contractually require it.

**Noisy-neighbor mitigation:** gateway token-bucket rate limits keyed by tenant (default 50 rps / burst 200; tiers configurable), per-tenant Pub/Sub ordering keys, Cloud SQL connection-pool quotas per service, per-tenant job concurrency caps in the workflow engine, Cloud Run max-instances per service, per-tenant AI generation budgets.

**NFRs (locked):**
- Availability: 99.9% monthly at GA (PRD NFR-001); target 99.95% after 2 quarters of SLO history.
- Latency: gateway P95 ≤ 2.5 s usable content (PRD NFR-003) for interactive pages; core transactional APIs P95 < 300 ms, P99 < 800 ms (EHR-bound calls excluded and reported separately).
- RTO ≤ 4 h, RPO ≤ 15 min (PRD NFR-002); measured by drill, not asserted.

**Deliverables:** Architecture Design Document (this plan + Stage 1 spec + system context SVG) signed by ARB; STRIDE threat model with DREAD scoring for every trust boundary (WO-002A AC-10); Data Residency & Sovereignty Matrix (all PHI in `us-central1`, no cross-border subprocessors, subprocessor list with BAA status).

**Healthcare overlay:** BAA executed with GCP and the selected IdP before any PHI; privacy impact assessment; intended-use statement per AI capability (PRD §9.2); FDA CDS boundary analysis (PRD R-020). G0-B (real PHI) remains HOLD until separately approved.

**Exit: Gate 0.**

## Phase 1 — Core Platform Engineering & Identity Foundation

Delivered by `docs/STAGE1_FOUNDATION_SPEC.md` (v1.2, repository-reconciled) through WO-002A (cloud/IaC/CI), WO-002B (identity edge/gateway), WO-002C (audit/crypto/telemetry/retention/metering).

- IdP: adapter behind ADR-0010 ports; Auth0 Organizations is the leading candidate pending eligibility promotion; OIDC/SAML 2.0 enterprise connections (Entra ID, Okta, Ping supported); MFA enforced for privileged roles.
- SCIM 2.0 provisioning/deprovisioning.
- M2M: Google-signed ID tokens from service identities + mTLS internal ingress.
- RBAC + ABAC: domain `AuthorizationEvaluator` (ADR-0010), deny-by-default, dual control, break-glass; OPA/Conftest for infrastructure policy-as-code only.
- Tenant context resolved from verified claims at the gateway, signed, propagated on every trace (W3C TraceContext + `tenant_id` attribute).
- IaC: Terraform; private subnets, Private Service Connect, zero public IPs on backend compute, deny-all egress with allowlist.
- CI/CD: dev → test (ephemeral preview) → staging → rings (internal canary, 1%, 10%, 50%, 100%); policy-as-code (Conftest, Checkov) at PR.

**Exit: Gate 1** — IaC deployed in all environments, IdP + SCIM verified, CI/CD operational, adversarial suite green 7 consecutive days, first DR/chaos drill executed with measured RTO/RPO, load model run at 2× and 5×.

## Phase 2 — Data Architecture, Storage & State Management

- Partitioning: RLS (pool) with schema-per-service; tenant directory with in-process cache (30 s TTL, invalidated on `tenant.*` events).
- Encryption: TLS 1.3 preferred / 1.2 minimum; AES-256-GCM per-tenant DEK; CMEK on Cloud SQL/GCS; BYOK (customer KMS key) and EKM for enterprise tier.
- Canonical data model: the five authoritative objects (ADR-0002) plus PRD §8.13 entities, provenance rules enforced in code.
- Lifecycle: retention classes per `DATA_CLASSIFICATION_SCHEDULE.md`, archival to Coldline with CMEK, tombstone/soft-delete, crypto-shred erasure, legal hold; HIPAA designated-record-set handling; patient access/amendment requests routed to the covered entity's process.
- Backups: daily + PITR; quarterly restore drills; integrity validation.
- Stage deliverables: WO-003/004/005 (RA clinical state, evidence/provenance, EHR/FHIR ingestion) on the WO-002C foundation.

**Exit: Gate 0 data-schema addendum + repo G1.**

## Phase 3 — Commercialization, Monetization & Metering Engine

Pricing is deferred by product decision (PRD O-009); the engine is not.

- Metering: every canonical domain event emits a `billable_unit` projection through the outbox to a `metering-events` topic (WO-002C); idempotent collector partitioned by tenant/period; dedup on `event_id`; late-event window 72 h.
- Rating: rules engine converts units to rated metrics per cycle; pricing candidates (seat-based per clinician + per-site platform fee + AI-usage tier; enterprise custom contracts) evaluated after pilot economics.
- Billing gateway: Stripe Billing first; GCP Marketplace metering second; GL mapping and ASC 606 rev-rec via bookkeeping system; Avalara when revenue begins.
- Entitlements: feature flags + quota ceilings evaluated server-side in the kernel, cached client-side; grace 30 days, dunning, soft-lock = read-only (never blocks clinical safety functions or audit access).

**Exit: Gate 2** — metering reconciles 100% to canonical events on sampled periods, entitlement enforcement tested, billing webhooks certified in test mode.

## Phase 4 — Core Domain Development & Enterprise Integrations

- Gateway: Fastify BFF (`apps/gateway`, WO-002B); Cloud API Gateway/Envoy front for external partner APIs when introduced.
- Bounded contexts (`services/*` per ADR-0006 tiers): clinical-state, clinical-intent, verification, execution, policy, evidence, ai-reasoning, patient-context, identity, audit — each a Cloud Run service with its own schema.
- Async fabric: Pub/Sub via transactional outbox; Temporal behind the `WorkflowRuntime` port (never authoritative).
- Governed execution path (AGENTS.md): Clinical Intent → Verification → Policy/Authority → Execution Graph → deterministic adapter → external system → confirmation → graph update → audit.
- AI subsystem: `AIReasoningProvider` port, fake provider in CI, eligibility-gated cloud provider, model registry, evaluation harness (WO-016), per-capability kill switches.
- Webhooks: outbound engine with HMAC-SHA256, exponential backoff, DLQ; replay-protected inbound webhooks (WO-014).
- SIEM export: HEC / Sentinel / Chronicle streaming of audit events (WO-002C).

**Exit: repo G2/G3/G4 per work order; Gate 3 prerequisites.**

## Phase 5 — Security Hardening, Zero Trust & Compliance Readiness

- Secrets: Secret Manager only; short-lived tokens; no service-account keys (org policy); rotation 90 days.
- Zero trust east-west: mTLS on internal ingress; per-service identities; deny-by-default IAM and network.
- Pipeline break-build: SAST (Semgrep), SCA (pnpm audit + Trivy), secrets (gitleaks), container/IaC (Trivy, Checkov), DAST (ZAP), SBOM (CycloneDX + SPDX), signed provenance (SLSA L3).
- Audit: append-only hash-chained clinical audit with daily anchors in a retention-locked bucket; SIEM streaming.
- Continuous control monitoring mapped to SOC 2 TSC + HIPAA controls; evidence auto-collected.
- Third-party penetration test before pilot (repo G6) and annually; findings tracked to closure; retest letter required.
- Healthcare overlay: HIPAA risk analysis; incident/breach assessment runbook with 60-day notification workflow; workforce training records.

**Exit: Gate 3** — vCISO signs: pen-test highs/criticals remediated and retested, SBOM verified, audit chain verified, control monitoring green.

## Phase 6 — Enterprise Verification, Testing & Chaos Engineering

- Load: k6 at 2×–5× projected pilot load across ≥2 tenants; pool exhaustion and autoscale triggers validated; EHR adapter rate limits respected.
- Chaos: Cloud SQL failover, zone loss, Pub/Sub backlog, KMS unavailable (fail closed), IdP outage (degraded mode), EHR unavailable (data-freshness banner, no fabricated completeness), model provider outage (manual path).
- Clinical safety verification: WO-016 harness, adjudicated scenario set, subgroup review, human-factors test.
- Pilot / private preview: WO-017 shadow mode at named design-partner practices; synthetic validation first, shadow/read-only, then limited real-patient use only after G6 GO with daily safety review.

**Exit: Gate 4 prerequisites + repo G5.**

## Phase 7 — Production Release, GA & Day-2 SRE Operations

- Rings: internal canary → Ring 0 (1%) → Ring 1 (10%) → Ring 2 (50%) → 100%; ≥15 min per ring in staging, ≥1 h per ring in prod; automatic rollback on error-budget burn or P99 breach.
- Observability: four golden signals per tenant and system-wide; SLO dashboards; AI-quality and override-rate dashboards; integration health per adapter.
- Incident management: T1 (on-call founder/developer), T2 (developer/vendor), T3 (GCP/IdP/model provider support); incident bridge; private status page during pilot, public at GA; PIR within 5 business days, blameless RCA, corrective actions tracked (`INCIDENT_RESPONSE_PLAN.md`, WO-015).
- Change management: any change to intended use, authority, external actions, PHI flow, model/provider, or completion evidence requires an ADR and gate re-approval.

**Exit: Gate 4 + repo G6 (GA).**

---

## Enterprise Milestone Gate Matrix (Sovereign)

| Gate | Key exit criteria | Sign-off | Repo gate |
|---|---|---|---|
| Gate 0: Architecture | STRIDE/DREAD threat model, tenancy model, canonical data schema, residency matrix, BAAs executed, intended-use statements | ARB (founder + 2 external reviewers) | G0 |
| Gate 1: Foundation | IaC in all envs, IdP + SCIM + M2M verified, CI/CD with rings and rollback, adversarial suite green 7 days, load model run, first DR/chaos drill with measured RTO/RPO | Platform Engineering Lead + founder | G1 + WO-002A/B/C |
| Gate 2: Commercial | Metering reconciles to canonical events, rating rules tested, entitlement enforcement proven, billing webhooks certified | Founder (PM) + fractional CFO | — |
| Gate 3: Security & Compliance | Pen test remediated + retested, SBOM verified, audit chain verified, SIEM export live, control monitoring green, HIPAA risk analysis complete | vCISO (independent of founder) | G3, G6 prerequisites |
| Gate 4: GA Readiness | Load and chaos passed, DR drill within RTO/RPO, runbooks exercised, pilot evidence, clinical safety evaluation passed, physician sign-off | Founder + SRE + physician partner + vCISO | G5 + G6 |

Rule: a gate is signed only on committed evidence in the gate record. No gate is waived for a date, a customer, or an investor.

---

## Stage map (build order)

| Stage | Phase(s) | Work orders | Status |
|---|---|---|---|
| 0 | 0 | WO-000; threat model + residency matrix in WO-002A | G0-A GO; PHI HOLD |
| 1 | 1 (+2 design, +5 pipeline) | WO-001, WO-002 (GO); WO-002A, WO-002B, WO-002C | 002A–C specified, execution pending |
| 2 | 2 | WO-003, WO-004, WO-005 | 003 planning authorized; implementation HOLD until 002A–C GO |
| 3 | 4 | WO-006, WO-007, WO-008 | pending |
| 4 | 4 | WO-009, WO-010, WO-011 | pending |
| 5 | 4 | WO-012, WO-013 | pending |
| 6 | 4 | WO-014 | pending |
| 7 | 3 | metering/rating/entitlements/billing (new WO after pilot economics) | engine events from WO-002C; pricing deferred |
| 8 | 5–6 | WO-015, WO-016, WO-017 + pen test | pending |
| 9 | 7 | G6 → rings → GA | pending |
