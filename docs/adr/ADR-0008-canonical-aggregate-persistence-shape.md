# ADR-0008 — Canonical Aggregate Relational Persistence Shape & JSON Storage Boundaries

Status: ACCEPTED FOR LOCAL V0.1 — REASSESS BEFORE PRODUCTION SCALE

## Context

In WO-001, Sovereign established the relational persistence layer for the five canonical domain aggregates (`clinical_evidence`, `clinical_states`, `clinical_intents`, `execution_graphs`, and `therapy_access_cases`) alongside the transactional outbox (`domain_outbox_events`).

The underlying PostgreSQL storage uses tenant-scoped composite primary keys (`tenant_id`, `id`), patient secondary indices (`tenant_id`, `patient_id`), and optimistic concurrency versioning (`aggregate_version`). Within these aggregate tables, certain internal collections and value objects are serialized into PostgreSQL `jsonb` columns:
- `clinical_states.assertions_json`
- `clinical_evidence.assessments_json`
- `clinical_intents.supporting_evidence_ids_json`
- `clinical_intents.action_concept_json`
- `execution_graphs.nodes_json`
- `execution_graphs.traceable_intent_ids_json`
- `therapy_access_cases.associated_*_ids_json`
- `therapy_access_cases.verified_evidence_ids_json`

A clear architectural decision is required to govern the boundaries, safety, concurrency implications, and evolutionary path of this persistence shape.

---

## Decision

1. **JSON-backed aggregate internals are accepted for local v0.1 reference implementation:**
   Storing internal aggregate collections as JSONB columns within the aggregate root row guarantees atomic aggregate reads/writes, transactional consistency without multi-table join cascades, and zero ORM impedance mismatch during the local reference and synthetic proof phases.

2. **Persistence implementation mechanism, NOT a domain-model requirement:**
   PostgreSQL persistence is an infrastructure mechanism behind repository ports. The domain layer in `packages/domain` remains completely agnostic of relational columns, tables, or JSON serialization. Domain entities never expose or depend upon database serialization layouts.

3. **Core aggregates remain typed; zero untyped escape hatches:**
   JSON storage must never become an untyped domain escape hatch. `Record<string, unknown>` and arbitrary JSON dictionaries are prohibited across domain interfaces. Every serialized JSON column maps strictly to strongly typed TypeScript interfaces, discriminated union types, and branded identifiers validated at the repository boundary.

4. **Concurrency implications:**
   Updates to an aggregate are protected by optimistic concurrency checking on `aggregate_version`. If two processes attempt to mutate the same aggregate concurrently (e.g. updating two different nodes in an `ExecutionGraph`), the second update fails closed with a `ConcurrencyConflictError`. While this prevents data corruption and lost updates, it serializes concurrent mutations at the aggregate level.

5. **Future normalization strategy without domain modification:**
   If production scale, high-frequency concurrent node-update contention, cross-node relational indexing, or granular compliance audit queries justify it, `execution_graphs.nodes_json` may be normalized into a dedicated `execution_nodes` table (and `clinical_states.assertions_json` into `clinical_assertions`). Because application services and domain logic interact exclusively with aggregate interfaces, this normalization can occur entirely within `packages/persistence` migrations and repository implementations without altering the canonical domain contracts or API boundaries.

---

## Consequences

- **Positive:** Simple, transactional, high-fidelity aggregate boundaries in local and synthetic testing. Fast round-tripping with guaranteed consistency.
- **Trade-off:** Aggregate-level optimistic locking means concurrent updates to different parts of the same aggregate root will encounter version conflicts and require retry.
- **Governance:** JSONB columns are subject to strict serialization/deserialization schemas. Schema versioning (`schema_version`) and upcasting logic must be maintained whenever column structures evolve.

---

## Rejected Alternatives

- **Fully normalized relational schema for v0.1:** Rejected for initial canonical domain establishment. Premature normalization of DAG nodes and assertions across 15+ join tables would slow development, increase migration friction, and introduce complex cascade locking without tangible benefit before WO-010 execution orchestration.
- **Untyped Document Store (NoSQL / MongoDB):** Rejected. Relational PostgreSQL is mandatory for ACID transactional guarantees, outbox atomicity, and multi-tenant isolation.
- **Untyped domain JSON payloads:** Strictly rejected under Sovereign permanent doctrine.

---

## Verification

Persistence integration tests in `tests/persistence-postgres.test.ts` verify round-trip fidelity, optimistic concurrency locking, schema version upcasting, and tenant/patient isolation across all JSON-backed aggregate properties.
