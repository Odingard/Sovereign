# WO-002A Execution-Plan Prompt

Give this file to the coding agent (Claude Code or Antigravity) as the opening instruction. The agent produces an **execution plan only**; it does not build until the Founder approves the plan. Paste verbatim.

---

You are the implementing engineer for Sovereign Health AI's repository. Before doing anything else, read, in this order, and do not skip any:

1. `AGENTS.md` (repository constitution — binding on you)
2. `docs/adr/README.md` and every ADR, especially ADR-0006, 0007, 0009, 0010, 0011, 0012
3. `docs/ENTERPRISE_BUILD_PLAN.md`
4. `docs/STAGE1_FOUNDATION_SPEC.md` (§1 decisions, §2 layout, §3 infrastructure, §9 pipeline, §10 adversarial suite, §13 tickets)
5. `docs/GAP_REGISTER.md`
6. `docs/SERVICE_ELIGIBILITY_MATRIX.md`
7. `work-orders/README.md` and `work-orders/WO-002A-cloud-foundation-iac-cicd.md`
8. `infra/README.md`, `infra/modules/README.md`, `infra/policy/sovereign.rego`, `infra/envs/*/main.tf`
9. `.github/workflows/ci.yml` and `.github/workflows/security-supply-chain.yml`
10. `work-orders/gate-records/WO-000-gate-record.md` and `WO-002-gate-record.md`

## Your task

Produce `work-orders/execution-plans/WO-002A-execution-plan.md` and nothing else. Do not create infrastructure, modify workflows, or write application code in this task.

The plan must contain, in this order:

1. **Scope confirmation** — restate WO-002A scope and out-of-scope in your own words; list every acceptance criterion AC-002A-01 … AC-002A-12 and the exact artifact that will satisfy each.
2. **Repository validation** — commands you ran (`pnpm install --frozen-lockfile`, `pnpm run verify`, `pnpm run lint`, `pnpm run typecheck`) with results; any pre-existing failures listed, not fixed.
3. **Terraform module design** — for each of the ten modules in `infra/modules/README.md`: inputs, outputs, resources, the invariant(s) it enforces, and which `infra/policy/sovereign.rego` rule proves it. State which GCP APIs each enables. State the org policies applied in `project`.
4. **Environment bootstrap sequence** — the exact manual, one-time steps the Founder must perform outside Terraform (create the GCP folder/projects, billing link, execute the GCP BAA, create the `tfstate-*` buckets, create the WIF pool/provider, set GitHub environment secrets/variables) with commands. Everything else must be Terraform.
5. **Pipeline design** — changes to `ci.yml` and `security-supply-chain.yml`; new `deploy-dev.yml`, `deploy-staging.yml`, `deploy-prod.yml`; ring rollout mechanics on Cloud Run (traffic splits, hold times, SLO/P99 rollback triggers); migration job; which checks become required on `main`; branch-protection settings and how they will be evidenced (`gh api` output).
6. **Policy-as-code** — additional Conftest rules you will add and the negative test plans (a deliberately non-compliant plan that must fail) for each.
7. **Threat model and residency matrix** — outline of `docs/threat-model/` (STRIDE per trust boundary listed in `THREAT_MODEL.md`, DREAD scoring table) and `docs/DATA_RESIDENCY_MATRIX.md`.
8. **Load, chaos, DR, status page, on-call, PIR** — k6 scenarios (2× and 5× of a stated assumed pilot load, two synthetic tenants), the drill scripts, how RTO/RPO will be measured against NFR-002, status-page tool choice within a bootstrapped budget, on-call tier document, `docs/runbooks/pir-template.md`.
9. **Eligibility matrix updates** — every service the plan touches and its resulting status.
10. **Ticket sequence** — map the work to spec §13 tickets S1-01, S1-02, S1-03, S1-20, S1-21, S1-23, S1-24; give each an estimate, dependencies, and the PR it lands in. One PR per ticket; no PR may exceed the ticket's scope.
11. **Cost estimate** — monthly GCP cost per environment at pilot scale, with the assumptions; flag anything above $150/month/environment for Founder decision.
12. **Risks and open questions** — anything ambiguous in the WO or spec. Mark clinical ambiguity `REQUIRES CLINICAL DECISION`; mark security ambiguity `REQUIRES SECURITY DECISION`. Do not guess.
13. **Evidence plan** — for each AC, where the evidence will live (`work-orders/gate-records/WO-002A-gate-record.md`, CI run links, drill reports) and who signs (Owner Andre Byrd; Security reviewer Michael; Architecture reviewer Roger).

## Rules you must obey while planning

- Synthetic data only. No real PHI anywhere. G0-B is HOLD.
- No cloud resource outside Terraform. No service-account keys. No public IPs on backend compute. Region `us-central1` only.
- Accepted ADRs are immutable; if the plan needs a different decision, propose a new ADR in section 12 and stop.
- Do not widen scope into WO-002B or WO-002C. If a dependency on them exists, state it.
- Do not self-approve anything. The plan ends with a request for Founder GO to begin S1-01.
- Cite file paths and line numbers for every claim about the repository's current state.

Reply with the plan file only. If you cannot complete a section, write what is missing and why; do not invent.
