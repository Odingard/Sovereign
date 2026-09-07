# ADR-0003 — Sovereign Owns the Execution Graph

Status: Accepted

## Context

Advanced-therapy work crosses days, systems, and humans. Provider tasks or agent plans cannot reliably represent clinical objective, authority, retry, cancellation, or completion.

## Decision

Sovereign persists a durable Execution Graph. Every node includes action, evidence, owner, authority, dependencies, timing, state, retry, completion criteria, and escalation. Logical completion derives from verified domain evidence, never worker/task success alone. External engines may schedule but do not own semantics.

## Consequences

Restart/replay and provider substitution become testable. Graph reconciliation and migration require explicit design.

## Rejected alternatives

LLM plan as workflow; cloud workflow history as only state; background job queue as clinical state; flat task list.

## Verification

Restart, days-long wait, duplicate event/action, out-of-order confirmation, pause/cancel/supersede, retry, and unknown-vs-failed tests.

