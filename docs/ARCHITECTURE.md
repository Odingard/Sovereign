# Architecture

## System shape

Sovereign uses a ports-and-adapters architecture around a canonical relational domain and durable event/workflow model. The core is runnable locally with synthetic data and deterministic substitutes. Cloud and vendor services implement ports; they never redefine domain truth.

## Layers

1. **Experience:** clinician, operations, and admin apps issue commands and queries; no business authority in UI.
2. **Application:** use cases coordinate identity, clinical state, evidence, intent, verification, policy, execution, and audit.
3. **Domain:** five authoritative objects, invariants, typed transitions, versioning, and reason codes.
4. **Infrastructure adapters:** database, workflow engine, EHR/FHIR, AI, payer/ePA, pharmacy, infusion, communications.
5. **Evidence/operations:** audit, evaluation, observability, incident controls, and release evidence.

## Control paths

Mutation: `AI candidate → validation → evidence/provenance → policy/authority → authorized domain service → persistent update → audit`.

Execution: `Clinical Intent → Verification → Policy/Authority → Execution Graph → deterministic adapter → external system → confirmation → graph update → audit`.

## Persistence and events

Use ACID transactions for canonical mutations, optimistic concurrency for versioned aggregates, a transactional outbox, idempotent inbox/consumer records, correlation/causation IDs, immutable evidence references, and explicit supersession. Never use an event bus, vector store, model context, or workflow history as the only source of canonical truth.

## Local and cloud

Local defaults: relational database, local object storage substitute, local durable-workflow adapter, deterministic AI provider, synthetic data, no production credentials. Later Google adapters may use Cloud Healthcare API/Healthcare Data Engine, Cloud SQL/PostgreSQL, Cloud Run, Pub/Sub, Google Cloud Workflows, Gemini Enterprise Agent Platform, Secret Manager, and Cloud Logging/Monitoring.

**Google-managed AI capability ≠ Sovereign clinical authority.**  
**Cloud IAM ≠ complete tenant/patient authorization model.**

## Dependency rule

Domain packages may depend only inward on domain contracts. Vendor SDKs, wire formats, FHIR resources, and provider status strings terminate in adapters and explicit mappers. Stack selection requires its own ADR during WO-000.

