# Sovereign Rheumatology Product Baseline

## Identity and category

Company: Sovereign Health AI LLC  
Platform: Sovereign  
Launch product: Sovereign Rheumatology  
Category: Specialty Clinical Intelligence & Execution Platform  
Tagline: From clinical decision to completed care.

## Product thesis

Rheumatology is longitudinal, evidence-heavy, medication-intensive, and operationally fragmented. Documentation is only the entry point. Care stalls after the visit across chart reconstruction, clinician intent, orders, benefit investigation, prior authorization, step-therapy evidence, additional-information requests, denials/appeals, specialty pharmacy, infusion readiness, labs/safety screening, patient contact, initiation, monitoring, and interruption.

Sovereign creates a source-linked clinical picture, captures explicit clinician intent, verifies whether intended work is evidence-supported and authorized, converts verified intent into a durable Execution Graph, coordinates permitted action through deterministic adapters, and tracks Therapy Access State until treatment is actually initiated or the plan is intentionally changed/cancelled.

Operating loop:

`source evidence → candidate Clinical State → clinician-reviewed truth → explicit Clinical Intent → Verification → authority/policy → durable Execution Graph → deterministic external action → confirmation → Therapy Access State → verified completion or intentional closure`

## Primary users and jobs

- Rheumatologist/APP: pre-visit delta, encounter evidence, draft documentation, exception resolution, and exact authorization without surrendering judgment.
- Nurse/medical assistant: accurate intake, monitoring/safety gaps, patient outreach, and clinically routed exceptions.
- Prior-authorization specialist: one source-linked case, complete packet, payer status, deadlines, denial/appeal, and next action.
- Infusion coordinator: readiness gates, authorization, safety evidence, drug/site status, scheduling, administration evidence, and interruption.
- Practice manager: workload, aging, bottlenecks, completion, policy, access, integration health, and audit.
- Administrator/security/compliance: roles, authority, tenancy, model/configuration, evidence, incidents, and releases.

## Initial clinical/operational capability

1. Ingest a bounded set from one EHR; preserve source/provenance; FHIR remains transport.
2. Build an RA Clinical State across diagnosis, disease activity, function, manifestations, objective evidence, medication history, response/failure/intolerance, safety screening, monitoring, current therapy, unresolved plan, and therapy access.
3. Produce source-linked pre-visit delta and specialty documentation draft.
4. Capture intent while distinguishing discussion, considered, conditional, recommended, planned, decided, ordered, authorized, deferred, rejected, and superseded.
5. Detect conflict, missing/unsupported/stale evidence, ambiguity, inconsistent execution, and missing authority.
6. Create durable, restart-safe, retry-safe execution nodes with owner, evidence, authority, dependencies, timing, completion, and escalation.
7. Operate a therapy-access case for initiation, switch, renewal, additional information, denial/appeal, payer/formulary disruption, pharmacy/infusion fulfillment, treatment interruption, and continuity.
8. Present clinician, operations, and admin experiences that show state, source, uncertainty, responsibility, blocker, and safe next action.
9. Reconstruct every consequential action from actor, patient/tenant, evidence, intent, authority, policy, model/configuration, external confirmation, override, and final state.

## Non-goals

- Autonomous diagnosis, treatment selection, prescribing, ordering, signing, or clinical judgment.
- Generic chatbot or ambient-scribe-only product.
- Replacing the EHR as the legal clinical record in the initial product.
- Making an LLM, vector store, chat, prompt, agent session, FHIR server, or cloud workflow the authoritative domain model.
- Guaranteeing payer approval, reimbursement, adherence, or clinical outcome.
- Treating an outbound attempt, portal submission, approval, shipment, appointment, or worker completion as treatment completion.
- Real PHI before explicit WO-000 approval.

## Success definition

Primary operational outcome: reduce verified decision-to-treatment-initiation time without increasing safety, documentation, privacy, identity, or authority failures. Supporting measures include clinician documentation/review time, material correction and critical omission rates, first-pass PA completeness, practice versus external time in state, staff touches, lost/unknown cases, exception age, duplicate actions, treatment interruptions, and evidence-backed completion. Baselines precede claims; medians/percentiles and safety-critical events are reported, not averages alone.

## Permanent product boundary

The platform makes a clinician's decision executable; it does not make the decision. Efficiency must come from better evidence, explicit intent, governed coordination, and verifiable completion—not from hiding human responsibility.

