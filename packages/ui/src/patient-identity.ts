/**
 * @file Patient identity warning (WO-002B S1-19)
 * @description The contract for showing an unconfirmed patient.
 *
 * Source: Mark's clinical decision, 2026-09-22, question 2
 * (docs/clinical-decisions/S1-14-patient-matching.md).
 *
 * > The pre-visit brief renders for an uncertain patient, with a visible warning that
 * > identity is unconfirmed. It is not suppressed.
 *
 * I argued for suppressing it. Mark's reasoning is better: an empty screen gives no
 * path forward and invites a workaround, and a clinician who cannot see the record
 * will find another way to see it.
 *
 * The obligation that came with the decision, recorded alongside it:
 *
 *   1. The warning is structurally unskippable — in the content flow, not dismissible
 *      chrome.
 *   2. It appears on EVERY screen showing the patient, not only on entry.
 *
 * This file enforces both in the type system rather than in a style guide. A banner
 * that can be dismissed once and forgotten is precisely the failure I was worried
 * about, and design can remove it — so the type refuses to describe one.
 */

export type PatientMatchState = "confirmed" | "uncertain" | "duplicate_suspect" | "merged";

export interface IdentityWarning {
  readonly headline: string;
  readonly body: string;
  /**
   * Always `false`, and not optional.
   *
   * A boolean that could be true would let a caller pass `dismissible: true` and
   * satisfy the type. `false` as the only inhabitant means the type itself refuses to
   * describe a dismissible warning.
   */
  readonly dismissible: false;
  /**
   * Always `"content"`, never `"chrome"`.
   *
   * Chrome is scrolled past. A warning in the content flow has to be read to reach
   * what is underneath it.
   */
  readonly placement: "content";
  /** What the clinician should do. A warning with no next step is a dead end. */
  readonly resolutionPath: string;
  readonly ariaRole: "alert";
}

export interface PatientHeaderModel {
  readonly matchState: PatientMatchState;
  readonly render: boolean;
  /** Present on every screen showing this patient, or absent because none is needed. */
  readonly warning: IdentityWarning | null;
  /** Clinical facts never attach to an unconfirmed patient (spec §7.2). */
  readonly showsClinicalFacts: boolean;
}

const UNCERTAIN_WARNING: IdentityWarning = {
  headline: "Patient identity is not confirmed",
  body: "This record matched an existing patient on name, date of birth and sex, but not on medical record number. It may be the same person, or a different one.",
  dismissible: false,
  placement: "content",
  resolutionPath:
    "Confirm identity against the source record before acting. Resolve the match in the reconciliation queue.",
  ariaRole: "alert",
};

const DUPLICATE_WARNING: IdentityWarning = {
  headline: "Possible duplicate record",
  body: "Another record in this tenant shares this patient's identifying details.",
  dismissible: false,
  placement: "content",
  resolutionPath: "Review both records in the reconciliation queue before merging.",
  ariaRole: "alert",
};

/**
 * Build the header for a patient screen.
 *
 * Called by every screen that shows a patient. The warning is returned with the
 * render decision rather than separately, so a caller cannot obtain permission to
 * render without also receiving the warning it must display.
 */
export function patientHeader(matchState: PatientMatchState): PatientHeaderModel {
  if (matchState === "merged") {
    // A merged record is a tombstone pointing elsewhere. Showing it as a patient
    // screen would present a record that is deliberately no longer the live one.
    return { matchState, render: false, warning: null, showsClinicalFacts: false };
  }
  if (matchState === "confirmed") {
    return { matchState, render: true, warning: null, showsClinicalFacts: true };
  }
  return {
    matchState,
    render: true,
    warning: matchState === "uncertain" ? UNCERTAIN_WARNING : DUPLICATE_WARNING,
    showsClinicalFacts: false,
  };
}

/** Roles permitted to view an unconfirmed patient (Mark, 2026-09-22). */
export const ROLES_PERMITTED_ON_UNCONFIRMED = ["clinician", "practice_manager"] as const;

export function mayViewUnconfirmed(roles: readonly string[]): boolean {
  return roles.some((r) => (ROLES_PERMITTED_ON_UNCONFIRMED as readonly string[]).includes(r));
}
