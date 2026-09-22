/**
 * @sovereign/service-patient-context — patient identity, provenance, reconciliation.
 *
 * WO-002B S1-14. Deterministic matching only; no probabilistic matching in Stage 1.
 * Clinical decisions governing this service are recorded in
 * docs/clinical-decisions/S1-14-patient-matching.md.
 */

export * from "./normalize.js";
export * from "./matching.js";
export * from "./merge.js";
export * from "./provenance.js";
