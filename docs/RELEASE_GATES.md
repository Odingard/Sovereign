# Release Gates

| Gate | Required decision |
| --- | --- |
| G0 WO-000 | Cloud/security/privacy/PHI architecture GO; otherwise synthetic only |
| G1 Domain | Five canonical objects, invariants, migrations, tenant isolation proven |
| G2 Clinical | Safety case, intended use, synthetic evaluations, ambiguity handling approved |
| G3 Execution | Authority, verification, durable graph, replay/idempotency and adapters proven |
| G4 Experience | Clinician/operations/admin workflows usable without hiding responsibility |
| G5 Shadow | No-action shadow comparison meets approved safety/quality thresholds |
| G6 PHI/Pilot | Contracts, eligible services, IR/security/privacy/clinical approvals and monitoring ready |

Every gate records evidence, reviewers, findings, residual risk, and `GO`, `HOLD`, or `NO-GO`. Implementing agents cannot self-approve. Calendar pressure cannot override safety, isolation, or PHI gates.

