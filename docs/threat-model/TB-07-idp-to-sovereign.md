# TB-07 — IdP → Sovereign

The IdP holds **authentication only**. It never holds authority (ADR-0010). This
boundary exists to keep that true even if the IdP is wrong, compromised, or
misconfigured.

## Assets
Session establishment, actor identity, tenant claim.

## Controls
RS256 with JWKS; audience and issuer pinned; 15-minute access token cap enforced
independently of what the IdP asserts; roles and grants resolved from
`services/identity`, never from IdP claims; MFA claim required for privileged
capabilities.

## STRIDE

### Spoofing — a forged token
`MITIGATED`. Algorithms pinned to RS256; audience, issuer and signature all checked.
Adversarial §10.4.

**DREAD 3.2** — D9 R1 E2 A4 D1.

### Tampering — the IdP asserting a role Sovereign did not grant
`MITIGATED`, and this is the important one. A role claim selects capability
**defaults**; it grants nothing. Authority comes from an `AuthorityGrant` evaluated at
the moment of the action (ADR-0010, AGENTS.md doctrine 17). An IdP administrator who
adds a user to a group called "Sovereign Admins" creates no Sovereign admin — the SCIM
mapper grants nothing for an unmapped group, and there is a test.

**DREAD 3.8** — D9 R2 E3 A4 D2.

> Without this separation, whoever administers the customer's IdP would effectively
> administer Sovereign's clinical authority. That is the failure ADR-0010 exists to
> prevent, and it is worth stating plainly because it is invisible in a diagram.

### Repudiation
`MITIGATED`. Login success, failure and token rejection are all audited.

**DREAD 2.0** — D4 R2 E2 A1 D1.

### Information disclosure — an over-long token widening a theft
`MITIGATED`. A token whose lifetime exceeds 15 minutes is refused **even with a valid
signature**. The IdP is misconfigured in that case, and honouring a 24-hour access
token would quietly extend the blast radius of a stolen one.

**DREAD 3.4** — D7 R3 E3 A3 D1.

### Denial of service — IdP outage
`PARTIAL`. Designed degraded mode: existing sessions continue to expiry, new logins are
blocked, and a truthful banner explains why. The drill is cloud-blocked.

**DREAD 4.0** — D5 R5 E2 A7 D1. Availability only.

### Elevation of privilege — IdP compromise granting clinical authority
`MITIGATED`. An IdP compromise yields authentication, not authority. Grants live in
Sovereign, the evaluator checks them at action time, and Class C and D remain
unreachable without a grant.

**DREAD 4.2** — D8 R2 E2 A7 D2. Serious, and bounded by design.

## Residual risk
| Risk | Score | Status |
|---|---|---|
| IdP outage blocks new logins | 4.0 | Accepted; degraded mode designed, drill cloud-blocked |
