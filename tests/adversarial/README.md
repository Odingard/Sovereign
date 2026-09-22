# Adversarial tenant-isolation and authorization suite

Spec §10. Twenty-four attacks against the platform. **Each one is a build blocker.**

These are not unit tests of components. Each test takes the position of an attacker —
a hostile tenant, a stolen token, a compromised database session, an AI principal
reaching beyond its authority — and asserts the attack fails. A component test proves
a function behaves; these prove the *system* refuses.

## Coverage, stated exactly

| Attack | State | Where |
|---|---|---|
| 1, 2, 3, 4, 6, 8, 10, 13, 19, 20, 21, 22, 24 | runs | `isolation.test.ts` |
| 5, 9, 11, 12, 17, 18 | runs | `audit-and-data.test.ts` |
| 7 | runs | `isolation.test.ts` — site scoping, added with the control it tests (G-56) |
| 16 | runs in part | `audit-and-data.test.ts` — see below |
| 14 (egress allowlist), 23 (ring rollback) | skipped, reason attached | blocked on the WO-002A cloud block |
| 15 (break-glass) | **absent — the control does not exist yet** | G-57 |

**21 of 24 run. 2 are skipped with a stated reason. 1 is absent.**

That last row is the one worth reading twice. Test 15 is not missing because nobody
got to it; it is missing because there is nothing yet to attack:

- **§10.15 break-glass.** Emergency PHI access is specified as a time-boxed grant with
  dual approval (§6.3), and `support_readonly` correctly holds no capabilities. The
  grant path itself is unbuilt, so there is no "with grant → allowed, reason recorded,
  alert fires" to assert (G-57).
- **§10.16 kill switch.** The half that exists is tested: a disabled capability refuses
  rather than returning an empty result, the registry fails closed when unreadable, and
  a switch records who changed it and under which approval. The other half — "toggle in
  prod without approval → 409" — needs the identity service's switch API, which is not
  built (G-58).

A suite that silently contained 20 tests when the spec calls for 24 would read as
complete. This table exists so it reads as what it is.

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
