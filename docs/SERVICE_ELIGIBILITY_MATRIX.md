# Sovereign Service Eligibility Matrix

## Policy Rule

**No service or feature is assumed to be safe for Protected Health Information (PHI) merely because the vendor is described generally as HIPAA-eligible.**

Every external service, cloud infrastructure component, and third-party API begins in status:

$$\textbf{RESEARCH / NOT APPROVED FOR PHI}$$

Promotion to **CONDITIONALLY APPROVED FOR PRODUCTION PHI** requires explicit, source-backed verification of:
1. Executed Business Associate Agreement (BAA) coverage;
2. Permitted specific API features and disabled prohibited features;
3. Guaranteed United States data residency and processing boundaries;
4. PHI-safe logging and telemetry behavior (no payload leakage in diagnostics);
5. Zero-data-retention (ZDR) policy and contractual exclusion from model training;
6. Vetted subprocessor chains and international data transfer restrictions;
7. Mandatory security and network configuration restrictions.

Until a service is formally approved by the Founder and Security/Privacy Reviewers, it remains restricted to **SYNTHETIC DATA ONLY** or **PROHIBITED**.

---

## Service Eligibility Ledger

| Category | Service / Feature | Current Evaluation Status | BAA Status | US Residency | Data Retention / Training | Permitted Environments | Mandatory Configuration & Restrictions |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Local Dev** | Local Fake AI Provider (`providers/ai-fake`) | **APPROVED FOR SYNTHETIC USE ONLY** | N/A (In-memory mock) | Local host | Zero retention | Local Dev, CI | Deterministic responses only; no external network egress permitted. |
| **Local Dev** | PostgreSQL 16 (Local Docker) | **APPROVED FOR SYNTHETIC USE ONLY** | N/A (Self-hosted local) | Local host | Local storage | Local Dev, CI | Synthetic fixtures only. Must run without production credentials. |
| **Local Dev** | Temporal Server (Local Docker) | **APPROVED FOR SYNTHETIC USE ONLY** | N/A (Self-hosted local) | Local host | Local storage | Local Dev, CI | Orchestration engine only; not the system of record. Ephemeral synthetic history. |
| **Cloud AI** | Google Vertex AI / Gemini Enterprise API | **RESEARCH / NOT APPROVED FOR PHI** | Under BAA evaluation | US-central1 / US-east4 only | Zero training on customer prompts; ZDR must be enforced | Staging (Synthetic Only) | Must use Enterprise Tier with customer VPC-SC. Consumer APIs strictly forbidden. |
| **Cloud AI** | Consumer Gemini / ChatGPT / Claude Web | **PROHIBITED** | No BAA | Global / Variable | Retains data for model improvement | None | **Strictly prohibited.** Never input clinical text, notes, or patient data. |
| **Cloud DB** | Google Cloud SQL for PostgreSQL | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google Workspace/GCP BAA | US multi-region / dual-region | Customer-managed | Target: Staging / Prod (Post-Gate) | Private IP only, CMEK enabled, SSL required, audit logging enabled, automated backups. |
| **Compute** | Google Cloud Run | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google GCP BAA | US regions only | Stateless compute | Target: Staging / Prod (Post-Gate) | VPC egress only, binary authorization, zero ambient secret exposure, non-root containers. |
| **Secrets** | Google Cloud Secret Manager | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google GCP BAA | US regions only | Encrypted at rest | Target: Staging / Prod (Post-Gate) | CMEK enabled, IAM condition-based access, access logging enabled. |
| **Messaging** | Google Cloud Pub/Sub | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google GCP BAA | US regions only | Retention <= 7 days | Target: Staging / Prod (Post-Gate) | Dead-letter queues configured, payload encryption, strictly internal VPC endpoints. |
| **Workflow** | Google Cloud Workflows | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google GCP BAA | US regions only | Execution history | Target: Staging / Prod (Post-Gate) | Transient orchestration only; payload masking enabled; not system of record. |
| **Workflow** | Temporal Cloud | **RESEARCH / NOT APPROVED FOR PHI** | Requires separate vendor BAA | US regions only | Workflow history retained | Target: Staging / Prod (Post-Gate) | Custom data converter (client-side encryption) mandatory before transmitting payloads. |
| **Healthcare** | Google Cloud Healthcare API (FHIR) | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google GCP BAA | US regions only | FHIR datastore | Target: Staging / Prod (Post-Gate) | Adapter mapping only. FHIR is transport, never the canonical clinical state. |
| **Logging** | Google Cloud Logging / Monitoring | **RESEARCH / NOT APPROVED FOR PHI** | Covered under Google GCP BAA | US regions only | 30-day retention | Target: Staging / Prod (Post-Gate) | Log redaction filters required; payload fields excluded from standard stdout/stderr logs. |

---

## Evaluation Workflow for New Services

1. **Vendor & Security Intake:** Submit vendor security questionnaire, SOC 2 Type II report, and ISO 27001 certificate.
2. **Legal & BAA Verification:** Confirm signed BAA covering the exact product and sub-features requested.
3. **Architecture Boundary Check:** Verify that integration complies with Sovereign ports-and-adapters architecture (vendor SDKs stay inside adapters).
4. **Configuration Review:** Create infrastructure-as-code (Terraform) module enforcing CMEK, VPC-SC, private IPs, and log exclusion.
5. **Human Gate Determination:** Security Reviewer and Founder sign off on promotion from `RESEARCH` to `CONDITIONALLY APPROVED`.
