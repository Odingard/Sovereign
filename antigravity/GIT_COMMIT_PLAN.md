# Git Commit Plan

## Required initial commits

1. `chore: initialize Sovereign governed repository`
2. `docs: establish architecture constitution and ADRs`
3. `docs: add WO-000 through WO-017 build program`

The ZIP is an uncommitted source package. Initialize Git locally, assign files to the above commits without altering content, and report full SHAs. Do not push until repository owner configures the remote and CODEOWNERS identities.

## Branch strategy

- Protected `main`; no direct pushes.
- `wo/<number>-<short-name>` for work orders.
- `fix/<scope>` for bounded corrections; `docs/<scope>` for non-behavioral documentation.
- One WO/independently reviewable purpose per PR. No downstream stacking across a HOLD gate.

## PR requirements

Reference WO/criteria; describe domain/safety/security/privacy impact; list migrations/rollback; exact commands/results; evaluation artifacts; synthetic-only proof; docs/ADR changes; known risks; reviewer decisions. Required checks: format/lint/type/build (after stack selection), unit/integration/e2e/evals, tenant/security/safety, migrations, dependency/secret/SAST/IaC/container scans as applicable, SBOM/provenance.

Clinical domain changes require clinical-safety review. Tenancy/PHI/authorization/integration changes require security review. Execution Graph changes require workflow review. All changes require QA acceptance evidence and CODEOWNERS. Merge only after required humans approve and checks pass.

## CODEOWNERS setup ambiguity

The supplied team slugs express intended roles and require founder/repository-owner mapping to actual GitHub teams before branch protection. Do not weaken ownership merely to make validation green.

