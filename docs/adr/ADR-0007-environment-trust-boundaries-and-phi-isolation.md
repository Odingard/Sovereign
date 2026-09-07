# ADR-0007 — Environment Trust Boundaries and PHI Isolation

Status: Accepted

## Context

Sovereign processes highly sensitive protected health information (PHI) and clinical decisions. A failure in tenant isolation, data residency, subprocessor boundaries, or credential scoping poses critical clinical, legal, and privacy hazards. Sovereign requires a formal architecture governing environment separation, cryptographic boundaries, zero-retention model configurations, and strict pre-gate PHI prohibitions.

## Decision

We establish the following trust boundaries and PHI isolation rules:

1. **Environment Separation & Data Tiers:**
   - **Local Development (`local-dev`):** Strictly offline-capable. Operates exclusively on synthetic data. Zero real PHI, zero production credentials, zero cloud network egress requirements.
   - **Continuous Integration (`ci`):** Isolated automated environment running synthetic unit, integration, architectural, and security scans. Ephemeral containers; no cloud credentials.
   - **Staging / Validation (`staging`):** Dedicated single-tenant or isolated multi-tenant VPC for shadow-mode evaluations (WO-017). Operates on synthetic or fully authorized IRB/de-identified datasets.
   - **Production (`production`):** Dedicated, HIPAA-compliant, BAA-covered environment with customer-managed encryption keys (CMEK) and strict perimeter access controls.

2. **Pre-Gate Prohibition (`HOLD — NO REAL PHI`):**
   - Under Gate G0 (WO-000), no real PHI may enter the repository, development environment, AI prompts, test fixtures, application logs, telemetry, screenshots, issues, or local services.
   - Transitioning from synthetic data to PHI-capable environments requires an explicit, signed GO decision from the Founder, Clinical Safety Lead, and Security/Privacy Lead. Absence of approval is a permanent HOLD.

3. **Cryptographic Boundaries & Key Ownership:**
   - **At-Rest Encryption:** AES-256 with per-tenant envelope encryption. Tenant root keys are separated by tenant identity and never shared across tenant boundaries.
   - **In-Transit Encryption:** TLS 1.3 enforced for all internal and external communication with strict cipher suites. Cleartext HTTP is prohibited except inside local loopback during offline tests.
   - **Secrets Management:** Cloud secrets reside in dedicated Secret Manager instances with just-in-time (JIT) access and audit logging. Local dev uses `.env.example` templates with non-secret synthetic values.

4. **Zero-Data-Retention & Model Isolation:**
   - All AI inference requests must specify zero-data-retention (ZDR) endpoints where customer inputs and outputs are never stored by the provider or used to train foundation models.
   - Patient identifiers (MRN, SSN, direct demographics) are never passed to AI providers. Only minimal necessary clinical facts and de-identified case contexts are provided.
   - Model providers are treated as external untrusted subprocessors behind strict schema validation and safety filters.

5. **Telemetry & Log Isolation:**
   - Operational logs, metrics, and error traces are classified as non-PHI infrastructure data.
   - Application frameworks and HTTP handlers must enforce automatic payload scrubbing, redaction, and sanitization before logging.
   - Clinical audit trails (the clinical system of record) are stored separately from operational logs in an append-only, tamper-evident PostgreSQL table.

## Consequences

- Real patient data cannot be used to debug local development issues. All edge cases must be reproduced via synthetic generator scenarios.
- Adding any new cloud service or external API requires verifying BAA status, data residency, and zero-retention eligibility.
- Every external payload requires explicit redaction verification.

## Rejected Alternatives

- **De-identification as an Excuse for Local Real Data:** Rejected because true HIPAA Safe Harbor de-identification cannot guarantee re-identification protection in small cohorts or rare rheumatic disease presentations. Synthetic-only is the sole permitted standard.
- **Shared Master Key for All Tenants:** Rejected because cross-tenant isolation must be verifiable at the cryptographic storage layer.
- **Vendor-Hosted Model Memory / Assistant Threads:** Rejected because retaining conversation history with third-party LLM providers violates both the zero-retention requirement and ADR-0001 (Model is not system of record).

## Verification

- Automated CI secret scanning via Gitleaks (`.gitleaks.toml`).
- Dedicated repository-wide synthetic data compliance scanner (`scripts/verify-synthetic-data.ts`).
- Negative isolation tests ensuring cross-tenant queries fail closed.
