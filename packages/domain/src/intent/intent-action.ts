/**
 * @file Extensible Clinical Intent Action Concepts
 * @description Supports medication and non-medication clinical actions with extensible namespacing.
 * Invariant: Does not hardcode specialty ontologies; provides generic extensible machinery.
 */

import type { TypedConceptReference, TypedValueQuantity } from "../state/clinical-assertion.js";

export enum IntentActionCategory {
  MEDICATION = "MEDICATION",
  PROCEDURE = "PROCEDURE",
  LABORATORY = "LABORATORY",
  MONITORING = "MONITORING",
  REFERRAL_OR_CONSULT = "REFERRAL_OR_CONSULT",
  CARE_PLAN_CHANGE = "CARE_PLAN_CHANGE",
  SPECIALTY_CUSTOM = "SPECIALTY_CUSTOM",
}

export type ActionValueSpecification =
  | { readonly kind: "QUANTITY"; readonly quantity: TypedValueQuantity }
  | { readonly kind: "CONCEPT"; readonly concept: TypedConceptReference }
  | { readonly kind: "NARRATIVE"; readonly text: string };

export interface ExtensibleActionConcept {
  readonly category: IntentActionCategory;
  readonly actionVerb: string; // e.g. "INITIATE", "SWITCH", "TITRATE", "DISCONTINUE", "ORDER"
  readonly targetConcept: TypedConceptReference;
  readonly actionNamespace: string; // e.g. "sovereign.core" or "sovereign.specialty.rheumatology"
  readonly qualifiers?: ReadonlyArray<TypedConceptReference>;
  readonly valueSpecification?: ActionValueSpecification;
}
