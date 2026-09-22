# Adversarial tenant-isolation and authorization suite

Spec §10. Twenty-four attacks against the platform. **Each one is a build blocker.**

These are not unit tests of components. Each test takes the position of an attacker —
a hostile tenant, a stolen token, a compromised database session, an AI principal
reaching beyond its authority — and asserts the attack fails. A component test proves
a function behaves; these prove the *system* refuses.

## Coverage, stated exactly

| Attack | State | Where |
|---|---|---|
| 1, 2, 3, 4, 6, 8, 10, 13, 15, 19, 20, 21, 22, 24 | runs | `isolation.test.ts` |
| 5, 9, 11, 12, 16, 17, 18 | runs | `audit-and-data.test.ts` |
| 7 | runs | `isolation.test.ts` — site scoping, added with the control it tests (G-56) |
| 16 | runs | `audit-and-data.test.ts` |
| 14 (egress allowlist), 23 (ring rollback) | skipped, reason attached | blocked on the WO-002A cloud block |

**22 of 24 run in full. 2 are skipped with a stated reason, both blocked on the cloud block. None are absent, and none are partial.**

Three attacks could not be written when this table was first drawn up, because the
controls they attack did not exist: site scoping (G-56), break-glass (G-57) and the
kill-switch change API (G-58). All three controls were built rather than the tests
waved through, which is the only honest way to close a row like that.

A suite that silently contained 15 tests when the spec calls for 24 read as complete
for two work orders (G-59). This table exists so it reads as what it is.

## The rule these tests exist to defend

> A denial is a 404, not a 403, across tenants. A 403 confirms the object exists.

That single asymmetry is why several of these tests assert on a status code rather
than on behaviour. Getting it wrong turns the API into a cross-tenant enumeration
oracle, and nothing else in the isolation story survives that.

## A second rule, learned the hard way

> An isolation breach shows up as seeing too MUCH, never too little.

G-52: a broken test harness read as a possible breach for two work orders. Both of its
failures were on the *positive* assertion — a tenant could not see its own rows — while
every fail-closed assertion passed. That asymmetry is what distinguishes a broken
harness from a broken control. Check it first.

## A third rule, learned this week

> A test one layer below the defect cannot see it.

G-60: every authorization refusal left the gateway as `500 E_INTERNAL`, because the
error handler read `statusCode` and `SovereignError` carries `httpStatus`. That
collapsed 403 and 404 into one status — erasing the asymmetry above, the one thing
this suite exists to defend. The §10.1 test passed the whole time, because it calls
`requireCapability` directly: it proved the guard, not the wire.

Where the spec names a boundary — "through the HTTP edge", "`GET /v1/**`" — the test
should cross that boundary. §10.24 now does. §10.1 does not yet, and G-62 says so
rather than leaving it to be discovered the same way.

## Running

```
pnpm run test:adversarial              # needs a local Postgres for the DB-backed tests
```

`audit-and-data.test.ts` connects as **two** roles. `sovereign_app` is the role a
service actually uses, and the one an attacker reaches through a compromised service;
`sovereign_dev` owns the schema and is used only to set up the state each attack runs
against. The app-role URL is derived from the admin URL rather than defaulted
separately — see G-43, where two independently defaulted URLs pointed at two different
databases and produced an isolation failure that looked like a breach and was not.
