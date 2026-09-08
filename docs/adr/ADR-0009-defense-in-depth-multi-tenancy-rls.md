# ADR-0009: Defense-in-Depth Multi-Tenancy: PostgreSQL Row Level Security (RLS) and Mandatory Repository Scoping

## Status
ACCEPTED FOR V0.1 — DEFENSE-IN-DEPTH ONLY, NOT SOLE AUTHORIZATION MECHANISM

## Date
2026-09-08

## Context
Sovereign operates in high-consequence clinical workflows across multiple independent healthcare organizations (tenants). Cross-tenant data leakage or confusion would violate patient safety, HIPAA, and core architectural doctrine.

In WO-000 and WO-001, composite primary keys `(tenant_id, id)` and mandatory application-layer filtering were established as foundational controls. However, relying solely on developers remembering to include `WHERE tenant_id = ?` in every ad-hoc query leaves risk of human error or runaway queries.

Conversely, treating PostgreSQL Row Level Security (RLS) as the sole authorization engine would violate the permanent doctrine that database mechanisms are not a substitute for domain-driven clinical authorization (such as clinician authority, patient matching, and action classes).

## Decision
1. **Adopt PostgreSQL Tenant-Level RLS as Defense-in-Depth for V0.1.**
   Every tenant-scoped table is protected by `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
2. **Dual-Role Database Architecture:**
   - `sovereign_admin` (Migration & DDL Role): Owns all tables, runs schema migrations, and holds `BYPASSRLS`. Inaccessible to runtime application code.
   - `sovereign_app` (Application Runtime Connection Pool Role): Has `NOBYPASSRLS`, does not own tables, and is strictly bound by `FORCE ROW LEVEL SECURITY`.
3. **Transaction-Local Parameterized Tenant Context:**
   The application connection pool sets tenant context via safe parameterized queries:
   `SELECT set_config('app.current_tenant', $1, true);`
   The third parameter (`is_local = true`) ensures PostgreSQL automatically clears the setting upon `COMMIT` or `ROLLBACK`.
4. **Fail Closed on Missing Context:**
   The policy evaluates `USING (tenant_id = NULLIF(current_setting('app.current_tenant', true), '')::text)`. If `app.current_tenant` is unset, queries return zero rows and mutations fail.
5. **Append-Only Audit Privileges:**
   `sovereign_app` is granted `SELECT, INSERT` only on `authorization_audit_log`. `UPDATE`, `DELETE`, and `TRUNCATE` are withheld.
6. **Mandatory Repository Scoping Remains In Force:**
   Repositories must continue to include explicit `WHERE tenant_id = ? AND patient_id = ?` predicates. RLS provides secondary defense, never the sole control.
7. **Patient Authorization Remains in Application Domain:**
   Patient-level clinical access control is evaluated by the Sovereign domain authorization engine, not by database RLS alone.

## Consequences
- **Positive:** Kernel-level database isolation prevents accidental cross-tenant data leakage even if an application query omits a tenant predicate.
- **Positive:** Append-only audit history cannot be tampered with by the runtime application role.
- **Negative:** Connection pool checkout requires executing `set_config` per transaction.
- **Negative:** Automated schema tests must verify that all newly created tenant tables enable RLS.
