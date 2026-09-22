/**
 * @file Demographic normalisation (WO-002B S1-14)
 * @description Canonical forms used for deterministic comparison.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.2, PRD FR-005.
 *
 * Normalisation exists so that "O'Brien" and "OBrien" are compared as the same string.
 * It is NOT a matching decision — two records with the same normalised name are still
 * only a candidate, never an automatic link (Mark, 2026-09-22).
 *
 * Suffix stripping is question 5 of the clinical decision request, still open. It is
 * on by default and configurable. Reasoning for that default: not stripping means
 * "John Smith Jr" and "John Smith" look like different people and quietly become two
 * records; stripping means they look alike and a human is asked. Both paths end in a
 * human or a duplicate, and Mark's principle for question 1 was to prefer asking. Note
 * that Jr and Sr share a name but not a date of birth, so this rarely fires in
 * practice — the match rule requires DOB to agree too.
 */

const GENERATIONAL_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/**
 * Unicode combining marks.
 *
 * `\p{M}` with the `u` flag rather than an explicit \u0300-\u036f range: the property
 * escape covers every combining mark, not only the Latin-1 supplement block, so names
 * outside Latin script fold correctly too.
 */
const COMBINING_MARKS = /\p{M}/gu;

export interface NormalizeOptions {
  /** Pending clinical decision question 5. Default true; see file header. */
  readonly stripGenerationalSuffixes?: boolean;
}

/**
 * Canonical form of a name part.
 *
 * Accents are folded rather than dropped: "Muñoz" becomes "munoz", not "muoz".
 * Dropping the character would make two genuinely different names collide.
 */
export function normalizeName(value: string, options: NormalizeOptions = {}): string {
  const stripSuffixes = options.stripGenerationalSuffixes ?? true;
  let out = value
    .normalize("NFD")
    // Strip combining marks only — the base letter survives.
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/['''`]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripSuffixes) {
    const parts = out.split(" ").filter((p) => p.length > 0);
    while (parts.length > 1) {
      const last = parts[parts.length - 1] as string;
      if (GENERATIONAL_SUFFIXES.has(last)) {
        parts.pop();
      } else {
        break;
      }
    }
    out = parts.join(" ");
  }
  return out;
}

/**
 * Canonical date of birth: YYYY-MM-DD, UTC.
 *
 * Returns null for anything unparseable rather than guessing. A wrong date of birth
 * is worse than a missing one — it makes two different people match.
 */
export function normalizeDateOfBirth(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Canonical sex.
 *
 * Only the values that carry a definite meaning normalise. "unknown", "other" and
 * anything unrecognised return null and therefore never contribute to a match — an
 * unknown value is not evidence of agreement (AGENTS.md doctrine 7).
 */
export function normalizeSex(value: string | null | undefined): "f" | "m" | null {
  if (value === null || value === undefined) {
    return null;
  }
  const v = value.trim().toLowerCase();
  if (v === "f" || v === "female") {
    return "f";
  }
  if (v === "m" || v === "male") {
    return "m";
  }
  return null;
}

export interface Demographics {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string | Date | null;
  readonly sex: string | null;
}

export interface NormalizedDemographics {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string | null;
  readonly sex: "f" | "m" | null;
}

export function normalizeDemographics(
  demographics: Demographics,
  options: NormalizeOptions = {},
): NormalizedDemographics {
  return {
    firstName: normalizeName(demographics.firstName, options),
    lastName: normalizeName(demographics.lastName, options),
    dateOfBirth: normalizeDateOfBirth(demographics.dateOfBirth),
    sex: normalizeSex(demographics.sex),
  };
}

/**
 * Whether two normalised demographic sets agree on every comparison field.
 *
 * A null on either side means "not comparable", never "equal". Two records both
 * missing a date of birth do not thereby agree about it.
 */
export function demographicsAgree(a: NormalizedDemographics, b: NormalizedDemographics): boolean {
  if (a.dateOfBirth === null || b.dateOfBirth === null) {
    return false;
  }
  if (a.sex === null || b.sex === null) {
    return false;
  }
  if (a.firstName.length === 0 || a.lastName.length === 0) {
    return false;
  }
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.dateOfBirth === b.dateOfBirth &&
    a.sex === b.sex
  );
}
