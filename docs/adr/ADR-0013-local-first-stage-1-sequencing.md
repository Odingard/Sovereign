# ADR-0013 — Local-First Stage 1 Sequencing

Status: **Proposed** (requires Founder acceptance; Architecture reviewer Roger)

## Context

`docs/STAGE1_FOUNDATION_SPEC.md` §13 orders Stage 1 as tickets S1-01 … S1-25, with the Terraform tickets (S1-02, S1-03) second and third. `work-orders/WO-002A-cloud-foundation-iac-cicd.md` is marked `blocks WO-003 implementation`, and ADR-0011 §Decision 5 places WO-002A/B/C before WO-003. The implied order is: build the cloud, then build on it.

Three facts have since been established:

1. **Cost.** `work-orders/execution-plans/WO-002A-execution-plan.md` §11 estimates ~$772/month across the three environments, on a floor of ~$152/month per environment (Cloud SQL plus an always-on serverless connector and Cloud NAT) that is incurred whether or not a single request is served. All three environments exceed the Founder's stated $150/month/environment threshold. The Founder has stated this is not currently affordable.
2. **Nothing is deployed.** No GCP folder, project, or resource exists. `infra/envs/{dev,staging,prod}/main.tf` are 24-line skeletons declaring zero resources. The GCP BAA is not executed. Bootstrap steps B-1 … B-10 of the execution plan have not been performed.
3. **Most of Stage 1 does not need cloud.** Of the 25 tickets, 18 run entirely on the local Docker stack or in free GitHub CI: S1-01, S1-04, S1-05, S1-06, S1-07, S1-09, S1-10, S1-11, S1-12, S1-14, S1-15, S1-16, S1-17, S1-18, S1-19, S1-20, S1-23, S1-25. S1-22 runs 22 of its 24 adversarial tests locally. Only S1-02, S1-03, S1-08 (cloud half), S1-13, S1-21 and S1-24 require a live cloud.

This is not a workaround. It is what the architecture was built for: ADR-0004 (*Local-First and Cloud Adapters*), ADR-0006 (local Docker stack), ADR-0012 §2 (Keycloak locally, "the adapter must implement two providers from day one, which proves the port is real"), `STAGE1_FOUNDATION_SPEC.md` §5.3 (file-backed fake KMS implementation of `KeyManagementPort`), and AGENTS.md doctrine 12 (core domain architecture remains cloud-provider independent).

A second fact makes the timing favourable: the Founder has an open Microsoft for Startups Founders Hub application with verification pending, which may change the cloud platform decision. Deferring cloud work defers that decision to a point where it can be made with better information, at no cost.

## Decision

1. **Stage 1 is re-sequenced local-first.** The six cloud-dependent tickets (S1-02, S1-03, S1-08 cloud half, S1-13, S1-21, S1-24) move to the end of Stage 1. The remaining nineteen are built first, in dependency order, against the local Docker stack and GitHub CI.
2. **WO-002B and WO-002C may proceed while WO-002A remains open.** This inverts the order implied by ADR-0011 §Decision 5. The dependency that actually binds is the shared kernel, not the cloud: `STAGE1_FOUNDATION_SPEC.md` §14.1 states "S1-01 through S1-07 are prerequisites; do not start a service before the kernel exists." S1-02 and S1-03 are not prerequisites for any application code.
3. **WO-002A stays open and its acceptance criteria stay unmet.** AC-002A-01 through AC-002A-09, AC-002A-11 and the cloud portion of AC-002A-12 cannot be evidenced without a cloud. The WO-002A gate record will record them as `BLOCKED — AWAITING CLOUD`, never as satisfied. AC-002A-05 (policy-as-code negative tests) and AC-002A-10 (threat model, residency matrix) can be completed locally and will be.
4. **Gate 1 cannot be signed under this ADR.** `docs/ENTERPRISE_BUILD_PLAN.md` Gate 1 requires IaC deployed in all environments, ring rollout with rollback, a first DR/chaos drill with measured RTO/RPO, and the adversarial suite green for 7 consecutive days on staging. None are achievable locally. Stage 1 reaches approximately 80% completion and stops at that boundary. **No gate is waived by this ADR.**
5. **The cloud platform decision is deferred, not made.** S1-D01 (Google Cloud) remains the accepted decision. This ADR does not adopt, evaluate, or favour any alternative platform. If the Founder later elects to re-evaluate, that requires its own ADR superseding S1-D01.
6. **The local stack gains the components the deferred tickets would have provided in cloud form**: Keycloak (per ADR-0012 §2), a Pub/Sub emulator, and the file-backed fake `KeyManagementPort` (per §5.3). These already exist as planned local implementations; this ADR schedules them earlier, not differently.

## Consequences

- Positive: Stage 1 progresses at **$0/month** for an estimated several months of work.
- Positive: when cloud work begins, it deploys code already proven against the adversarial suite rather than being debugged blind against unfamiliar infrastructure.
- Positive: the GCP-versus-alternative platform question resolves on its own timeline, with verification information in hand.
- Positive: the port-and-adapter boundaries (`KeyManagementPort`, `IdentityProviderPort`, `WorkflowRuntime`) get exercised against two real implementations, which is the only way to know they are real ports rather than aspirational ones.
- Negative: **Gate 1 slips** until cloud work is funded and executed. This is the principal cost and it is not small.
- Negative: infrastructure-only controls stay unproven — IAM bindings, VPC egress allowlists, Workload Identity Federation, CMEK key permissions, Cloud SQL IAM authentication, pgaudit, private IP. Defects in these surface later, and later is more expensive.
- Negative: local Postgres is not Cloud SQL. Row-level security behaves identically, so the tenancy proof holds; the infrastructure controls around it do not exist locally.
- Negative: WO-002A remains open for an extended period, which is an unusual state for a P0/CRITICAL work order and must not be allowed to read as completion.

## Rejected alternatives

- **Proceed with cloud now on credit or borrowing.** Rejected by the Founder on cost. Recorded here because it remains the fastest path to Gate 1 if funding changes.
- **Stop Stage 1 until cloud is funded.** Rejected: it idles nineteen tickets of genuinely useful work for a blocker that is financial, not technical, and of unknown duration.
- **Build the cloud tickets against emulators and claim the ACs.** Rejected outright. AC-002A-01 through AC-002A-04 assert properties of real GCP org policies, real WIF, and real private networking. Emulated evidence would be false evidence, which `AGENTS.md:89` forbids: "Code generation or agent self-report alone is not evidence."
- **Reduce the environment count to fit budget** (for example, dev only). Rejected as a *sequencing* decision — it is a legitimate option but it changes AC-002A-01, so it belongs in its own decision if the Founder wants it.

## Verification

- `docs/GAP_REGISTER.md` records every cloud-dependent acceptance criterion as blocked rather than closed.
- The WO-002A gate record contains a `BLOCKED — AWAITING CLOUD` section enumerating AC-002A-01…04, 06…09, 11, and states plainly that Gate 1 is not signable.
- No ticket claiming a cloud acceptance criterion is marked complete while this ADR is in force.
- S1-D01 (Google Cloud) remains unchanged in `docs/STAGE1_FOUNDATION_SPEC.md`; this ADR adds no platform decision.
