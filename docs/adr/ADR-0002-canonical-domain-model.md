# ADR-0002 — Canonical Domain Model

Status: Accepted

## Context

EHRs, FHIR, payer portals, pharmacies, and AI providers describe similar concepts differently. Using any vendor schema as truth leaks transport semantics into care logic.

## Decision

Sovereign owns five persistent aggregates: Clinical State, Clinical Evidence/Provenance, Clinical Intent, Execution Graph, and Therapy Access State. Each is tenant/patient scoped, versioned, model-independent, auditable, and mapped explicitly at adapter boundaries. FHIR is transport, not canonical clinical state.

## Consequences

Core behavior is stable across vendors, but mappings and semantic conformance tests are required. Unknown/conflicted values remain explicit.

## Rejected alternatives

Persist raw FHIR as domain model; EHR-specific objects in services; one generic JSON blob; model-generated state without typed invariants.

## Verification

Canonical contract tests run against local fixtures and at least one adapter without changing domain types.

