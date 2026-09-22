# Sovereign Threat Model

STRIDE per trust boundary, with DREAD scoring. Expands the one-page
[THREAT_MODEL.md](../THREAT_MODEL.md) into the per-boundary analysis WO-002A AC-10
requires.

## Method

**STRIDE** per boundary: Spoofing, Tampering, Repudiation, Information disclosure,
Denial of service, Elevation of privilege. Every boundary gets all six, because "not
applicable" is usually a judgement made too early.

**DREAD** scoring, 1–10 per axis, mean taken. The scale is defined below so two people
score the same threat the same way — an unscaled DREAD number is a feeling with a
decimal point.

| Axis | 1–3 | 4–6 | 7–10 |
|---|---|---|---|
| **D**amage | Operational annoyance | One tenant's data exposed or unavailable | PHI disclosed, clinical decision corrupted, or all tenants affected |
| **R**eproducibility | Needs a rare race or physical access | Works sometimes, needs specific state | Works every time |
| **E**xploitability | Nation-state, or insider with production access | Skilled attacker with an account | Any authenticated user, or unauthenticated |
| **A**ffected users | One user | One tenant | All tenants |
| **D**iscoverability | Requires source access | Visible to a determined tester | Obvious from the API surface |

### Gate rules

- **≥ 7.0 blocks Gate 1.** No exceptions, no risk acceptance.
- **4.0–6.9** requires a written accepted-risk entry signed by the security reviewer.
- **< 4.0** is tracked and reviewed at each gate.

### Status vocabulary

| Status | Meaning |
|---|---|
| `MITIGATED` | A control exists, is implemented, and a test proves it |
| `PARTIAL` | A control exists but is not fully proven, or covers part of the threat |
| `OPEN` | No control yet; carries a gap-register reference |
| `ACCEPTED` | Residual risk knowingly accepted, with a signature |

A threat is only `MITIGATED` when a **test** proves it. A control that exists in code
but has no test is `PARTIAL`, because nothing stops the next refactor removing it.

## Trust boundaries

| | Boundary | Central risk |
|---|---|---|
| [TB-01](TB-01-internet-to-gateway.md) | Internet → gateway | Unauthenticated reach into the API |
| [TB-02](TB-02-gateway-to-services.md) | Gateway → services | A service trusting a context it should not |
| [TB-03](TB-03-service-to-database.md) | Service → database | A query escaping its tenant |
| [TB-04](TB-04-service-to-kms.md) | Service → KMS | Key material misuse or unavailability |
| [TB-05](TB-05-service-to-pubsub.md) | Service → Pub/Sub | Events crossing tenants in transit |
| [TB-06](TB-06-ci-to-cloud.md) | CI → cloud | The supply chain becoming the attack path |
| [TB-07](TB-07-idp-to-sovereign.md) | IdP → Sovereign | A vendor asserting authority it does not have |
| [TB-08](TB-08-operator-to-production.md) | Operator → production | The insider with legitimate access |
| [TB-09](TB-09-tenant-to-tenant.md) | Tenant → tenant | **The architecture's central bet** |

**TB-09 is the one to read first.** Sovereign is a pool-model multi-tenant system
(ADR-0011): tenants share compute and a database instance. Every other boundary has a
conventional answer. That one is the bet.

## Scope and honesty

Boundaries depending on infrastructure not yet built — TB-04 KMS, TB-05 Pub/Sub, and
parts of TB-06 and TB-08 — are analysed against the **designed** control and marked
`OPEN` or `PARTIAL`. They are not marked mitigated on the strength of a Terraform
module that has never been applied.

## Sign-off

Required by WO-002A AC-10 before Gate 1.

| Role | Name | Date | Signature |
|---|---|---|---|
| Security reviewer | Michael | — | *pending* |
| Architecture reviewer | Roger | — | *pending* |
| Founder | Andre Byrd | — | *pending* |

Neither reviewer has reviewed this document. See **G-44**: review for this period is
retrospective by Founder decision, and that is recorded rather than implied.
