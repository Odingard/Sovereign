# Data Residency & Sovereignty Matrix

WO-002A AC-10. Every store that holds or could hold Sovereign data, where it lives,
who processes it, and under what agreement.

**All PHI resides in `us-central1`. There are no cross-border transfers and no
non-US subprocessors.** The exceptions below are the honest ones — cases where the
statement needs a qualifier — and they are listed rather than omitted.

## Status of this document

Written against the **designed** infrastructure. No GCP project exists yet; nothing in
the Google Cloud column is deployed. Rows are marked accordingly, because a residency
matrix describing infrastructure that has never been created is a plan, not evidence.

## Matrix

| Data category | Service | Region | Replication | Encryption | Subprocessor | BAA | Retention | Cross-border | Deployed |
|---|---|---|---|---|---|---|---|---|---|
| Clinical state, evidence, intent | Cloud SQL PostgreSQL 16 | `us-central1` | Regional HA (staging, prod) | CMEK `db-kek` + per-tenant DEK on PHI columns | Google | **Required, not executed** | 10 y (`legal_clinical`) | None | ✖ |
| Cloud SQL **backups** | Cloud SQL | `us-central1` | — | CMEK | Google | Required | 35 d prod | None | ✖ |
| Audit chain | Cloud SQL PostgreSQL 16 | `us-central1` | Regional HA | CMEK | Google | Required | 7 y (`audit`) | None | ✖ |
| Audit anchors | Cloud Storage | `us-central1` | — | CMEK, retention-locked 7 y | Google | Required | 7 y | None | ✖ |
| Source artifacts | Cloud Storage | `us-central1` | — | CMEK + client-side per-tenant encryption | Google | Required | 10 y | None | ✖ |
| Exports | Cloud Storage | `us-central1` | — | CMEK | Google | Required | 7 d lifecycle | None | ✖ |
| Key material (KEK) | Cloud KMS / HSM in prod | `us-central1` | — | Key material never leaves the HSM | Google | Required | Rotation 90 d | None | ✖ |
| Wrapped tenant DEKs | Cloud SQL (`tenant_key`) | `us-central1` | Regional HA | Wrapped under KEK; RLS-isolated per tenant | Google | Required | With tenant | None | ✖ |
| Domain, audit, metering events | Pub/Sub | `us-central1` | — | CMEK | Google | Required | ≤ 7 d | None | ✖ |
| Secrets | Secret Manager | `us-central1` (user-managed replication) | Pinned single region | CMEK | Google | Required | Rotation 90 d | None | ✖ |
| Container images | Artifact Registry | `us-central1` | — | CMEK | Google | Required | — | None | ✖ |
| Authentication records | Cloud Identity Platform | US | — | Google-managed | Google | Required | Auth events only, no clinical data | None | ✖ |
| Operational logs, metrics, traces | Cloud Logging / Monitoring / Trace | `us-central1` (`_Default`) | — | Google-managed | Google | Required | 30 d (`operational`) | **See exception 2** | ✖ |
| Source code, CI logs, issues | GitHub | Global | Global | GitHub-managed | GitHub | **None — holds no PHI** | — | **See exception 1** | ✔ |
| Terraform state | Cloud Storage | `us-central1` | Versioned | CMEK | Google | Required | — | None | ✖ |
| Status page | Better Stack | Global | Global | Vendor-managed | Better Stack | None — no PHI, no tenant names | — | **See exception 3** | ✖ |
| Build provenance | Sigstore / Rekor | Global, **public** | Public | Public transparency log | Sigstore | None | Permanent | **See exception 4** | ✖ |
| SIEM export destination | Tenant-controlled | **Tenant's choice** | — | HMAC-signed in transit; TLS | The tenant's own provider | **Tenant's own** | Tenant's own | **See exception 5** | ✔ |
| Local development | Docker (Postgres, Keycloak, Temporal) | Developer machine | — | None | None | N/A — synthetic only | Ephemeral | None | ✔ |

## Exceptions, stated rather than buried

These are the places where "all data in `us-central1`, no cross-border transfer" needs
a qualifier. A matrix that omitted them would be easier to read and less true.

**1. GitHub is global and holds no PHI.** Source, CI logs and issues are replicated
globally by GitHub with no BAA. That is acceptable only because no PHI, no real
identifier and no credential may enter the repository — enforced by `gitleaks` and
`scripts/verify-synthetic-data.ts` on every commit, both of which have caught real
instances during development. **The repository is also public**, so this is not merely
a residency question: anything committed is world-readable, permanently.

**2. Cloud Logging's `_Required` bucket is not region-configurable.** The `_Default`
bucket is pinned to `us-central1`; `_Required` — which holds admin activity and system
events — is not. This is acceptable because ADR-0007 §5 classifies operational logs as
non-PHI, and `packages/telemetry` enforces that with a deny-by-default field allowlist
rather than asserting it. If that allowlist were ever weakened, this row would become a
cross-border PHI exception rather than an administrative one.

**3. The status page is a third-party global service** holding no PHI and no tenant
names — only component names and up/down state. It is deliberately external to the VPC
so it survives the outage it reports.

**4. Sigstore's transparency log is public and permanent.** Keyless signing publishes
the repository identity and commit SHA to Rekor, where they cannot be removed. No PHI,
but it is a permanent public disclosure of build metadata, and it is a **security
decision pending Michael's sign-off** (execution plan Q9). The repository already being
public makes the marginal disclosure small.

**5. SIEM export sends data to a destination the tenant chooses**, which may be outside
`us-central1` and outside the US. Sovereign cannot constrain it. Three things bound the
risk: PHI is excluded by construction unless the tenant enables `include_phi` under
dual control; even then only identifiers cross, never clinical content, reason text or
state; and the destination is the tenant's own system under their own agreements. **A
tenant enabling `include_phi` to a non-US endpoint is making a residency decision about
their own data**, and the dual-control requirement is what makes that a decision rather
than an accident.

## Subprocessors

| Subprocessor | Role | PHI? | BAA | Status |
|---|---|---|---|---|
| Google Cloud | Infrastructure, database, storage, keys, identity | Yes | **Required before any PHI — not executed** | Bootstrap B-1 |
| GitHub | Source control and CI | No | Not required | Active |
| Better Stack | Status page | No | Not required | Not provisioned |
| Sigstore | Build transparency | No | Not required | Pending Q9 |
| Tenant's SIEM provider | Audit streaming | Only under tenant dual control | Tenant's own | Per tenant |

**The GCP BAA is the gate on everything in this table.** G0-B remains HOLD, and no real
PHI may enter any environment until it is executed and the eligibility matrix promotes
the relevant services (`docs/SERVICE_ELIGIBILITY_MATRIX.md`).

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Security reviewer | Michael | — | *pending* |
| Architecture reviewer | Roger | — | *pending* |
| Founder | Andre Byrd | — | *pending* |

Neither reviewer has reviewed this document (**G-44**).
