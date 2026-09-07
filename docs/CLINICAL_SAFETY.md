# Clinical Safety

## Safety case

Sovereign assists qualified users and executes only approved, policy-permitted work. Safety depends on patient identity, evidence, intent, authority, execution, uncertainty, and audit integrity. A failure in any link blocks the consequential transition.

## Core hazards

- wrong patient/tenant; unsupported or stale assertion; hidden contradiction;
- discussion misclassified as decision; conditional intent stripped of condition;
- wrong therapy/dose/route/timing; missing monitoring or safety evidence;
- AI or staff action without authority; duplicate execution;
- transmitted work treated as accepted/completed;
- payer/pharmacy failure hidden; changed decision not superseding old work;
- alert overload or interface design encouraging unreviewed approval.

## Controls

Source-linked candidates; typed uncertainty; human review; exact-content authorization; evidence freshness rules; conflict detection; deterministic state transitions; idempotency; pause/cancel/supersede; safe failure; model and workflow kill switches; scenario/subgroup evaluation; post-release monitoring; incident escalation; complete audit.

## Required labels

- `UNKNOWN` for absent knowledge.
- `CONFLICTED` for unresolved source disagreement.
- `REQUIRES CLINICAL DECISION` for clinical ambiguity.
- `BLOCKED_MISSING_AUTHORITY` when authority is absent.
- Distinct attempt, transmission, receipt, acceptance, initiation, and completion states.

## Review and incidents

The clinical-safety reviewer may block release. Any wrong-patient action, unsupported clinical mutation, incorrect intent with executable consequence, or hidden therapy interruption triggers containment, evidence preservation, affected-case identification, human review, and corrective/revalidation action. Safety issues are never closed solely by model self-assessment.

