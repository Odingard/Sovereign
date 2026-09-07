# ADR-0005 — Human Clinical Authority

Status: Accepted

## Context

Clinical discussion and model suggestions do not establish a decision. Efficient UX cannot erase responsibility.

## Decision

Class D clinical judgment remains human. Class C transactions require explicit clinician authorization bound to exact content, patient, tenant, purpose, evidence, conditions, and expiry. AI cannot authorize itself or another agent. Ambiguity is `REQUIRES CLINICAL DECISION`.

## Consequences

Interfaces must show evidence, intent, uncertainty, and exact action. Authorization may add a deliberate step; unnecessary clicks should be removed elsewhere.

## Rejected alternatives

Implied consent from conversation; role alone as standing authorization; model confidence as authority; bulk approval without item checks.

## Verification

Negative tests cover stale/edited authorization, wrong patient/tenant, missing condition, revoked role, bulk partial denial, and direct agent execution.

