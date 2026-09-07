# ADR-0006 — Local Stack and Toolchain Selection

Status: Accepted

## Context

Sovereign requires a deterministic, local-first reference architecture before cloud integration and before any Protected Health Information (PHI) exposure. The core architecture must remain cloud-provider independent, runnable locally on synthetic data, and verifiable through automated tests. Furthermore, the architecture must strictly enforce that the model is never the system of record, and that external workflow engines or AI providers never become authoritative clinical state stores.

## Decision

We establish the following standard local stack and toolchain for Sovereign:

1. **Language & Runtime:**
   - **TypeScript** as the canonical application and domain language across all core services.
   - **Node.js LTS (pinned to v20.x in `.nvmrc` and `package.json`)** as the standard runtime.
   - **pnpm workspaces** for monorepo package management and dependency isolation.

2. **API & Validation:**
   - **Fastify** as the high-performance HTTP/API framework for application and service boundaries.
   - **Zod** as the single source of truth for runtime validation, input/output schemas, and domain contract boundaries.

3. **Persistence & Migration:**
   - **PostgreSQL** as the authoritative local relational database for all five Sovereign authoritative objects.
   - **Kysely** for type-safe SQL query building and explicit, auditable, reversible database migrations.

4. **Workflow Orchestration:**
   - **Temporal** for local durable workflow orchestration, strictly isolated behind a Sovereign-defined `WorkflowRuntime` port.
   - **Authoritative Invariant:** Sovereign persists and owns the canonical `Execution Graph` in PostgreSQL. Temporal executes activities and manages timers/retries, but Temporal history is *never* the authoritative datastore for clinical intent, decisions, or graph state.

5. **AI Reasoning Boundary:**
   - Deterministic mock/fake AI provider (`providers/ai-fake`) for all development, evaluation, and CI pipelines.
   - All AI integrations strictly implement a Sovereign `AIReasoningProvider` interface.
   - Core domain packages are forbidden from importing any AI provider SDK, Gemini SDK, or cloud ML client.
   - AI generates typed candidate state only; authorized domain services execute validation and persistent mutation.

6. **Testing & Quality Assurance:**
   - **Vitest** for fast unit, integration, and automated architectural constraint testing.
   - **Playwright** reserved for downstream browser and end-to-end user interface testing (WO-012).
   - **Biome** alongside `tsc` for ultra-fast formatting, linting, and strict type verification.

7. **Local Infrastructure:**
   - **Docker Compose** providing local containerized PostgreSQL and Temporal server environments without external cloud dependencies or credentials.

8. **Package-Boundary Architecture & Dependency Rule:**
   The monorepo organizes code into clear tiers:
   ```
   packages/
   ├── domain/               # Core entities, invariants, value objects, domain errors (zero external deps)
   ├── contracts/            # Zod schemas, port interfaces, canonical DTOs
   ├── application/          # Use cases, mutation pipelines, verification coordination
   ├── persistence/          # PostgreSQL migrations, Kysely database access, repository adapters
   ├── workflow-runtime/     # WorkflowRuntime port interfaces and activity dispatch contracts
   └── audit/                # Append-only audit logger and tamper-evident event hashing

   providers/
   ├── ai-fake/              # Deterministic mock provider implementing AIReasoningProvider
   ├── ai-gemini/            # Provider adapter for Google Gemini (behind Sovereign port)
   ├── workflow-temporal/    # Temporal adapter implementing WorkflowRuntime port
   └── workflow-google/      # Google Cloud Workflows adapter (behind Sovereign port)

   adapters/
   ├── fhir/                 # FHIR R4 transport mapper (FHIR is transport, not domain state)
   ├── ehr/                  # Vendor EHR integration adapter
   ├── payer/                # Payer / ePA adapter
   ├── pharmacy/             # Specialty pharmacy adapter
   ├── infusion/             # Infusion center adapter
   └── communications/       # Secure messaging and patient outreach adapter
   ```
   **Strict One-Way Dependency Direction:**
   $$\text{providers} / \text{adapters} \longrightarrow \text{application} \longrightarrow \text{domain}$$
   **Forbidden Dependencies (enforced via architectural tests):**
   - `domain` $\longrightarrow$ AI Providers / Gemini
   - `domain` $\longrightarrow$ Google Cloud SDKs
   - `domain` $\longrightarrow$ Temporal SDK
   - `domain` $\longrightarrow$ EHR Vendor Schemas / SDKs
   - `providers/ai-*` $\longrightarrow$ Persistence Repositories (AI cannot mutate authoritative state)

9. **Secondary Languages (Python):**
   - Python may be introduced in downstream work orders exclusively for isolated clinical evaluation scripts, statistical analysis, or ML research (e.g., WO-016).
   - Python is strictly forbidden from implementing canonical domain models, mutation services, or authoritative state persistence without a separate approved ADR.

## Consequences

- All developers and CI runners operate deterministically without cloud credentials or cloud network connectivity.
- Domain contracts and business logic are 100% cloud-agnostic and vendor-agnostic.
- Changes to AI providers or workflow engines do not perturb domain entities or database schemas.
- Monorepo package boundaries require explicit dependency declarations and strict CI linting.

## Rejected Alternatives

- **Python as Primary Domain Stack:** Rejected because TypeScript provides compile-time end-to-end type safety shared across web apps, APIs, and domain contracts, and prevents probabilistic runtime typing errors in core safety logic.
- **ORM with Implicit State Mutation (e.g., Prisma/TypeORM):** Rejected in favor of Kysely to guarantee explicit SQL queries, strict transaction boundaries, and reproducible audit logging.
- **Temporal as Authoritative State Store:** Rejected because Temporal event history cannot serve as the clinical legal record or replace relational integrity, tenant scoping, and relational queries.
- **Direct LLM Tool-Calling Architecture:** Rejected as a direct violation of Sovereign Permanent Doctrine (AI may propose, but never directly execute or mutate).

## Verification

- Architectural boundary tests (`pnpm run test:arch`) verify that domain packages contain zero imports of AI SDKs, cloud SDKs, or external workflow libraries.
- Unit tests verify deterministic operation of `ai-fake` and local relational migrations under SQLite/PostgreSQL.
