# TB-01 — Internet → gateway

The only boundary reachable by an unauthenticated party. Everything else in this model
assumes an attacker already got past here.

## Assets
Session tokens, tenant identity, every API surface behind the edge.

## Controls
JWT verification pinned to RS256 with JWKS (`adapters/identity-oidc`); session
revocation checked before the identity is acted on; per-tenant rate limiting; security
headers on every response; 10 MB body limit; bare 401 on rejection.

## STRIDE

### Spoofing — forged or replayed token
`MITIGATED`. Algorithms pinned to `["RS256"]`, making `alg=none` and HMAC confusion
structurally impossible rather than unlikely. Audience and issuer checked. A token
whose lifetime exceeds 15 minutes is refused even with a valid signature — a
misconfigured IdP must not silently extend the blast radius of a theft. Adversarial
§10.4.

**DREAD 3.2** — D8 R1 E2 A4 D1.

### Tampering — altering a request in transit
`MITIGATED`. TLS 1.3 preferred, 1.2 minimum (S1-D10). HSTS with a two-year max-age and
preload.

**DREAD 2.4** — D7 R1 E1 A2 D1.

### Repudiation — denying a request was made
`MITIGATED`. Every 401 and every authorization denial is audited with a correlation id
(spec §7.3).

**DREAD 2.0** — D4 R2 E2 A1 D1.

### Information disclosure — learning why a token failed
`MITIGATED`. A rejected token gets a bare 401 carrying only `E_UNAUTHENTICATED`. The
reason goes to the log and the audit row. Distinguishing "expired" from "wrong
audience" from "bad signature" tells an attacker which guess was closer, and an
adversarial test asserts the body matches none of
`/signature|audience|issuer|expired|claim/i`.

**DREAD 2.8** — D3 R9 E4 A1 D2. Low damage, high reproducibility — exactly the kind of
leak that is easy to introduce and easy to overlook.

### Denial of service — flooding the edge
`OPEN`. Rate limiting is per-tenant and in-process, and it runs *after* authentication
— so it does not protect against unauthenticated flooding at all. That defence is Cloud
Armor and Cloud Run autoscaling, which do not exist yet.

**DREAD 4.6** — D4 R8 E8 A6 D8. No PHI exposure. Trivially discoverable and trivially
executed.

> **Action:** Cloud Armor in the WO-002A cloud block (S1-02/S1-03). Tracked there, not
> as a new gap.

Note the deliberate ordering this exposes: limiting before authentication would have to
key on IP, which throttles a whole clinic behind one NAT as though it were an attacker
while letting one tenant exhaust the pool from many addresses. The edge case is
accepted knowingly.

### Elevation of privilege — reaching an authenticated surface unauthenticated
`MITIGATED`. Every route except `/health/*` requires a verified token. Health exposes a
bounded enum and two timestamps, with no field capable of carrying a message — the
type enforces it rather than a reviewer.

**DREAD 2.6** — D8 R1 E1 A2 D1.

## Residual risk

| Risk | Score | Status |
|---|---|---|
| Unauthenticated volumetric DoS | 4.6 | Accepted pending Cloud Armor (cloud block) |
