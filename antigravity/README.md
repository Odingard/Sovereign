# Google Antigravity Operating Package

Start with `MASTER_STARTUP_PROMPT.md`. Antigravity must validate this repository and plan WO-000 only. It must not implement the whole product, start WO-001, use real PHI, choose clinical meaning, grant itself authority, or call external healthcare systems.

Files:

- `MASTER_STARTUP_PROMPT.md` — authoritative startup instruction.
- `REPO_BOOTSTRAP_TASK.md` — bounded repository validation and architecture-plan deliverable.
- `EXECUTION_SEQUENCE.md` — gated WO order.
- `REVIEW_PROTOCOL.md` — required independent reviewers and evidence.
- `GIT_COMMIT_PLAN.md` — bootstrap commits, branches, PRs, and merge rules.

Repository-scoped agents in `.agents/agents/` are reviewers, not clinical authorities. A reviewer agent may recommend HOLD; only designated humans may approve clinical/PHI gates.

