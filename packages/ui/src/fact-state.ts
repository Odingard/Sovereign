/**
 * @file Clinical fact state presentation (WO-002B S1-19)
 * @description How each fact state is shown, and the rule that governs all of them.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.5, AGENTS.md doctrine 7.
 *
 * > Unknown is not negative.
 *
 * That is the rule this file exists to enforce in the interface. A screen that renders
 * an unknown TB screening the same way it renders a negative one has told the
 * clinician something false, and it has done so in the one channel a clinician
 * actually reads. The domain models `unknown` as a first-class state; the UI has to
 * keep it visible as one.
 *
 * Colour is never the only signal (WCAG 2.2 AA, PRD NFR-007). Every state carries a
 * label and an icon name as well, so the distinction survives a monochrome screen, a
 * colour-blind reader, and a screen reader.
 */

export type FactState = "current" | "superseded" | "conflict" | "stale" | "unknown";
export type FactOrigin = "recorded" | "derived" | "human_correction";

export type StateTone = "neutral" | "informational" | "caution" | "warning";

export interface FactStatePresentation {
  /** Visible text. Never abbreviated to a single character. */
  readonly label: string;
  /** Icon name, so the state survives without colour. */
  readonly icon: string;
  readonly tone: StateTone;
  /** Announced by a screen reader. Says what the state MEANS, not what it is called. */
  readonly description: string;
  /** True when a clinician should not act on this fact without checking. */
  readonly requiresVerification: boolean;
}

export const FACT_STATE_PRESENTATION: Readonly<Record<FactState, FactStatePresentation>> = {
  current: {
    label: "Current",
    icon: "check-circle",
    tone: "neutral",
    description: "Recorded and not superseded.",
    requiresVerification: false,
  },
  superseded: {
    label: "Superseded",
    icon: "archive",
    tone: "informational",
    description: "Replaced by a later record. Kept for history.",
    requiresVerification: true,
  },
  conflict: {
    label: "Conflicting sources",
    icon: "alert-triangle",
    tone: "warning",
    description: "Sources disagree about this fact. Neither has been accepted.",
    requiresVerification: true,
  },
  stale: {
    label: "Out of date",
    icon: "clock",
    tone: "caution",
    description: "Older than the review window for this kind of fact. Not necessarily wrong.",
    requiresVerification: true,
  },
  unknown: {
    // NOT "Negative", "None", "No result" or an empty cell. Every one of those reads
    // as an answer, and the whole point is that there isn't one.
    label: "Not known",
    icon: "help-circle",
    tone: "caution",
    // Deliberately avoids "no result" and "none": as a phrase, either reads as an
    // answer. The disclaimer is stated positively rather than as a denial, because a
    // reader skimming catches "nothing recorded" faster than "not negative".
    description:
      "Nothing has been recorded for this. Absence of a record is not evidence of absence.",
    requiresVerification: true,
  },
} as const;

export const FACT_ORIGIN_PRESENTATION: Readonly<
  Record<FactOrigin, { label: string; description: string }>
> = {
  recorded: { label: "Recorded", description: "Taken directly from a source document." },
  derived: { label: "Derived", description: "Computed from other facts. Not directly observed." },
  human_correction: {
    label: "Corrected",
    description: "A person corrected an earlier record. Both are retained.",
  },
} as const;

/**
 * Words that must never be used to present an unknown fact.
 *
 * Exported so a test can enforce it. The failure this guards against is a well-meaning
 * copy change — "No result" reads better than "Not known" in a design review and is
 * clinically false.
 */
export const FORBIDDEN_UNKNOWN_LABELS = [
  "negative",
  "none",
  "no result",
  "not present",
  "absent",
  "normal",
  "clear",
  "n/a",
] as const;

/** Whether acting on this fact without checking is safe. */
export function isSafeToActOn(state: FactState): boolean {
  return FACT_STATE_PRESENTATION[state].requiresVerification === false;
}
