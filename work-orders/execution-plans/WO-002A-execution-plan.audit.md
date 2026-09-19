# WO-002A Execution Plan — Independent Audit

Audited artifact: `work-orders/execution-plans/WO-002A-execution-plan.md` (frozen as written at HEAD `1b93aae`; stale items noted, not edited)
Auditor: Claude (chat session), independent of the plan's author (Claude Code, IDE session)
Approver of record: Andre Byrd (Owner). Security items routed to Michael; architecture items to Roger.

## 1. Structural compliance with the execution-plan prompt

| Required section | Present | Quality |
| --- | --- | --- |
| 1 Scope confirmation + AC→artifact map | Yes | All 12 ACs mapped to artifact, ticket, evidence |
| 2 Repository validation | Yes | Commands, exit codes, failures listed not fixed; found F5/F6 independently |
| 3 Terraform module design | Yes | 10 modules, inputs/outputs/resources/APIs, 36 policy rules mapped to invariants |
| 4 Founder-only bootstrap | Yes | 12 steps with commands; correctly separates legal/org-level acts from Terraform |
| 5 Pipeline design | Yes | Concrete diffs by line; rings; rollback; required checks; branch protection |
| 6 Policy-as-code + negative tests | Yes | Two layers; inverted-exit CI job; 13 fixtures |
| 7 Threat model + residency matrix | Yes | 9 boundaries, DREAD scale defined, two real residency exceptions surfaced |
| 8 Load/chaos/DR/status/on-call/PIR | Yes | Assumed load stated and flagged; RTO/RPO measured, not asserted |
| 9 Eligibility matrix updates | Yes | 11 updated, 8 new; Rekor correctly escalated |
| 10 Ticket sequence | Yes | One PR per ticket; critical path; out-of-WO tickets named |
| 11 Cost estimate | Yes | Assumptions stated; every env over threshold flagged; declined to guess IdP pricing |
| 12 Risks / open questions | Yes | 8 findings, 12 questions, decision owners assigned, no clinical ambiguity claimed |
| 13 Evidence plan | Yes | Per-AC artifact, location, signer; provisional-items section |
| Ends with request for Founder GO, S1-01 only | Yes | — |

Result: 13/13 sections present and substantive. No invented facts found; every repository claim spot-checked cites a real path and line.

## 2. Acceptance-criteria coverage

| AC | Covered | Auditor note |
| --- | --- | --- |
| 01 | Yes | — |
| 02 | Yes | Test should also assert at folder scope if Q2 resolves to folder |
| 03 | Yes | Hello service as canary is sound |
| 04 | Yes | — |
| 05 | Yes | Strongest section of the plan |
| 06 | Yes | Image-level SBOM/sign added — correct, repo-level alone would not satisfy "tagged build" |
| 07 | **Partial** | Requires an ephemeral PR preview environment (`deploy-preview.yml`). The plan names it but does not design it: no env matrix row, no project (dev? separate?), no teardown, no cost line. See A-2 |
| 08 | Yes | Fault-injection env var policy-blocked outside dev (NEW-29) — good |
| 09 | Yes | B-12 correctly identifies CODEOWNERS teams as the blocker |
| 10 | Yes | — |
| 11 | Yes | One-person on-call honestly named as Gate 4 risk |
| 12 | Yes | — |

## 3. Auditor findings (additions to the plan's F1–F8)

- **A-1 — Skipped required checks count as passing on GitHub.** §5.2 keeps `needs: [sast, sca, iac]` on `sbom-provenance` and says "make the skip visible". GitHub treats a *skipped* required check as satisfied for branch protection. The job must run with `if: always()` and explicitly fail when any dependency failed, or it is a third gate that cannot fail. Fold into S1-20.
- **A-2 — PR preview environment is undesigned.** AC-002A-07 depends on it. Decide: preview revisions in `sovereign-dev` (tagged Cloud Run revisions, torn down on PR close) vs. a fourth project. Recommend tagged revisions in dev, TTL 24 h, synthetic data only; add to the env matrix and §11 cost. Fold into S1-20/S1-21.
- **A-3 — `required_signatures` is not a field of the branch-protection PUT body** (§5.7). It is a separate endpoint (`PUT .../protection/required_signatures`). Evidence step should call both. Minor.
- **A-4 — Ring holds as `sleep` in GitHub Actions** (§5.4) burn paid minutes and are fragile across runner restarts. Recommend evaluating Google Cloud Deploy (native Cloud Run canary strategy with automated rollback, no runner time) before committing to sleep-based rings. Architecture decision for Roger; not a blocker for S1-01.
- **A-5 — Plan §2.4 and §12 Q12 are stale.** PR #4 merged as `2fb3dbc` after F1 and F4 were fixed on the branch (rego rewritten to `rego.v1` with 5 unit tests; Trivy pinned to a real SHA; all actions SHA-pinned; SCA advisories remediated). F2 and F3 remain open exactly as the plan states. The plan is left frozen; this audit is the correction of record.
- **A-6 — F5 was recorded in the gap register as G-33 before this plan was written**; independent convergence confirms it is real. Consistent with the plan.

No section was found to guess at a clinical or security decision. No scope drift into WO-002B/C.

## 4. Decisions requested of the Founder — auditor recommendations

- **Q1 (lint/typecheck sequencing):** the plan recommends (b) reporting-only first. Auditor recommends a narrower **(c)**: a dedicated remediation PR (PR-A2, ~1 day: 25 TS errors confined to `tests/`, 5 Biome errors resolved with scoped `biome-ignore` on Kysely migration signatures) landed *between* PR-A and PR-B, with both checks required from PR-A2 onward. Rationale: a reporting-only check on `main` for weeks is the same "gate that cannot fail" pattern the plan itself condemns in §6.4; the fix is cheap and G-33 already commits to "green and required before any infra PR".
- **Q12:** resolved by merge; acknowledge and move on.
- **Q11 (provisional items):** WO-002A may reach GO with a *Provisional items* section in its gate record; **plan Gate 1** may not be signed until WO-002B/C exercise those items. This keeps WO-002A honest without blocking it on work orders it does not own.
- **Q2 (org-policy scope) → Michael:** auditor recommends folder scope (B-9), with Terraform additionally asserting the constraints at project level (NEW-1) so drift is visible.
- **Q9 (Rekor public log) → Michael:** auditor recommends accepting keyless signing; the disclosure is repo identity and commit SHAs, already public-equivalent for a GitHub repo, and KMS-keyed signing reintroduces the key-management surface WO-002A exists to eliminate.
- **Q3:** accept the plan's deviation — roles created by the migration job, not Terraform. Requires a one-paragraph ADR-0013 (state-contents rationale) in PR-B.
- **Q4/Q5/Q6:** accept the plan's recommendations (keep hello service in dev only; GitHub-hosted runners with WIF; `tfstate` buckets unmanaged with bootstrap script).
- **Q8:** the assumed load (2 practices, 10 users each, ~2.7 rps sustained) is reasonable for a Stage 1 pilot; confirm or correct before S1-24.

## 5. Verdict

**GO for S1-01 (PR-A)**, scoped exactly as the plan states: package scaffolds registered in `verify-architecture.ts`, `--frozen-lockfile`, PHI-scanner `.next` fix (security-reviewed by Michael), gap-register append for F1–F8 and A-1–A-4.

**HOLD on S1-02 onward** until: Q1 decided (recommend PR-A2 as above), B-1 through B-10 executed by the Founder, and Michael has answered Q2. Q7 and Q9 are due before S1-20.

This audit is not evidence that any acceptance criterion is met. It is a review of the plan only.
