/**
 * @file Canonical Clinical Intent Lifecycle
 * @description Invariant: The 12 distinct stages must NOT be collapsed.
 * Discussion is not decision; recommendation is not an order.
 */

export enum ClinicalIntentStage {
  DISCUSSED = "DISCUSSED",
  CONSIDERED = "CONSIDERED",
  CONDITIONAL = "CONDITIONAL",
  RECOMMENDED = "RECOMMENDED",
  PLANNED = "PLANNED",
  DECIDED = "DECIDED",
  ORDERED = "ORDERED",
  AUTHORIZED = "AUTHORIZED",
  DEFERRED = "DEFERRED",
  REJECTED = "REJECTED",
  SUPERSEDED = "SUPERSEDED",
  CANCELLED = "CANCELLED",
}

/**
 * Validates allowable state transitions for clinical intent.
 */
export function isAllowedIntentTransition(
  fromStage: ClinicalIntentStage,
  toStage: ClinicalIntentStage,
): boolean {
  if (fromStage === toStage) return true;

  // Terminal states cannot transition to active states
  if (fromStage === ClinicalIntentStage.SUPERSEDED || fromStage === ClinicalIntentStage.CANCELLED) {
    return false;
  }

  // Any active or in-progress intent can be superseded or cancelled
  if (toStage === ClinicalIntentStage.SUPERSEDED || toStage === ClinicalIntentStage.CANCELLED) {
    return true;
  }

  switch (fromStage) {
    case ClinicalIntentStage.DISCUSSED:
      return [
        ClinicalIntentStage.CONSIDERED,
        ClinicalIntentStage.RECOMMENDED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.CONSIDERED:
      return [
        ClinicalIntentStage.CONDITIONAL,
        ClinicalIntentStage.RECOMMENDED,
        ClinicalIntentStage.PLANNED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.CONDITIONAL:
      return [
        ClinicalIntentStage.RECOMMENDED,
        ClinicalIntentStage.DECIDED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.RECOMMENDED:
      return [
        ClinicalIntentStage.PLANNED,
        ClinicalIntentStage.DECIDED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.PLANNED:
      return [
        ClinicalIntentStage.DECIDED,
        ClinicalIntentStage.ORDERED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.DECIDED:
      return [
        ClinicalIntentStage.ORDERED,
        ClinicalIntentStage.AUTHORIZED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.ORDERED:
      return [
        ClinicalIntentStage.AUTHORIZED,
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.REJECTED,
      ].includes(toStage);

    case ClinicalIntentStage.AUTHORIZED:
      return [
        ClinicalIntentStage.DEFERRED,
        ClinicalIntentStage.SUPERSEDED,
        ClinicalIntentStage.CANCELLED,
      ].includes(toStage);

    case ClinicalIntentStage.DEFERRED:
      return [
        ClinicalIntentStage.CONSIDERED,
        ClinicalIntentStage.PLANNED,
        ClinicalIntentStage.DECIDED,
        ClinicalIntentStage.CANCELLED,
      ].includes(toStage);

    case ClinicalIntentStage.REJECTED:
      return false; // Rejection is terminal unless superseded by a new intent

    default:
      return false;
  }
}
