/**
 * @file Provenance rules (WO-002B S1-14)
 * @description Fact recording, correction and staleness.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.2, PRD §8.13, ADR-0001, ADR-0002.
 *
 * Three rules, all enforced here and backed by the migration-005 trigger:
 *   - Every fact cites the artifact it came from. A fact with no source is an
 *     assertion nobody can check.
 *   - Facts are insert-only. A correction inserts a NEW row with
 *     origin='human_correction' and `supersedes` set; the old row moves to
 *     'superseded'. Nothing is edited and nothing is deleted.
 *   - `unknown` is a first-class state and is never coerced to negative
 *     (AGENTS.md doctrine 7).
 */

import { sha256Hex } from "@sovereign/crypto";

export type FactOrigin = "recorded" | "derived" | "human_correction";
export type FactState = "current" | "superseded" | "conflict" | "stale" | "unknown";

export interface ClinicalFactInput {
  readonly factId: string;
  readonly patientId: string;
  readonly factType: string;
  readonly sourceArtifactId: string;
  readonly origin: FactOrigin;
  readonly state: FactState;
  readonly effectiveAt: Date | null;
  readonly supersedes: string | null;
}

export type FactRefusal =
  | "source_artifact_required"
  | "correction_must_supersede"
  | "uncertain_patient"
  | "supersedes_requires_correction_origin";

export class FactNotPermittedError extends Error {
  constructor(readonly refusal: FactRefusal) {
    super(`Clinical fact refused: ${refusal}`);
    this.name = "FactNotPermittedError";
  }
}

export function assertFactPermitted(fact: ClinicalFactInput, patientMatchState: string): void {
  // §7.2: no clinical fact attaches to an uncertain patient. Unlike a duplicate, a
  // fact attached to the wrong person is not recoverable by merging.
  if (patientMatchState !== "confirmed") {
    throw new FactNotPermittedError("uncertain_patient");
  }
  if (fact.sourceArtifactId.trim().length === 0) {
    throw new FactNotPermittedError("source_artifact_required");
  }
  if (fact.origin === "human_correction" && fact.supersedes === null) {
    throw new FactNotPermittedError("correction_must_supersede");
  }
  // The reverse: a row that supersedes something must say it is a correction, or the
  // audit trail shows a fact quietly replacing another with no one accountable.
  if (fact.supersedes !== null && fact.origin !== "human_correction") {
    throw new FactNotPermittedError("supersedes_requires_correction_origin");
  }
}

export interface CorrectionEffect {
  readonly newFact: ClinicalFactInput;
  /** The only permitted mutation of an existing fact row. */
  readonly supersededFactId: string;
  readonly supersededBecomes: "superseded";
}

/** Build a correction. The original is never edited beyond its state flag. */
export function planCorrection(
  original: ClinicalFactInput,
  correction: Omit<ClinicalFactInput, "origin" | "supersedes" | "state">,
): CorrectionEffect {
  return {
    newFact: {
      ...correction,
      origin: "human_correction",
      supersedes: original.factId,
      state: "current",
    },
    supersededFactId: original.factId,
    supersededBecomes: "superseded",
  };
}

/** Default staleness threshold; configurable per fact type (§7.2). */
export const DEFAULT_STALE_AFTER_DAYS = 365;

/**
 * Whether a fact is stale.
 *
 * Stale means "old enough that it should not be relied on without checking", not
 * "wrong" and certainly not "absent". A fact with no effective date is NOT stale —
 * it is simply undated, and treating undated as stale would silently downgrade every
 * fact that arrived without a timestamp.
 */
export function isStale(
  effectiveAt: Date | null,
  now: Date,
  staleAfterDays: number = DEFAULT_STALE_AFTER_DAYS,
): boolean {
  if (effectiveAt === null) {
    return false;
  }
  const ageDays = (now.getTime() - effectiveAt.getTime()) / 86_400_000;
  return ageDays > staleAfterDays;
}

/**
 * Content hash of an artifact, computed on ingest.
 *
 * This is what lets a later reader prove the bytes they are holding are the bytes
 * that arrived (ADR-0002 provenance).
 */
export function artifactContentHash(bytes: Uint8Array): string {
  return sha256Hex(bytes);
}
