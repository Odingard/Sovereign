# TB-03 — Service → database

## Assets
Every tenant table, the audit chain, wrapped key material.

## Controls
`withTenant` as the only entry point for tenant data; forced RLS; `sovereign_app` is
`NOBYPASSRLS` with no DDL and no table ownership; audit chain append-only at three
layers; explicit `WHERE tenant_id` predicates alongside RLS (ADR-0009).

## STRIDE

### Spoofing — connecting as a privileged role
`PARTIAL`. Runtime uses `sovereign_app`; `sovereign_admin` runs migrations only and is
never available to runtime code. `PARTIAL` because credential separation currently
rests on configuration. Cloud SQL IAM authentication and Secret Manager close it, and
both are in the cloud block.

**DREAD 4.8** — D10 R2 E3 A8 D1.

### Tampering — rewriting history
`MITIGATED`. `clinical_audit_event` is append-only at three layers: grants, explicit
revokes, and a trigger that raises for the table owner and a superuser too. A
compromised admin session must `DROP` the trigger, which is itself a DDL event in the
Cloud SQL audit log. `clinical_fact` is insert-only by the same pattern, permitting
exactly one mutation — marking a row superseded by its replacement, with nothing about
the fact itself allowed to change.

**DREAD 3.8** — D10 R1 E2 A5 D1.

### Repudiation — deleting the evidence
`MITIGATED`. Legal holds and erasure records cannot be deleted at all. Deleting the
evidence that a hold existed is precisely the failure those tables exist to prevent.

**DREAD 3.0** — D8 R1 E2 A3 D1.

### Information disclosure — a query escaping its tenant
`PARTIAL`. Same finding as TB-09: RLS plus tenant-bound encryption, and **G-43** open.
See TB-09 for the full analysis; it is not repeated here.

**DREAD 5.8** — as TB-09.

### Denial of service — connection pool exhaustion
`PARTIAL`. Per-service pool quotas are designed; unproven until Cloud SQL exists. A
`pool-exhaustion.js` k6 scenario is specified for S1-24 and asserts the system fails
*closed* with 503 rather than serving a wrong-tenant row under pressure.

**DREAD 4.0** — D5 R6 E5 A4 D2.

### Elevation of privilege — a runtime role gaining DDL
`MITIGATED`. `sovereign_app` holds no ownership and no DDL, and an adversarial test
asserts it cannot disable or bypass RLS.

**DREAD 3.4** — D9 R1 E2 A4 D1.

## Residual risk
| Risk | Score | Status |
|---|---|---|
| Cross-tenant read (shared with TB-09) | 5.8 | Pending G-43 |
| Credential separation by configuration | 4.8 | Pending Cloud SQL IAM auth (cloud block) |
