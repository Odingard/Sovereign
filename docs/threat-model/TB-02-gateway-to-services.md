# TB-02 — Gateway → services

The internal hop. A service must not trust a context simply because it arrived on the
internal network — the flat-network assumption is how one compromised workload becomes
all of them.

## Assets
Request context, tenant identity, capability decisions.

## Controls
HMAC-signed `X-Sovereign-Context`, 60-second validity, constant-time comparison, **plus**
a bound service identity (Google-signed ID token and mTLS ingress, S1-D17). Services
reject a request presenting only one.

## STRIDE

### Spoofing — forging an internal context
`MITIGATED`. HMAC-SHA256 with a per-environment secret, verified in constant time. A
context signed with any other key is refused. Adversarial §10.3.

**DREAD 3.4** — D9 R1 E2 A3 D2.

### Tampering — editing a context in flight
`MITIGATED`. The signature covers the whole payload including the timestamp. A tampered
tenant id fails verification.

**DREAD 3.2** — D9 R1 E2 A2 D2.

### Repudiation
`MITIGATED`. Correlation and causation ids propagate; every decision is audited.

**DREAD 1.8** — D4 R1 E2 A1 D1.

### Information disclosure — capturing and replaying a context
`MITIGATED`. 60-second validity, and a context minted in the future is refused as well
as an expired one — a future timestamp is either a broken clock or a forgery, and both
fail closed.

**DREAD 3.0** — D7 R3 E2 A2 D1.

### Denial of service
`PARTIAL`. Internal ingress is `INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER` by design, so
only the gateway can reach a service. Unproven until the cloud block applies it.

**DREAD 3.2** — D4 R4 E3 A4 D1.

### Elevation of privilege — a service accepting a context alone
`MITIGATED` **by type**. `hasBoundServiceIdentity` is a *required* parameter of
`verifyContext`, not an option with a default. A caller who forgets it gets a compile
error rather than an open door. Adversarial §10.20.

**DREAD 3.6** — D9 R2 E3 A3 D1.

> This is the clearest example in the model of a control that could have been a
> convention and was made structural instead. A boolean with a safe default would have
> looked identical in review and failed silently the first time someone omitted it.

## Residual risk
None above 4.0. TB-02 becomes fully proven when internal ingress is applied in the
cloud block.
