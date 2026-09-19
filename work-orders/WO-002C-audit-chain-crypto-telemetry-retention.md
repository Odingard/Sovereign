# WO-002C — Clinical Audit Chain, Per-Tenant Encryption, PHI-Safe Telemetry, Retention & Metering Events

Status: BLOCKED BY WO-002A (may plan in parallel; may implement alongside WO-002B)  
Priority: P0  
Risk: CRITICAL  
Owner: Andre Byrd (Founder)
Clinical reviewer: Mark
Security reviewer: Michael
Architecture reviewer: Roger

## Objective and rationale

Every work order from WO-003 onward persists clinical data and emits audit. The repository has hash helpers and an append-only authorization log but no chained clinical audit, no anchoring, no per-tenant encryption implementation, no PHI-safe telemetry, no kill switches, and no retention/erasure execution. These are prerequisites, not WO-015 finishing work. Master plan Phases 2.1, 5.2, 7.2 and Phase 3 metering obligation.

## Dependencies/inputs

WO-002 (GO), WO-002A (KMS, GCS anchors bucket, Pub/Sub), ADR-0007/0009/0011, `docs/DATA_CLASSIFICATION_SCHEDULE.md`, `docs/STAGE1_FOUNDATION_SPEC.md` §5.3, §7.3, §7.7, §7.8, §8, §11.

## Scope

- `packages/crypto`: AES-256-GCM envelope encryption; per-tenant DEK wrapped by Cloud KMS `tenant-kek` (local dev: file-backed fake KMS behind a `KeyManagementPort`); `tenant_key` table (wrapped DEK, version, KEK resource); DEK cache 5 min TTL cleared on suspend; BYOK/EKM via `kek_resource`; crypto-shred procedure with dual control and legal-hold check; KAT vectors and rotation tests.
- Clinical audit chain in `packages/audit` + `packages/persistence`: `clinical_audit_event` with the WO-015 field dictionary (`who, what, when, tenant, patient, evidence, intent, authority, model/version, external result, override, prior/new state, correlation/causation, policy/config/model/prompt versions, artifact hash, result, safe error code`), per-tenant `seq`, `prev_hash`, `event_hash = sha256(prev_hash || canonical_json(event))`, advisory-locked sequencing, `sovereign_app` INSERT/SELECT only plus trigger that raises on UPDATE/DELETE; write path is in-transaction via the existing outbox (audit atomic with the mutation; consequential operations block if audit cannot commit).
- `jobs/audit-anchor`: nightly per-tenant anchor `{last_seq, last_hash}` to the retention-locked bucket and `chain_anchor` table; `GET /audit/verify` recomputes and compares; mismatch alerts.
- Authorized audit query and export (dual control): signed, hashed JSONL scoped to filters; export itself audited.
- `packages/telemetry`: OpenTelemetry setup; structured JSON logger with **allowlist** serializer (`contracts/LogFields`); any unregistered field → `[redacted]`; unit test asserts seeded synthetic PHI never appears in logs, traces, or error responses; opaque correlation IDs only.
- Kill-switch registry (`kill_switch` per capability/tenant, dual control in prod) with enforcement hook in the kernel; integration-health data source.
- Retention: `retention_class` on every table per schedule; `legal_hold` table; erasure jobs (tenant crypto-shred + tombstones; record-level tombstones); certificate of destruction; deletion refused under hold.
- SIEM export: `siem_export` per-tenant config (HEC / Sentinel / Chronicle / signed webhook), at-least-once delivery, HMAC signature, exponential backoff to 24 h, DLQ + alert, ECS-compatible schema, PHI excluded unless dual-controlled `include_phi`.
- Metering: `billable_unit` projection emitted for every canonical domain event through the outbox into a `metering-events` topic; idempotent collector; no pricing logic.

## Out of scope

Dashboards and SLO tuning (WO-015), incident tabletop (WO-015), pricing/rating/billing gateway (Phase 3 later), any PHI.

## Requirements and rules

- Audit is append-only; corrections append. A consequential state change that cannot commit its audit row fails the transaction.
- Clinical audit is separate from operational telemetry; telemetry never contains PHI.
- Encryption keys are per tenant; no shared master key; tenant offboarding is crypto-shred.
- Deletion is authorized, provable, legal-hold-aware, and audited.
- SIEM and metering payloads are derived from canonical events only.

## Safety/security/audit/ports

Ports: `KeyManagementPort`, `AuditSinkPort`, `IntegrityAnchorPort`, `TelemetryPort`, `SiemExportPort`, `MeteringPort`, `RetentionJobPort`. Local implementations are fake/file-backed; cloud implementations live in `providers/` or `adapters/` and are eligibility-gated.

## Failure/tests

Audit store unavailable → consequential operation blocked; one flipped byte → verification fails; duplicate/out-of-order outbox delivery → single audit row, linear chain; KMS unavailable → PHI read/write returns 503, non-PHI continues; DEK destroyed → rows unrecoverable, tombstones remain; erasure under legal hold refused; SIEM replay/reorder/redelivery never crosses tenants; PHI-seeded suite → zero hits in logs/traces/errors; kill switch toggled → new generation stops, approved canonical work intact, truthful degraded banner.

## Acceptance criteria

- AC-002C-01: Envelope encryption with per-tenant DEK proven; KAT and rotation tests pass; BYOK tenant provisioned in staging.
- AC-002C-02: Crypto-shred procedure exercised on a synthetic tenant with certificate of destruction; refused under legal hold.
- AC-002C-03: Clinical audit chain linear per tenant under concurrent writers; UPDATE/DELETE rejected at DB and trigger level.
- AC-002C-04: Nightly anchor written to locked bucket; `verify` detects tampering.
- AC-002C-05: Authorized, dual-controlled, scoped export produced and itself audited.
- AC-002C-06: PHI-leak test passes across logs, traces, metrics labels, and error responses.
- AC-002C-07: Kill-switch registry with dual control in prod; enforcement test passes; integration-health reflects state.
- AC-002C-08: Retention classes present on 100% of tables (schema test); legal hold and erasure jobs proven on synthetic data.
- AC-002C-09: SIEM export verified against HEC and signed-webhook targets; tenant isolation under redelivery proven.
- AC-002C-10: `billable_unit` events reconcile 100% to canonical events over a sampled window.
- AC-002C-11: Independent security and clinical review recorded in the gate record.

## Documentation/evidence/decision

Audit dictionary, key-management runbook, erasure runbook, SIEM onboarding guide, metering event schema, test reports, gate record. **NO-GO** on any PHI leakage into telemetry, any mutable audit path, or any shared-key design.

## Mandatory work-order field index

| Required field | Binding location/content |
| --- | --- |
| Status | Header metadata; must be updated only from acceptance evidence. |
| Priority | Header metadata. |
| Risk | Header metadata and residual-risk gate review. |
| Owner | Header role; assign a named human before execution. |
| Clinical reviewer | Header role; independent named human approval required where applicable. |
| Security reviewer | Header role; independent named human approval required where applicable. |
| Objective | Objective section above. |
| Product rationale | Objective/rationale section above; explains why the control matters to Sovereign. |
| Dependencies | Dependencies/inputs section above; unresolved dependency blocks start. |
| Inputs | Dependencies/inputs section above; inputs must be versioned and attributable. |
| Scope | Scope section above; no silent expansion. |
| Explicitly out of scope | Out-of-scope section above; prohibited work remains prohibited. |
| Functional requirements | Requirements section above and acceptance criteria below it. |
| Domain rules | Domain rules in the requirements section; repository constitution also applies. |
| Safety requirements | Safety controls above plus independent clinical-safety review. |
| Security/privacy requirements | Security/privacy controls above plus WO-000 restrictions. |
| Audit requirements | Audit controls above; consequential work requires durable audit. |
| Adapter/port requirements | Ports/adapters section above; core remains provider independent. |
| Failure behavior | Failure section above; identity/evidence/authority ambiguity fails closed. |
| Test requirements | Test section above; synthetic positive, negative, replay and failure tests required. |
| Acceptance criteria | Numbered AC list above; every item requires objective evidence. |
| Required documentation | Documentation/evidence section above. |
| Completion evidence | Documentation/evidence section; self-report is insufficient. |
| Go / Hold / No-Go decision | Final decision statement above; only designated humans approve GO. |
