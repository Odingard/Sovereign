/**
 * @file Deterministic patient matching (WO-002B S1-14)
 * @description The Stage 1 matching rules. No probabilistic matching, ever.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.2 (PRD FR-005), and the clinical decisions
 * recorded in docs/clinical-decisions/S1-14-patient-matching.md (Mark, 2026-09-22).
 *
 * The rules, in order:
 *   1. Exact match on (source_system, identifier_type='MRN', value_hash) -> link, confirmed.
 *   2. Else exact match on normalised name + DOB + sex -> create UNCERTAIN + reconciliation item.
 *   3. Else create a new confirmed patient.
 *
 * Rule 2 is the one that matters and it was decided explicitly: **flag, never
 * auto-link**. The permissive failure — silently merging two people's clinical records
 * — has no safe recovery. The conservative failure produces a duplicate, which a human
 * can merge. Those are not symmetric, and the asymmetry is why this function returns a
 * candidate rather than a decision.
 *
 * There is no score. `reconciliation_item.score` exists in the schema for later stages;
 * Stage 1 writes null, because a score implies a threshold and a threshold is
 * probabilistic matching wearing a different hat.
 */

import { type NormalizedDemographics, demographicsAgree } from "./normalize.js";

export type MatchState = "confirmed" | "uncertain" | "duplicate_suspect" | "merged";

export interface ExistingPatient {
  readonly patientId: string;
  readonly demographics: NormalizedDemographics;
  readonly matchState: MatchState;
}

export interface IdentifierLookup {
  readonly sourceSystemId: string;
  readonly identifierType: string;
  readonly valueHash: string;
}

export type MatchOutcome =
  | {
      readonly kind: "identifier_match";
      readonly patientId: string;
      readonly matchState: "confirmed";
    }
  | {
      readonly kind: "uncertain_match";
      readonly candidatePatientIds: readonly string[];
      readonly matchState: "uncertain";
      readonly reason: string;
    }
  | { readonly kind: "new_patient"; readonly matchState: "confirmed" };

/** The only identifier type that is deterministic in Stage 1 (question 7 still open). */
export const DETERMINISTIC_IDENTIFIER_TYPE = "MRN" as const;

export interface MatchInput {
  readonly identifier: IdentifierLookup | null;
  readonly demographics: NormalizedDemographics;
  /** Resolved by an exact lookup on the unique identifier constraint. */
  readonly identifierMatch: { patientId: string } | null;
  /** Candidates from the tenant, already narrowed by the caller. */
  readonly tenantPatients: readonly ExistingPatient[];
}

export function matchPatient(input: MatchInput): MatchOutcome {
  // Rule 1. An MRN from a given source system is the one key Sovereign treats as
  // authoritative, and the unique constraint means the lookup is exact by
  // construction.
  if (
    input.identifier !== null &&
    input.identifier.identifierType === DETERMINISTIC_IDENTIFIER_TYPE &&
    input.identifierMatch !== null
  ) {
    return {
      kind: "identifier_match",
      patientId: input.identifierMatch.patientId,
      matchState: "confirmed",
    };
  }

  // Rule 2. Demographic agreement is a CANDIDATE, never a link.
  //
  // Merged records are excluded: a merged patient is a tombstone pointing elsewhere,
  // and offering it as a candidate would invite merging into something already merged.
  const candidates = input.tenantPatients
    .filter((p) => p.matchState !== "merged")
    .filter((p) => demographicsAgree(input.demographics, p.demographics))
    .map((p) => p.patientId)
    .sort();

  if (candidates.length > 0) {
    return {
      kind: "uncertain_match",
      candidatePatientIds: candidates,
      matchState: "uncertain",
      reason:
        candidates.length === 1
          ? "Exact match on normalised name, date of birth and sex, with no matching MRN"
          : `Exact demographic match against ${candidates.length} existing patients`,
    };
  }

  // Rule 3.
  return { kind: "new_patient", matchState: "confirmed" };
}

/**
 * What may attach to a patient in a given match state.
 *
 * "No clinical fact attaches to an uncertain patient" (§7.2). Attaching a fact to a
 * record that might be the wrong person is the failure this whole flow exists to
 * prevent — and unlike a duplicate, it is not recoverable by merging.
 */
export function mayAttachClinicalFact(matchState: MatchState): boolean {
  return matchState === "confirmed";
}

/**
 * Whether the pre-visit brief renders.
 *
 * Mark, 2026-09-22 (question 2): it renders WITH A WARNING BANNER rather than being
 * suppressed. An empty screen gives no path forward and invites a workaround.
 *
 * The obligation that comes with that decision: the warning must be structurally
 * unskippable — in the content flow, not dismissible chrome — and present on every
 * screen showing the patient, not only on entry. `requiresIdentityWarning` is
 * returned separately from `render` so a caller cannot render without knowing.
 */
export function briefVisibility(matchState: MatchState): {
  render: boolean;
  requiresIdentityWarning: boolean;
} {
  if (matchState === "merged") {
    return { render: false, requiresIdentityWarning: false };
  }
  const unconfirmed = matchState !== "confirmed";
  return { render: true, requiresIdentityWarning: unconfirmed };
}

/** Roles permitted to view or act on an unconfirmed patient (Mark, 2026-09-22). */
export const ROLES_PERMITTED_ON_UNCERTAIN_PATIENT = ["clinician", "practice_manager"] as const;

export function mayViewUncertainPatient(roles: readonly string[]): boolean {
  return roles.some((r) => (ROLES_PERMITTED_ON_UNCERTAIN_PATIENT as readonly string[]).includes(r));
}
