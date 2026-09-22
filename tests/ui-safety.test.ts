import {
  AA_LARGE_TEXT_CONTRAST,
  AA_TEXT_CONTRAST,
  COLOR,
  FACT_ORIGIN_PRESENTATION,
  FACT_STATE_PRESENTATION,
  FOCUS_RING,
  FORBIDDEN_UNKNOWN_LABELS,
  type FactState,
  MIN_TARGET_PX,
  contrastRatio,
  isSafeToActOn,
  mayViewUnconfirmed,
  patientHeader,
} from "@sovereign/ui";
import { describe, expect, it } from "vitest";

describe("unknown is not negative (S1-19, AGENTS.md doctrine 7)", () => {
  it("never labels or describes an unknown fact with a phrase that reads as an answer", () => {
    // This test caught its own subject on first run: the description read "No result
    // has been recorded", which contains a forbidden phrase. Accurate, and it still
    // reads as an answer at a glance — which is the whole failure mode.
    const unknown = FACT_STATE_PRESENTATION.unknown;
    const text = `${unknown.label} ${unknown.description}`.toLowerCase();
    for (const forbidden of FORBIDDEN_UNKNOWN_LABELS) {
      expect(text, `unknown must not read as "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("states positively that a missing record is not evidence", () => {
    // Positive phrasing, not a denial. A reader skimming catches "nothing recorded"
    // faster than "not negative", and a denial can be misread as its own opposite.
    expect(FACT_STATE_PRESENTATION.unknown.description).toContain("not evidence of absence");
  });

  it("requires verification for every state except current", () => {
    expect(isSafeToActOn("current")).toBe(true);
    for (const state of ["superseded", "conflict", "stale", "unknown"] as FactState[]) {
      expect(isSafeToActOn(state), state).toBe(false);
    }
  });

  it("never relies on colour alone", () => {
    // WCAG 2.2 AA and a monochrome screen. Every state carries a label and an icon.
    for (const [state, presentation] of Object.entries(FACT_STATE_PRESENTATION)) {
      expect(presentation.label.length, state).toBeGreaterThan(1);
      expect(presentation.icon.length, state).toBeGreaterThan(0);
      expect(presentation.description.length, state).toBeGreaterThan(10);
    }
  });

  it("distinguishes stale from wrong", () => {
    // Stale means "check before relying on it", not "incorrect". Conflating them
    // trains clinicians to ignore the badge.
    expect(FACT_STATE_PRESENTATION.stale.description).toContain("Not necessarily wrong");
  });

  it("marks derived facts as not directly observed", () => {
    expect(FACT_ORIGIN_PRESENTATION.derived.description).toContain("Not directly observed");
  });

  it("says both records are kept after a correction", () => {
    expect(FACT_ORIGIN_PRESENTATION.human_correction.description).toContain("retained");
  });
});

describe("unconfirmed patient identity (S1-19, Mark 2026-09-22)", () => {
  it("renders the record with a warning rather than suppressing it", () => {
    const header = patientHeader("uncertain");
    expect(header.render).toBe(true);
    expect(header.warning).not.toBeNull();
  });

  it("makes the warning structurally impossible to dismiss", () => {
    // `dismissible: false` is the only inhabitant of its type. A boolean that could be
    // true would let a caller pass `true` and satisfy the type — a banner dismissed
    // once and forgotten is the exact failure this guards against.
    const warning = patientHeader("uncertain").warning;
    expect(warning?.dismissible).toBe(false);
    expect(warning?.placement).toBe("content");
    expect(warning?.ariaRole).toBe("alert");
  });

  it("gives the clinician a next step", () => {
    // A warning with no resolution path is a dead end, which is what I argued
    // suppression would be. It applies to the warning too.
    const warning = patientHeader("uncertain").warning;
    expect(warning?.resolutionPath.length).toBeGreaterThan(20);
    expect(warning?.resolutionPath).toContain("reconciliation queue");
  });

  it("returns the warning together with permission to render", () => {
    // Not as a separate lookup a caller could skip. Obtaining permission to render
    // means also receiving what must be displayed.
    const header = patientHeader("uncertain");
    expect(Object.keys(header).sort()).toEqual([
      "matchState",
      "render",
      "showsClinicalFacts",
      "warning",
    ]);
  });

  it("shows no clinical facts for an unconfirmed patient", () => {
    // Spec §7.2. Unlike a duplicate, a fact attached to the wrong person is not
    // recoverable by merging.
    expect(patientHeader("uncertain").showsClinicalFacts).toBe(false);
    expect(patientHeader("duplicate_suspect").showsClinicalFacts).toBe(false);
    expect(patientHeader("confirmed").showsClinicalFacts).toBe(true);
  });

  it("warns for a duplicate suspect too", () => {
    expect(patientHeader("duplicate_suspect").warning?.dismissible).toBe(false);
  });

  it("does not render a merged tombstone as a patient screen", () => {
    const header = patientHeader("merged");
    expect(header.render).toBe(false);
    expect(header.warning).toBeNull();
  });

  it("shows no warning for a confirmed patient", () => {
    // Warning fatigue is real. A banner on every screen trains people to skip
    // banners, including the one that matters.
    expect(patientHeader("confirmed").warning).toBeNull();
  });

  it("restricts unconfirmed patients to clinician and practice manager", () => {
    expect(mayViewUnconfirmed(["clinician"])).toBe(true);
    expect(mayViewUnconfirmed(["practice_manager"])).toBe(true);
    expect(mayViewUnconfirmed(["nurse_ma"])).toBe(false);
    expect(mayViewUnconfirmed(["support_readonly", "auditor"])).toBe(false);
  });
});

describe("accessibility tokens (S1-19, WCAG 2.2 AA)", () => {
  it("meets 4.5:1 for body text on both surfaces", () => {
    // Measured, not eyeballed in a design review.
    expect(contrastRatio(COLOR.text, COLOR.surface)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(contrastRatio(COLOR.text, COLOR.surfaceMuted)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
    expect(contrastRatio(COLOR.textMuted, COLOR.surface)).toBeGreaterThanOrEqual(AA_TEXT_CONTRAST);
  });

  it("meets 4.5:1 for every state tone", () => {
    // A warning nobody can read is not a warning.
    for (const tone of ["neutral", "informational", "caution", "warning"] as const) {
      expect(contrastRatio(COLOR[tone], COLOR.surface), tone).toBeGreaterThanOrEqual(
        AA_TEXT_CONTRAST,
      );
    }
  });

  it("meets 3:1 for the focus ring against both surfaces", () => {
    expect(contrastRatio(FOCUS_RING.color, COLOR.surface)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT_CONTRAST,
    );
    expect(contrastRatio(FOCUS_RING.color, COLOR.surfaceMuted)).toBeGreaterThanOrEqual(
      AA_LARGE_TEXT_CONTRAST,
    );
  });

  it("keeps a visible focus ring", () => {
    // A keyboard user who cannot see focus cannot use the interface. `outline: none`
    // is the most common way that happens.
    expect(FOCUS_RING.width).toBeGreaterThanOrEqual(2);
    expect(FOCUS_RING.style).toBe("solid");
  });

  it("meets the 24px minimum target size", () => {
    expect(MIN_TARGET_PX).toBeGreaterThanOrEqual(24);
  });

  it("computes contrast correctly against known values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});
