# WO-011 — AI Reasoning Layer

Status: BLOCKED BY WO-004/006–010  
Priority: P0  
Risk: CRITICAL  
Owner: AI platform lead  
Clinical reviewer: Clinical AI safety lead  
Security reviewer: AI security/privacy lead

## Objective and rationale

Provide replaceable AI reasoning that creates typed, source-linked candidates inside Sovereign controls. AI is not the system of record or an authority principal.

## Scope

Provider port; deterministic test model; optional Gemini adapter; prompt/template registry; bounded retrieval; candidate extraction/state; evidence summary; intent classification; draft documentation; potential-conflict detection; workflow reasoning; typed tool request preparation; lineage; evaluation hooks; timeouts/fallback/kill switch.

## Out of scope

Direct database mutation; independent treatment selection; policy bypass; direct adapter execution; invented facts; shared-model training on customer data; provider-specific types in domain.

## Requirements/domain rules

- Every output is a typed candidate with sources, uncertainty, provider/model/prompt/retrieval/config versions.
- Schema/citation/prohibited-action checks occur before candidate acceptance.
- Candidate cannot mark itself verified/authorized/completed.
- Model context is minimum necessary, tenant/patient scoped, and nonpersistent unless explicitly governed.
- Provider can be swapped without changing canonical objects.
- Clinical ambiguity returns `REQUIRES CLINICAL DECISION`.

## Safety/security/audit/ports

No-training/retention controls; eligible endpoint; prompt-injection/content isolation; output encoding; secret/PHI-safe telemetry; rate/budget control. Audit invocation purpose, source IDs/hashes, versions, result/disposition, latency/cost and safe error—not hidden chain-of-thought.

## Failure/tests

Timeout, refusal, malformed output, hallucinated citation, malicious source, cross-patient retrieval, provider drift/outage, prompt/version change, excessive context, repeated call. Fall back to deterministic/manual path; never mutate/execute. Test provider substitution and direct-tool/bypass attempts.

## Acceptance criteria

- AC-011-01: deterministic local provider runs all synthetic workflows offline.
- AC-011-02: provider abstraction swaps Gemini without domain changes.
- AC-011-03: AI cannot access authoritative persistence or external adapters directly.
- AC-011-04: output lineage and human/verification disposition are complete.
- AC-011-05: safety/security evaluation thresholds and kill switch pass.

## Documentation/evidence/decision

Provider contract, capability/model cards, data flow, prompts/templates governance, eval/security results, fallback/incident runbook. GO is per capability/model/version, not blanket.

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

