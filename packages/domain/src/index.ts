/**
 * @file Sovereign Canonical Domain Core Public API
 * @description Invariant: The model is not the system of record.
 * The clinician decides; Sovereign makes the decision executable.
 *
 * This package has ZERO external dependencies on Google Cloud, Gemini,
 * Temporal, FHIR libraries, EHR vendor SDKs, or web frameworks.
 */

// Common
export * from "./common/identifiers.js";
export * from "./common/epistemic-status.js";
export * from "./common/temporal-window.js";
export * from "./common/authority-class.js";
export * from "./common/lifecycle-state.js";
export * from "./common/data-classification.js";
export * from "./common/domain-error.js";
export * from "./common/versioning.js";

// Aggregate 1: Clinical Evidence (Source & Provenance)
export * from "./evidence/source-provenance.js";
export * from "./evidence/evidence-assessment.js";
export * from "./evidence/evidence-aggregate.js";

// Aggregate 2: Clinical State (Asserted Truth)
export * from "./state/clinical-assertion.js";
export * from "./state/clinical-state-aggregate.js";

// Aggregate 3: Clinical Intent (Clinician Decisions)
export * from "./intent/intent-lifecycle.js";
export * from "./intent/intent-action.js";
export * from "./intent/clinical-intent-aggregate.js";

// Aggregate 4: Execution Graph (Durable Task DAG)
export * from "./execution/execution-states.js";
export * from "./execution/execution-attempt.js";
export * from "./execution/completion-confirmation.js";
export * from "./execution/execution-node.js";
export * from "./execution/execution-graph-aggregate.js";

// Aggregate 5: Therapy Access State (Longitudinal Operational Journey)
export * from "./therapy-access/therapy-access-aggregate.js";

// Domain Events
export * from "./events/domain-event.js";
export * from "./events/aggregate-events.js";
