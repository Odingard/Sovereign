# Sovereign Data Classification and Retention Schedule

## 1. Data Classification Tiers

| Classification | Definition | Examples | Storage Location | Encryption & Controls |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Restricted PHI** | Any data element containing 18 HIPAA identifiers or clinical facts linked to a real individual. | Patient MRN, patient name, DOB, clinical notes, diagnosis codes, lab values, prescriptions. | Authoritative PostgreSQL database (isolated tenant schema). | AES-256 with per-tenant CMEK; TLS 1.3 in-transit; field-level masking in UI; zero ambient logging. |
| **Tier 2: Clinical Audit Trails** | Immutable, tamper-evident records of clinical decisions, evidence provenance, and execution transactions. | Actor ID, role, exact transaction payload hash, decision state, evidence hashes, timestamp, authority grant. | Append-only audit table in PostgreSQL; long-term immutable object storage. | SHA-256 transaction hashing; write-once-read-many (WORM) retention; restricted administrative access. |
| **Tier 3: Operational Telemetry** | System health, performance metrics, request traces, and error codes devoid of patient identifiers. | Latency, HTTP status codes, service names, error code classes (e.g. `ERR_AUTH_FAILED`), memory metrics. | Standard logging / monitoring tools (e.g., Cloud Logging). | Automated payload scrubbing; string regex filters to block accidental PHI injection. |
| **Tier 4: Synthetic Development Data** | Invented, non-real test cases, patient personas, clinical scenarios, and evaluation benchmarks. | Patients with names like "Synthetic Patient 001", reserved MRNs (`SYN-*`), mock encounters. | `test-data/synthetic-only/`, local developer environments, CI test runners. | Declared with `synthetic: true` marker; permitted in local dev and CI. |

---

## 2. Minimum Necessary Collection and Use

1. **Inbound Ingestion Bounding:** Only data required for rheumatology therapy access (RA diagnostic criteria, prior therapies, lab contraindications, payer requirements) may be ingested from EHR or portal sources.
2. **AI Prompt Filtering:** AI reasoning endpoints receive strictly minimal necessary clinical facts with direct patient identifiers (name, MRN, phone, address) permanently redacted.
3. **UI Display Filtering:** Role-based views present only fields required for the specific user job (e.g., prior auth specialists see insurance/formulary fields; infusion coordinators see safety lab readiness).

---

## 3. Retention and Disposal Schedule

| Data Category | Statutory / Clinical Basis | Retention Period | Disposal / Archival Method |
| :--- | :--- | :--- | :--- |
| **Clinical State & Intent** | Medical record retention laws | 10 years from last encounter (or state legal minimum) | Immutable archive; cryptographic deletion of per-tenant keys upon contract termination. |
| **Clinical Audit Logs** | HIPAA Security Rule § 164.312(b) | Minimum 7 years | Immutable, append-only cold storage with tamper-evident cryptographic checksums. |
| **Operational Telemetry** | SOC 2 / Infrastructure diagnostics | 30 days | Automated rolling expiration and truncation. |
| **AI Inference Payloads** | Zero-data-retention policy | Ephemeral (in-memory processing only) | Purged immediately upon candidate generation. Zero provider retention. |
| **Synthetic Test Data** | Software development lifecycle | Maintained under version control | Deleted or updated via standard Git workflow. |

---

## 4. Provenance and History Preservation

1. **Append-Only History:** Authoritative objects never overwrite historical records. Corrections and clinical updates are recorded as new versioned entries referencing prior state.
2. **Supersession Model:** When clinical intent or execution graphs change, prior nodes are marked `SUPERSEDED` with explicit timestamps, actor attribution, and reason codes.
