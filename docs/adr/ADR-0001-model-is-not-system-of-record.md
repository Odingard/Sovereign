# ADR-0001 — Model Is Not the System of Record

Status: Accepted

## Context

Model sessions are probabilistic, provider-dependent, ephemeral, difficult to reproduce, and may omit or invent information. Healthcare state requires deterministic identity, provenance, authorization, correction, versioning, persistence, and audit.

## Decision

The wrong architecture makes the model the system of record. The correct architecture makes the model a reasoning component inside a controlled system. For Sovereign, the second architecture is mandatory.

AI outputs are typed candidates. Only authorized domain services may mutate persistent authoritative objects after validation, evidence/provenance, policy/authority, concurrency, and audit checks. No agent directly executes external healthcare actions.

## Consequences

Models/providers can be replaced; candidates may be rejected; sessions can disappear without loss of truth. Additional domain and verification engineering is required.

## Rejected alternatives

Chat transcript as record; agent memory as patient state; vector database as canonical state; model-generated summaries overwriting sources; direct model tool calls to EHR/payer/pharmacy.

## Verification

Dependency tests prevent core imports of provider SDKs; mutation/execution tests prove bypass impossible; restart/provider-loss tests preserve all authoritative state.

