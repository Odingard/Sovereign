import {
  type ExistingPatient,
  FactNotPermittedError,
  MergeCorrectionNotPermittedError,
  MergeNotPermittedError,
  SPLIT_SUPPORTED_IN_STAGE_1,
  artifactContentHash,
  assertFactPermitted,
  briefVisibility,
  demographicsAgree,
  isStale,
  matchPatient,
  mayAttachClinicalFact,
  mayViewUncertainPatient,
  normalizeDateOfBirth,
  normalizeDemographics,
  normalizeName,
  normalizeSex,
  planCorrection,
  planMerge,
  planMergeCorrection,
} from "@sovereign/service-patient-context";
import { describe, expect, it } from "vitest";

const norm = (first: string, last: string, dob: string | null, sex: string | null) =>
  normalizeDemographics({ firstName: first, lastName: last, dateOfBirth: dob, sex });

describe("demographic normalisation (S1-14)", () => {
  it("folds case, whitespace, apostrophes and hyphens", () => {
    expect(normalizeName("  O'Brien-Smith  ")).toBe("obrien smith");
    expect(normalizeName("MARGUERITE")).toBe("marguerite");
  });

  it("folds accents without dropping the letter", () => {
    // Dropping the character would make genuinely different names collide.
    expect(normalizeName("Muñoz")).toBe("munoz");
    expect(normalizeName("Zoë")).toBe("zoe");
  });

  it("strips generational suffixes by default", () => {
    expect(normalizeName("John Smith Jr.")).toBe("john smith");
    expect(normalizeName("Henry Ford III")).toBe("henry ford");
  });

  it("can keep generational suffixes when configured", () => {
    // Clinical question 5 is still open; the behaviour is a flag, not a hardcoded
    // assumption.
    expect(normalizeName("John Smith Jr.", { stripGenerationalSuffixes: false })).toBe(
      "john smith jr",
    );
  });

  it("never strips a name down to nothing", () => {
    expect(normalizeName("Junior")).toBe("junior");
    expect(normalizeName("Jr")).toBe("jr");
  });

  it("returns null for an unparseable date rather than guessing", () => {
    // A wrong date of birth is worse than a missing one: it makes two different
    // people match.
    expect(normalizeDateOfBirth("not-a-date")).toBeNull();
    expect(normalizeDateOfBirth(null)).toBeNull();
    expect(normalizeDateOfBirth("1958-03-14")).toBe("1958-03-14");
  });

  it("normalises only sex values with a definite meaning", () => {
    expect(normalizeSex("Female")).toBe("f");
    expect(normalizeSex("M")).toBe("m");
    // Unknown is not evidence of agreement (AGENTS.md doctrine 7).
    expect(normalizeSex("unknown")).toBeNull();
    expect(normalizeSex("other")).toBeNull();
  });

  it("treats a null on either side as not comparable, never as equal", () => {
    const a = norm("Ann", "Lee", null, "f");
    const b = norm("Ann", "Lee", null, "f");
    // Two records both missing a DOB do not thereby agree about it.
    expect(demographicsAgree(a, b)).toBe(false);
    expect(
      demographicsAgree(
        norm("Ann", "Lee", "1970-01-01", null),
        norm("Ann", "Lee", "1970-01-01", null),
      ),
    ).toBe(false);
  });

  it("agrees only when every comparison field matches", () => {
    expect(
      demographicsAgree(
        norm("Ann", "Lee", "1970-01-01", "f"),
        norm("ANN", "lee", "1970-01-01", "Female"),
      ),
    ).toBe(true);
    expect(
      demographicsAgree(
        norm("Ann", "Lee", "1970-01-01", "f"),
        norm("Ann", "Lee", "1970-01-02", "f"),
      ),
    ).toBe(false);
  });
});

describe("deterministic matching (S1-14)", () => {
  const ANN: ExistingPatient = {
    patientId: "PAT-1",
    demographics: norm("Ann", "Lee", "1970-01-01", "f"),
    matchState: "confirmed",
  };
  const BOB: ExistingPatient = {
    patientId: "PAT-2",
    demographics: norm("Bob", "Ray", "1980-05-05", "m"),
    matchState: "confirmed",
  };
  const existing: ExistingPatient[] = [ANN, BOB];

  it("links on an exact MRN match", () => {
    const result = matchPatient({
      identifier: { sourceSystemId: "SRC-EHR", identifierType: "MRN", valueHash: "abc" },
      identifierMatch: { patientId: "PAT-1" },
      demographics: norm("Different", "Name", "1999-09-09", "f"),
      tenantPatients: existing,
    });
    expect(result).toEqual({
      kind: "identifier_match",
      patientId: "PAT-1",
      matchState: "confirmed",
    });
  });

  it("flags rather than links when demographics match but MRN does not", () => {
    // Mark, 2026-09-22: flag them. The permissive failure — silently merging two
    // people's records — has no safe recovery.
    const result = matchPatient({
      identifier: { sourceSystemId: "SRC-LAB", identifierType: "MRN", valueHash: "zzz" },
      identifierMatch: null,
      demographics: norm("Ann", "Lee", "1970-01-01", "f"),
      tenantPatients: existing,
    });
    expect(result.kind).toBe("uncertain_match");
    if (result.kind === "uncertain_match") {
      expect(result.matchState).toBe("uncertain");
      expect(result.candidatePatientIds).toEqual(["PAT-1"]);
    }
  });

  it("creates a new confirmed patient when nothing matches", () => {
    const result = matchPatient({
      identifier: null,
      identifierMatch: null,
      demographics: norm("Cara", "Nye", "1990-02-02", "f"),
      tenantPatients: existing,
    });
    expect(result).toEqual({ kind: "new_patient", matchState: "confirmed" });
  });

  it("never offers a merged record as a candidate", () => {
    // A merged patient is a tombstone pointing elsewhere; offering it would invite
    // merging into something already merged.
    const result = matchPatient({
      identifier: null,
      identifierMatch: null,
      demographics: norm("Ann", "Lee", "1970-01-01", "f"),
      tenantPatients: [{ ...ANN, matchState: "merged" }],
    });
    expect(result.kind).toBe("new_patient");
  });

  it("reports every candidate when more than one demographic match exists", () => {
    const result = matchPatient({
      identifier: null,
      identifierMatch: null,
      demographics: norm("Ann", "Lee", "1970-01-01", "f"),
      tenantPatients: [
        ANN,
        {
          patientId: "PAT-3",
          demographics: norm("Ann", "Lee", "1970-01-01", "f"),
          matchState: "confirmed",
        },
      ],
    });
    expect(result.kind).toBe("uncertain_match");
    if (result.kind === "uncertain_match") {
      expect(result.candidatePatientIds).toEqual(["PAT-1", "PAT-3"]);
    }
  });

  it("ignores a non-MRN identifier for deterministic linking", () => {
    // Question 7 is still open. Until it is answered, only MRN links.
    const result = matchPatient({
      identifier: { sourceSystemId: "SRC-PAYER", identifierType: "MEMBER_ID", valueHash: "abc" },
      identifierMatch: { patientId: "PAT-2" },
      demographics: norm("Cara", "Nye", "1990-02-02", "f"),
      tenantPatients: existing,
    });
    expect(result.kind).toBe("new_patient");
  });
});

describe("what an uncertain patient permits (S1-14)", () => {
  it("attaches clinical facts only to a confirmed patient", () => {
    expect(mayAttachClinicalFact("confirmed")).toBe(true);
    for (const state of ["uncertain", "duplicate_suspect", "merged"] as const) {
      expect(mayAttachClinicalFact(state)).toBe(false);
    }
  });

  it("renders the brief with a warning rather than suppressing it", () => {
    // Mark, 2026-09-22 (question 2). An empty screen gives no path forward.
    expect(briefVisibility("uncertain")).toEqual({ render: true, requiresIdentityWarning: true });
    expect(briefVisibility("confirmed")).toEqual({ render: true, requiresIdentityWarning: false });
  });

  it("does not render a brief for a merged tombstone", () => {
    expect(briefVisibility("merged").render).toBe(false);
  });

  it("restricts uncertain patients to clinician and practice manager", () => {
    expect(mayViewUncertainPatient(["clinician"])).toBe(true);
    expect(mayViewUncertainPatient(["practice_manager"])).toBe(true);
    expect(mayViewUncertainPatient(["nurse_ma"])).toBe(false);
    expect(mayViewUncertainPatient(["auditor", "support_readonly"])).toBe(false);
  });
});

describe("merge (S1-14)", () => {
  const base = {
    sourcePatientId: "PAT-A",
    survivingPatientId: "PAT-B",
    reason: "Same patient, duplicate created by lab feed",
    actorKind: "HUMAN_CLINICIAN",
    sourceMatchState: "confirmed",
    survivingMatchState: "confirmed",
  };

  it("permits a clinician and a practice manager", () => {
    expect(planMerge({ ...base, actorRoles: ["clinician"] }).auditAction).toBe("patient.merged");
    expect(
      planMerge({ ...base, actorKind: "HUMAN_STAFF", actorRoles: ["practice_manager"] })
        .survivingPatientId,
    ).toBe("PAT-B");
  });

  it("refuses a medical assistant", () => {
    // Mark, 2026-09-22 (question 3).
    expect(() =>
      planMerge({ ...base, actorKind: "HUMAN_STAFF", actorRoles: ["nurse_ma"] }),
    ).toThrow(MergeNotPermittedError);
  });

  it("refuses an AI principal before it ever checks the role", () => {
    // AGENTS.md doctrine 9. A role check alone would pass for an AI principal
    // carrying a permitted role.
    expect(() =>
      planMerge({ ...base, actorKind: "AI_AGENT_RUNTIME", actorRoles: ["clinician"] }),
    ).toThrow(MergeNotPermittedError);
  });

  it("requires a reason", () => {
    expect(() => planMerge({ ...base, actorRoles: ["clinician"], reason: "   " })).toThrow(
      MergeNotPermittedError,
    );
  });

  it("refuses to merge a record into itself or into a tombstone", () => {
    expect(() =>
      planMerge({ ...base, actorRoles: ["clinician"], survivingPatientId: "PAT-A" }),
    ).toThrow(MergeNotPermittedError);
    expect(() =>
      planMerge({ ...base, actorRoles: ["clinician"], survivingMatchState: "merged" }),
    ).toThrow(MergeNotPermittedError);
  });

  it("tombstones the source rather than deleting it", () => {
    const effect = planMerge({ ...base, actorRoles: ["clinician"] });
    expect(effect.sourceBecomes).toEqual({ matchState: "merged", mergedInto: "PAT-B" });
  });
});

describe("correcting a wrong merge (S1-14)", () => {
  it("does not support split in Stage 1", () => {
    expect(SPLIT_SUPPORTED_IN_STAGE_1).toBe(false);
  });

  it("requires a physician sign-off even though a practice manager could merge", () => {
    // The deliberate asymmetry (Mark, 2026-09-22, question 4). Merging is operational;
    // declaring two records to be two different people is clinical.
    expect(() =>
      planMergeCorrection({
        wronglyMergedPatientId: "PAT-A",
        reason: "Different patients; DOB differs in the source record",
        signOffRoles: ["practice_manager"],
      }),
    ).toThrow(MergeCorrectionNotPermittedError);

    expect(
      planMergeCorrection({
        wronglyMergedPatientId: "PAT-A",
        reason: "Different patients; DOB differs in the source record",
        signOffRoles: ["clinician"],
      }).auditAction,
    ).toBe("patient.merge_corrected");
  });

  it("creates a new record rather than erasing the merge", () => {
    const effect = planMergeCorrection({
      wronglyMergedPatientId: "PAT-A",
      reason: "Different patients",
      signOffRoles: ["clinician"],
    });
    expect(effect.requiresNewPatientRecord).toBe(true);
  });
});

describe("provenance (S1-14)", () => {
  const fact = {
    factId: "FACT-1",
    patientId: "PAT-1",
    factType: "condition",
    sourceArtifactId: "ART-1",
    origin: "recorded" as const,
    state: "current" as const,
    effectiveAt: new Date("2026-01-01T00:00:00Z"),
    supersedes: null,
  };

  it("refuses a fact on an uncertain patient", () => {
    // Unlike a duplicate, a fact on the wrong person is not recoverable by merging.
    expect(() => assertFactPermitted(fact, "uncertain")).toThrow(FactNotPermittedError);
  });

  it("refuses a fact with no source artifact", () => {
    expect(() => assertFactPermitted({ ...fact, sourceArtifactId: "  " }, "confirmed")).toThrow(
      FactNotPermittedError,
    );
  });

  it("refuses a correction that does not say what it corrects", () => {
    expect(() =>
      assertFactPermitted({ ...fact, origin: "human_correction", supersedes: null }, "confirmed"),
    ).toThrow(FactNotPermittedError);
  });

  it("refuses a superseding row that is not marked as a correction", () => {
    // Otherwise a fact quietly replaces another with nobody accountable.
    expect(() =>
      assertFactPermitted({ ...fact, origin: "recorded", supersedes: "FACT-0" }, "confirmed"),
    ).toThrow(FactNotPermittedError);
  });

  it("builds a correction that supersedes without editing the original", () => {
    const effect = planCorrection(fact, {
      factId: "FACT-2",
      patientId: "PAT-1",
      factType: "condition",
      sourceArtifactId: "ART-2",
      effectiveAt: new Date("2026-02-01T00:00:00Z"),
    });
    expect(effect.newFact.origin).toBe("human_correction");
    expect(effect.newFact.supersedes).toBe("FACT-1");
    expect(effect.supersededBecomes).toBe("superseded");
  });

  it("treats an undated fact as not stale", () => {
    // Undated is not old. Treating it as stale would silently downgrade every fact
    // that arrived without a timestamp.
    expect(isStale(null, new Date("2030-01-01"))).toBe(false);
  });

  it("marks a fact stale past the threshold", () => {
    expect(isStale(new Date("2020-01-01"), new Date("2026-01-01"))).toBe(true);
    expect(isStale(new Date("2025-12-01"), new Date("2026-01-01"))).toBe(false);
  });

  it("hashes artifact content deterministically", () => {
    const bytes = new TextEncoder().encode("synthetic artifact");
    expect(artifactContentHash(bytes)).toBe(artifactContentHash(bytes));
    expect(artifactContentHash(bytes)).toMatch(/^[0-9a-f]{64}$/);
  });
});
