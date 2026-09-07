/**
 * @file Generic Clinical Assertion Model
 * @description Supports observations, conditions, medication statements, labs, and functional assessments
 * without prematurely hard-coding specialty guidelines.
 */

import type { AssertionValidity } from "../common/epistemic-status.js";
import type { EvidenceId } from "../common/identifiers.js";
import type { ClinicalTime } from "../common/temporal-window.js";

export enum AssertionCategory {
  CONDITION = "CONDITION",
  OBSERVATION = "OBSERVATION",
  LABORATORY_RESULT = "LABORATORY_RESULT",
  MEDICATION_STATEMENT = "MEDICATION_STATEMENT",
  ALLERGY_INTOLERANCE = "ALLERGY_INTOLERANCE",
  FUNCTIONAL_STATUS = "FUNCTIONAL_STATUS",
  SAFETY_SCREENING = "SAFETY_SCREENING",
}

export interface TypedConceptReference {
  readonly code: string;
  readonly codeSystem: string;
  readonly displayName: string;
}

export interface TypedValueQuantity {
  readonly value: number;
  readonly unit: string;
  readonly referenceRangeLow?: number;
  readonly referenceRangeHigh?: number;
}

export type AssertionValue =
  | { readonly kind: "QUANTITY"; readonly quantity: TypedValueQuantity }
  | { readonly kind: "CONCEPT"; readonly concept: TypedConceptReference }
  | { readonly kind: "TEXT"; readonly text: string }
  | { readonly kind: "PRESENCE_ABSENCE"; readonly isPresent: boolean }
  | { readonly kind: "UNKNOWN"; readonly reason?: string };

export interface ClinicalAssertion {
  readonly assertionId: string;
  readonly category: AssertionCategory;
  readonly concept: TypedConceptReference;
  readonly value: AssertionValue;
  readonly validity: AssertionValidity;
  readonly effectiveTime: ClinicalTime;
  readonly recordedTime: ClinicalTime;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
