# Adversarial tenant-isolation and authorization suite

Spec §10. Twenty-four attacks against the platform. **Each one is a build blocker.**

These are not unit tests of components. Each test takes the position of an attacker —
a hostile tenant, a stolen token, a compromised database session, an AI principal
reaching beyond its authority — and asserts the attack fails. A component test proves
a function behaves; these prove the *system* refuses.

## What runs where

| | Tests | Where |
|---|---|---|
| Local / CI | 22 of 24 | `pnpm run test:adversarial` |
| Requires a deployed cloud environment | 14 (egress allowlist), 23 (ring rollback) | blocked on WO-002A cloud block |

Tests 14 and 23 are present and explicitly skipped with the reason attached, rather
than omitted. A suite that silently contains 22 tests when the spec calls for 24
reads as complete; one that skips two with a stated reason reads as what it is.

## The rule these tests exist to defend

> A denial is a 404, not a 403, across tenants. A 403 confirms the object exists.

That single asymmetry is why several of these tests assert on a status code rather
than on behaviour. Getting it wrong turns the API into a cross-tenant enumeration
oracle, and nothing else in the isolation story survives that.

## Running

```
pnpm run test:adversarial              # needs a local Postgres for the DB-backed tests
```

Tests that need a database skip cleanly when `SOVEREIGN_DATABASE_URL` is unreachable,
so the suite is runnable without Docker — but a skipped isolation test proves nothing,
and CI runs them with Postgres attached.
