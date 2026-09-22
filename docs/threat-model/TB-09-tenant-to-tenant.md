# TB-09 — Tenant → tenant

**The architecture's central bet.**

Sovereign is a pool-model multi-tenant system (ADR-0011): tenants share compute and a
single PostgreSQL instance, separated by row-level security and per-tenant encryption
keys rather than by infrastructure. Every other boundary in this model has a
conventional answer. This one does not — it is the deliberate trade Sovereign makes to
be affordable at pilot scale, and the controls below are what make the trade
defensible rather than reckless.

If this boundary fails, one practice reads another practice's patients. There is no
partial version of that failure that is acceptable.

## Assets

Patient records, clinical facts, source artifacts, audit events, per-tenant encryption
keys, authority grants.

## Controls in force

| # | Control | Where |
|---|---|---|
| 1 | Tenant resolved from verified JWT claims only, never from request input | `adapters/identity-oidc`, spec §5.1 |
| 2 | Forced row-level security on every tenant table | migrations 002–008, ADR-0009 |
| 3 | Explicit `WHERE tenant_id = ?` in repositories — RLS is defence in depth, never sole | ADR-0009 |
| 4 | Cross-tenant reference returns 404, never 403 | `packages/kernel/capability-guard.ts` |
| 5 | Per-tenant DEK; tenant id authenticated as AAD so ciphertext is bound to its tenant | `packages/crypto/envelope.ts` |
| 6 | Rate limiting keyed by tenant | `apps/gateway/rate-limit.ts` |
| 7 | Adversarial suite §10.1, §10.2, §10.21 | `tests/adversarial` |

Control 5 is the one that matters most and is the least obvious. RLS is a database
control; if it is misconfigured, disabled, or bypassed by a migration error, rows leak.
Encryption bound to the tenant means a leaked row is still unreadable — the attacker
gets ciphertext they cannot open, because the tenant id is authenticated into the
ciphertext itself.

## STRIDE

### Spoofing — tenant A presents as tenant B

`MITIGATED`. Tenant identity comes from a signature-verified claim. A caller cannot
supply it in a body, query or header, and the gateway overwrites any context header a
client sends. Adversarial §10.2 proves it.

**DREAD 2.6** — D9 R1 E1 A1 D1. Catastrophic if it worked; it requires the IdP signing
key.

### Tampering — modifying another tenant's data

`MITIGATED`. RLS `WITH CHECK` refuses a write whose `tenant_id` differs from the
session tenant. Tested in `identity-schema.test.ts`.

**DREAD 3.4** — D9 R2 E2 A2 D2.

### Repudiation — denying an action taken against another tenant

`MITIGATED`. Every cross-tenant attempt is audited with `result='denied'`, and the
audit chain is hash-linked and append-only.

**DREAD 2.2** — D5 R1 E1 A2 D2.

### Information disclosure — reading another tenant's data

`MITIGATED`. The top risk in the system, carrying two independent layers: RLS, and
tenant-bound encryption behind it. Both are tested.

This row read `PARTIAL` until 2026-09-22 because of **G-43** — two RLS isolation tests
failed locally while passing in CI, and an isolation control whose behaviour differs
between environments is not proven. The root cause was a **test-harness defect**, not a
control failure: the admin and app connections each defaulted independently to
`localhost:5432`, so pointing the admin URL at another container left the app
connection reading a different database entirely. A tenant could not see its own rows
because they were not there. Both URLs are now derived from one. The full local suite
passes 492/492.

The tell was visible from the first run and is worth carrying forward: **both failures
were on the positive assertion**, while every fail-closed assertion passed. An
isolation breach shows up as seeing too MUCH, never too little.

**DREAD 4.6** — D10 R2 E2 A5 D8. Damage remains maximal. Reproducibility and
exploitability are low because two independent controls must both fail, and both are
now proven in the environment they are tested in. Discoverability stays high: any
multi-tenant API invites this test first.

### Denial of service — one tenant exhausting shared capacity

`PARTIAL`. Token-bucket rate limiting keyed by tenant, 50 rps / burst 200, with
per-tenant Pub/Sub ordering keys and Cloud SQL connection quotas designed. `PARTIAL`
because the limiter is **in-process**: with several gateway instances each enforces its
own bucket, so the effective limit is per-instance. Recorded in the source.

**DREAD 4.4** — D5 R7 E6 A3 D1. No PHI exposure; degrades availability for neighbours.

> **Action before GA:** a shared limiter (Redis or Cloud Armor). Not before Gate 1 —
> at pilot scale, per-instance limiting is adequate and the cloud dependency is not
> yet available.

### Elevation of privilege — acquiring authority in another tenant

`MITIGATED`. An `AuthorityGrant` is scoped to exactly one tenant and the evaluator
checks tenant match before anything else. The capability guard refuses cross-tenant
references *before* calling the evaluator, so a misconfigured grant cannot open a path.
Adversarial §10.1 asserts the evaluator is never reached.

**DREAD 3.0** — D9 R1 E2 A2 D1.

## Residual risk

| Risk | Score | Status |
|---|---|---|
| Cross-tenant read via a defect in both RLS and encryption | 4.6 | Accepted; G-43 closed 2026-09-22 |
| Noisy-neighbour degradation from per-instance limiting | 4.4 | Accepted for pilot; shared limiter before GA |

Both are in the 4.0–6.9 band and need the security reviewer's signature. Neither
blocks Gate 1 on score. The G-43 action does.

## What would change this assessment

- A single RLS-exempt table added without review. The exempt register
  (`config/rls-exempt.json`) now requires a written justification per entry and a test
  rejects any clinical table, which is what keeps this from happening quietly.
- A repository that drops its explicit `WHERE tenant_id` predicate and relies on RLS
  alone. That halves the defence and nothing currently detects it.

**Closed 2026-09-22.** `scripts/verify-tenant-predicates.ts` enforces it, wired into
`pnpm run verify`. A query against any of 32 tenant tables must carry an explicit
tenant predicate or be declared `@systemScope` in its doc comment; an undeclared
cross-tenant query fails the build. That converts the second layer of ADR-0009 from
convention into an enforced control, and it makes the `@systemScope` walkthrough spec
§13 S1-25 requires at Gate 1 a matter of grepping for a tag rather than reading every
repository.
