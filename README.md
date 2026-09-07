# Sovereign

Sovereign is a Specialty Clinical Intelligence & Execution Platform from Sovereign Health AI LLC. The launch product, **Sovereign Rheumatology**, converts clinician decisions into governed, traceable, durable work that reaches verified completion.

> **Sovereign will never be the doctor.**  
> **The clinician decides; Sovereign makes the decision executable.**

## Architecture principle

The wrong architecture makes the model the system of record. The correct architecture makes the model a reasoning component inside a controlled system. For Sovereign, the second architecture is mandatory.

AI may propose candidates. Sovereign-owned domain services validate evidence, identity, authority, policy, state transitions, execution, confirmation, and audit. No model session, prompt, chat history, or agent memory is authoritative.

## Launch product

Sovereign Rheumatology begins with rheumatoid arthritis and advanced-therapy access. It maintains a source-linked clinical state, captures explicit clinical intent, verifies executable assertions, creates a durable Execution Graph, and tracks Therapy Access State through actual initiation, intentional change, or cancellation.

## Authoritative domain objects

1. **Clinical State** — validated longitudinal representation; unknown never becomes negative.
2. **Clinical Evidence / Provenance** — source identity, timestamps, attribution, extraction lineage, and integrity.
3. **Clinical Intent** — explicit distinction among discussion, consideration, conditions, recommendations, decisions, orders, authorization, deferral, rejection, and supersession.
4. **Execution Graph** — durable dependency graph with owners, authority, retries, completion criteria, and escalation.
5. **Therapy Access State** — end-to-end access and continuity state through verified initiation or intentional closure.

## Local-first strategy

The first implementation uses synthetic data, a local relational database, deterministic test models, provider interfaces, and a local workflow engine behind ports. Core domain packages must not import cloud SDKs or vendor schemas. Cloud services are introduced only through adapters after canonical behavior and evaluation are proven.

Progression:

`local reference → canonical domain proof → synthetic evaluation → synthetic end-to-end proof → cloud adapters → security/PHI gate → shadow pilot → approved PHI use`

## Repository map

- `docs/` — constitution, architecture, governance, safety, and ADRs.
- `work-orders/` — controlled WO-000 through WO-017 build sequence.
- `specs/` — executable contracts and examples for authoritative objects.
- `apps/` — clinician, operations, and admin experiences.
- `services/` — provider-independent domain/application services.
- `adapters/` — replaceable external-system implementations.
- `evals/` — state, intent, verification, execution, and safety evaluation assets.
- `test-data/synthetic-only/` — the only permitted development data before formal approval.
- `.agents/agents/` — repository-scoped Antigravity reviewers.
- `antigravity/` — startup prompt, bootstrap task, sequence, review protocol, and Git plan.

## Local bootstrap

This v0.1 package is architecture-first and intentionally does not lock a language/framework. During WO-000, establish the toolchain by ADR before adding application code. Until then, baseline validation is documentation and policy validation:

```bash
find . -type f -not -path './.git/*' | sort
rg -n "TODO|TBD|real PHI" .
rg -n "Sovereign will never be the doctor|model is not the system of record" .
```

After the stack ADR, add canonical commands for dependency install, lint, type-check, unit/integration tests, evaluations, security scans, and local startup here. No developer may infer a stack from an example alone.

## Work-order execution

1. Read `AGENTS.md`, all ADRs, and `work-orders/README.md`.
2. Execute one work order at a time on a protected feature branch.
3. Convert every acceptance criterion into objective evidence.
4. Obtain named clinical/security review where required.
5. Record `GO`, `HOLD`, or `NO-GO`; do not self-approve a gate.
6. WO-000 must receive GO before WO-001 and before any real PHI.

## ADR use

Use ADRs for material decisions affecting authoritative objects, clinical authority, persistence, tenancy, workflow, AI/provider boundaries, external execution, privacy/security, or technology stack. Accepted ADRs are immutable; supersede them with a new ADR.

## Antigravity use

Give Antigravity this repository and instruct it to read `antigravity/MASTER_STARTUP_PROMPT.md`. It must validate the repository and produce the WO-000 execution plan only. It must not build the entire product or begin WO-001 before the WO-000 gate is approved.

## Tests and evaluations

The evaluation taxonomy is defined in `evals/README.md` and WO-016. All test fixtures are synthetic. Tests must cover canonical transitions, prohibited transitions, cross-tenant/wrong-patient attempts, replay/duplicates, restart recovery, conflicting and missing evidence, ambiguous/changed intent, provider failure, override, and safe degradation.

## PHI prohibition

**No real PHI may be ingested, stored, logged, transmitted, displayed, or used for development before WO-000 receives an explicit GO from the designated clinical, privacy, security, and founder authorities.** Development defaults to synthetic data only.

## What Sovereign is not

- Not an autonomous doctor.
- Not a generic chatbot.
- Not an ambient scribe only.
- Not a replacement EHR.
- Not a system where the LLM is the database.

