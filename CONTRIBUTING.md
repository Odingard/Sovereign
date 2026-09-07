# Contributing

1. Read `AGENTS.md`, relevant ADRs, and the active work order.
2. Create a branch from protected `main`: `wo/<number>-<short-name>` or `fix/<scope>`.
3. State the work-order IDs and acceptance criteria in the PR.
4. Add implementation, negative tests, evaluation evidence, and documentation together.
5. Never use real PHI or credentials.
6. Obtain CODEOWNERS, clinical-safety, security, workflow, and QA review as applicable.
7. Squash only when history policy permits; never bypass failing gates.

PRs must include exact test/eval commands and results, migrations, rollback, threat/safety impact, screenshots using synthetic data, known limits, and a `GO/HOLD/NO-GO` recommendation. Reviewers—not the implementing agent—own final gate approval.

