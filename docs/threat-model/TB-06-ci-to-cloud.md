# TB-06 — CI → cloud

**The boundary WO-002A creates.** Everything else in this model defends the running
system; this one defends the path by which the running system comes into existence. A
compromise here bypasses every other control, because the attacker ships the code that
enforces them.

Note a fact that shapes the whole analysis: **the repository is public.** Source,
workflows, policy rules and this threat model are all readable by anyone. That removes
discoverability as a defence everywhere below.

## Assets
Deploy credentials, the artifact supply chain, every environment CI can reach.

## Controls
Workload Identity Federation — **no service-account keys anywhere**; org policy
disabling SA key creation; every GitHub Action pinned to a commit SHA; SAST, SCA,
secrets, IaC policy, SBOM and provenance gates; branch protection with
`enforce_admins`.

## STRIDE

### Spoofing — another repository minting tokens for Sovereign's projects
`PARTIAL`. The WIF provider pins `assertion.repository == 'Odingard/Sovereign'`, and
prod additionally pins `assertion.ref == 'refs/heads/main'`. A provider mapped on
`repository_owner` alone would let any repo in the org deploy to production — that is
**audit finding A-1's sibling**, and a Conftest rule (NEW-19) exists to prove the
condition references `assertion.repository` rather than just the owner.

`PARTIAL` because the pool is created by hand in bootstrap step B-7 and Terraform
manages only the bindings. The strongest control in this boundary is a `gcloud` command
in a runbook.

**DREAD 5.4** — D10 R2 E3 A8 D4.

### Tampering — malicious code reaching main
`PARTIAL`. Branch protection with `enforce_admins: true` — including the Founder — plus
required checks and signed commits. **`PARTIAL` because branch protection is not
configured yet** (AC-002A-09) and `CODEOWNERS` names GitHub teams that do not exist
(**G-40**), so `require_code_owner_reviews` currently enforces nothing.

**DREAD 6.2** — D10 R4 E5 A8 D4.

> This is the highest score in the model, and it is not a design flaw. It is
> configuration that has not been applied yet, on a repository where 20+ PRs have
> merged without independent review (**G-44**). It does not block Gate 1 on score, but
> it is the single cheapest thing on this list to fix: create three GitHub identities
> and run one `gh api` call.

### Repudiation — denying what was deployed
`PARTIAL`. Cosign keyless signing and SLSA provenance are wired but only fire on a
tagged build, and no image exists yet.

**DREAD 3.6** — D6 R3 E3 A5 D2.

### Information disclosure — secrets in logs or the repo
`MITIGATED`. Gitleaks runs on every commit and over full history; `verify-synthetic-data.ts`
scans for PHI-shaped strings. Both have caught real instances during this work — the
gitleaks rule flagged a synthetic UUID bound to a key-shaped identifier, and the PHI
scanner flagged test fixtures. In each case the fix was to change the code, never to
weaken the scanner.

**DREAD 4.0** — D9 R2 E2 A6 D3. The public repository is why this scores as high as it
does on damage.

### Denial of service — poisoning the pipeline
`PARTIAL`. Actions are SHA-pinned, so a hijacked tag cannot swap an action out. The
dependency tree is not reproducible beyond the lockfile.

**DREAD 3.8** — D5 R4 E4 A5 D2.

### Elevation of privilege — CI reaching production without approval
`PARTIAL`. Prod deploys require a GitHub environment with two reviewers, one a security
CODEOWNER. Audit finding **A-3** applies: GitHub cannot express "one must be a security
CODEOWNER" natively, so it is constructed by setting the reviewer list to exactly
{Andre, Michael}. That construction silently weakens if a third reviewer is ever added.

**DREAD 5.0** — D10 R2 E3 A8 D2.

## Residual risk

| Risk | Score | Status |
|---|---|---|
| Unprotected `main`, non-existent CODEOWNERS | **6.2** | **Fix before Gate 1** — G-40, G-44, AC-002A-09 |
| WIF pool provisioned by hand | 5.4 | Cloud block; document B-7 as a reviewed step |
| Constructed two-reviewer rule | 5.0 | Audit A-3; comment in the workflow and a gate-record line |

All three need the security reviewer's signature. The 6.2 is configuration, not design.
