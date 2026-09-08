# Sovereign Repository Constitution

This file governs every human and AI contributor. A conflicting task instruction is invalid unless the founder approves a documented ADR and all required clinical/security gates.

## Permanent doctrine

1. **Sovereign will never be the doctor.**
2. **The clinician decides; Sovereign makes the decision executable.**
3. The model is not the system of record.
4. AI may propose changes but may not directly mutate authoritative state.
5. AI may not directly execute external healthcare actions.
6. Discussion is not decision.
7. Unknown is not negative.
8. Attempted, transmitted, received, accepted, and completed are distinct states.
9. Tenant identity and patient identity may never be invented or altered by an AI agent.
10. No real PHI until G0-B — Real PHI / PHI-Capable Environment receives explicit Founder GO. G0-A synthetic/local GO must never be interpreted as PHI authorization.
11. Development uses synthetic data only until explicitly authorized.
12. Core domain architecture remains cloud-provider independent.
13. Material architecture changes require an ADR.
14. Clinical ambiguity must be marked `REQUIRES CLINICAL DECISION`, not guessed.
15. Patient safety overrides speed and convenience.
16. **Intent is not authority. Authority is not evidence. Evidence is not execution. Execution is not completion.**
17. **Identity is not authority. A role is not an authority grant. Tenant membership is not patient authorization. Authentication success is not permission to act.**
18. **The requester does not define the security requirements for its own request.**
19. AI may possess an authenticated technical identity for auditing and tool invocation but may never become a source of clinical authority.

## Mandatory architecture rule

**The wrong architecture makes the model the system of record.**

**The correct architecture makes the model a reasoning component inside a controlled system.**

**For Sovereign, the second architecture is mandatory.**

No AI agent may directly mutate authoritative clinical state or execute an external clinical-administrative action without passing through Sovereign-owned verification, authority, policy, and execution controls.

## Authoritative objects

Clinical State, Clinical Evidence / Provenance, Clinical Intent, Execution Graph, and Therapy Access State are persistent, Sovereign-owned, model-independent objects. They survive and remain valid independently of model/provider sessions, prompts, agent sessions, LLM memory, and chat history.

## Mandatory mutation path

`AI candidate → validation → evidence/provenance check → policy/authority check → authorized domain service → persistent state update → audit event`

Skipping, merging, or hiding a stage is prohibited. A candidate carries no authority.

## Mandatory execution path

`Clinical Intent → Verification → Policy/Authority → Execution Graph → deterministic adapter → external system → confirmation → Execution Graph update → audit`

An attempt is not confirmation. Confirmation is not necessarily clinical-objective completion. Every stage uses typed states and durable evidence.

## Contributor operating rules

- Read the governing work order and dependencies before editing.
- Modify only approved scope; disclose incidental issues without silently expanding work.
- Do not introduce new authoritative objects, action paths, or clinical semantics without ADR/review.
- Never infer patient, tenant, diagnosis, negation, intent, authority, evidence, or completion.
- Reject untrusted model output at typed service boundaries.
- Keep vendor types in adapters; map explicitly to canonical types.
- Use deny-by-default authorization and trusted server-resolved tenancy.
- Use idempotency, optimistic concurrency, transactional event publication, and replay-safe consumers.
- Fail closed on identity, authority, evidence, policy, or state ambiguity.
- Preserve source data and append corrections/supersession; do not erase history.
- Do not place secrets, credentials, real patient data, or production identifiers in code, prompts, fixtures, logs, screenshots, commits, or issues.
- Add tests for allowed and forbidden behavior, not only happy paths.
- Document commands, results, exact commit, limitations, and acceptance evidence.

## Authority classes

- **Class A — autonomous administrative:** reversible, low-risk operations explicitly authorized by policy.
- **Class B — organization-policy-authorized:** organization policy grants bounded execution under defined conditions.
- **Class C — clinician-authorized transaction:** requires explicit clinician authorization bound to exact content and scope.
- **Class D — clinical judgment:** remains human; AI may assist but never decide or execute as clinician.

Classification does not itself grant authority. The policy engine must verify actor, tenant, patient, purpose, evidence, current state, content version, and expiry at execution time.

## Review requirements

- Clinical domain/intent/evidence/execution changes require clinical-safety review.
- Tenancy, authorization, PHI, audit, adapters, infrastructure, and CI/CD changes require security review.
- Durable workflow/state changes require workflow review.
- Every work order requires QA verification of acceptance evidence.
- Unresolved patient-safety or isolation risk is blocking.
- No direct pushes to `main`; protected PRs and required checks only.

## Definition of done

Done means scope implemented; automated and evaluation tests passed; safety/security/privacy implications reviewed; docs/ADRs updated; no real PHI introduced; completion evidence mapped to every acceptance criterion; reviewer findings resolved; and a named gate authority records GO. Code generation or agent self-report alone is not evidence.

