# WO-014 — External Execution Adapters

Status: BLOCKED BY WO-008–013  
Priority: P0  
Risk: CRITICAL  
Owner: Integration execution lead  
Clinical reviewer: Clinical operations lead  
Security reviewer: Integration security lead

## Objective and rationale

Implement deterministic, replaceable adapter boundaries for EHR, ePA, payer, pharmacy, infusion, and communications. Logical domain actions must not contain vendor-specific logic.

## Scope

Typed commands/results; capability/health; authentication; destination allowlists; mapping; provider-operation record; idempotency/dedupe; timeout/retry/circuit breaker; rate limit; acknowledgment; webhooks/polling; reconciliation; secrets/redaction; simulator adapters.

## Out of scope

Clinical decisions; direct AI tool invocation; vendor types in domain; treating HTTP 2xx as clinical completion; automatic fallback to an unapproved channel; real production connection before gates.

## Requirements/domain rules

- Dispatcher accepts only verified/authorized graph node and exact payload hash.
- Adapter checks current capability/authorization immediately before send.
- Attempted, transmitted, received, accepted and completed are distinct results.
- Provider idempotency plus Sovereign operation identity prevent duplicate logical actions.
- Webhook/poll results are observations until correlated/validated.
- Reconciliation is safe and cannot manufacture success.
- Simulator must reproduce success, delay, timeout, duplicate, disorder and failure.

## Safety/security/audit/ports

Per-tenant credentials; secret manager port; TLS; SSRF/DNS/redirect/egress controls; signed/replay-protected inbound events; minimum payload; no secrets/PHI in standard logs. Audit payload artifact hash, destination, attempt, acknowledgment, external reference, mapping/config version, response code class, retry and final disposition.

## Failure/tests

401/403/404/409/429/5xx, timeout before/after provider receipt, malformed response, replay, out-of-order event, circuit open, credential rotation, wrong correlation, partial batch. Tests prove safe retry/no duplicate and truthful unknown.

## Acceptance criteria

- AC-014-01: all six adapter contracts and simulators exist.
- AC-014-02: domain packages contain no vendor SDK/type/status logic.
- AC-014-03: direct AI-to-adapter invocation is structurally impossible.
- AC-014-04: timeout/replay/duplicate/reconciliation/security tests pass per adapter.
- AC-014-05: completion requires domain evidence, not transport success.

## Documentation/evidence/decision

Port contracts, capability/mapping/security matrices, sequence diagrams, simulator fixtures, conformance/failure results, runbooks. GO is adapter/version/environment specific.

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

