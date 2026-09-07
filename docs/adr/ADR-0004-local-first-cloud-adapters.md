# ADR-0004 — Local First, Cloud Through Adapters

Status: Accepted

## Context

Canonical logic and safety must be proven before cloud dependency or PHI exposure. Cloud lock-in inside the domain would make verification and substitution harder.

## Decision

The reference build runs locally with synthetic data, relational persistence, deterministic AI, and local workflow implementations behind ports. Google services may later implement adapters. Core packages cannot import cloud SDKs or assume vendor identifiers/status.

## Consequences

Local conformance fixtures and adapter contracts are first-class. Production infrastructure remains a later gated decision.

## Rejected alternatives

Gemini session as application state; Cloud Workflows as domain graph; Healthcare API resources as domain entities; production cloud required for development.

## Verification

Offline synthetic end-to-end run; architecture/dependency test; swap local and cloud adapters without domain changes.

