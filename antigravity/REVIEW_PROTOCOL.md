# Review Protocol

## Review order

1. Sovereign architect: architecture, domain ownership, adapters, ADR compliance.
2. Clinical safety reviewer: patient/evidence/intent/authority/execution/uncertainty/safe failure.
3. Security reviewer: tenancy/patient isolation, PHI, secrets, IAM, residency, integrations, CI/CD.
4. Workflow reviewer: durability, retry, duplicate prevention, cancellation/supersession, terminal state.
5. QA evaluator: acceptance traceability, regression/evaluation, completion evidence.
6. Named human gate owners: final `GO/HOLD/NO-GO`.

## Review packet

Active WO and dependency evidence; diff/exact commit; ADRs; data/threat/safety impact; migrations/rollback; API/domain/state changes; automated commands/results; evaluation report; synthetic screenshots; runbooks; unresolved risks; acceptance matrix.

## Blocking conditions

Real PHI before gate; wrong tenant/patient; AI direct mutation/execution; unsupported clinical truth; ambiguous intent made executable; missing/revoked authority; false completion; duplicate side effect; audit/PHI leakage; unresolved critical/high safety/security finding; missing acceptance evidence.

Agent approval is advisory. Human reviewers own clinical, privacy, security, and founder decisions. Revisions require targeted retest and reviewer closure; do not mark a finding resolved from explanation alone.

