/**
 * @file Patient merge (WO-002B S1-14)
 * @description Who may merge, what a merge does, and how a wrong one is corrected.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.2, and the clinical decisions in
 * docs/clinical-decisions/S1-14-patient-matching.md (Mark, 2026-09-22).
 *
 * Decided:
 *   - Only `clinician` and `practice_manager` may merge. A medical assistant may not.
 *   - A reason is mandatory.
 *   - Both records are preserved. `merged_into` points at the survivor; nothing is
 *     deleted (ADR-0001).
 *   - There is NO SPLIT in Stage 1. A wrong merge is corrected by a new record, an
 *     audit note, and a PHYSICIAN SIGN-OFF.
 *
 * The asymmetry in that last point is deliberate and is encoded here rather than left
 * to convention: a practice manager may MAKE a merge, but only a physician may sign
 * off CORRECTING one. Merging two records is an operational act. Declaring that two
 * records are in fact two different people is a clinical one.
 *
 * An AI principal can never merge, split, invent or reassign a patient identity
 * (AGENTS.md doctrine 9). That is enforced by actor kind, not by role.
 */

export const ROLES_PERMITTED_TO_MERGE = ["clinician", "practice_manager"] as const;
export const ROLES_PERMITTED_TO_SIGN_OFF_CORRECTION = ["clinician"] as const;

export type MergeRefusal =
  | "role_not_permitted"
  | "reason_required"
  | "ai_principal"
  | "same_patient"
  | "target_already_merged";

export class MergeNotPermittedError extends Error {
  constructor(readonly refusal: MergeRefusal) {
    super(`Merge refused: ${refusal}`);
    this.name = "MergeNotPermittedError";
  }
}

export interface MergeRequest {
  readonly sourcePatientId: string;
  readonly survivingPatientId: string;
  readonly reason: string;
  readonly actorRoles: readonly string[];
  /** Domain ActorKind as a string. Anything non-human is refused outright. */
  readonly actorKind: string;
  readonly sourceMatchState: string;
  readonly survivingMatchState: string;
}

export interface MergeEffect {
  readonly sourcePatientId: string;
  readonly survivingPatientId: string;
  /** The source is tombstoned, never deleted. */
  readonly sourceBecomes: { matchState: "merged"; mergedInto: string };
  readonly reason: string;
  readonly auditAction: "patient.merged";
}

export function planMerge(request: MergeRequest): MergeEffect {
  // AGENTS.md doctrine 9: tenant and patient identity may never be invented or
  // altered by an AI agent. Checked before role, because a role check would pass for
  // an AI principal impersonating a permitted role.
  if (request.actorKind !== "HUMAN_CLINICIAN" && request.actorKind !== "HUMAN_STAFF") {
    throw new MergeNotPermittedError("ai_principal");
  }
  if (
    !request.actorRoles.some((r) => (ROLES_PERMITTED_TO_MERGE as readonly string[]).includes(r))
  ) {
    throw new MergeNotPermittedError("role_not_permitted");
  }
  if (request.reason.trim().length === 0) {
    throw new MergeNotPermittedError("reason_required");
  }
  if (request.sourcePatientId === request.survivingPatientId) {
    throw new MergeNotPermittedError("same_patient");
  }
  // Merging into an already-merged record would chain tombstones and make the
  // surviving identity ambiguous.
  if (request.survivingMatchState === "merged") {
    throw new MergeNotPermittedError("target_already_merged");
  }

  return {
    sourcePatientId: request.sourcePatientId,
    survivingPatientId: request.survivingPatientId,
    sourceBecomes: { matchState: "merged", mergedInto: request.survivingPatientId },
    reason: request.reason,
    auditAction: "patient.merged",
  };
}

export type CorrectionRefusal = "physician_signoff_required" | "reason_required";

export class MergeCorrectionNotPermittedError extends Error {
  constructor(readonly refusal: CorrectionRefusal) {
    super(`Merge correction refused: ${refusal}`);
    this.name = "MergeCorrectionNotPermittedError";
  }
}

export interface MergeCorrectionRequest {
  readonly wronglyMergedPatientId: string;
  readonly reason: string;
  /** Roles of the signing physician, not of whoever noticed the error. */
  readonly signOffRoles: readonly string[];
}

export interface MergeCorrectionEffect {
  readonly supersededPatientId: string;
  readonly reason: string;
  readonly requiresNewPatientRecord: true;
  readonly auditAction: "patient.merge_corrected";
}

/**
 * Correct a wrong merge.
 *
 * There is no unmerge. The original merge stands in the record, and a new patient
 * record is created alongside an audit note explaining it. That keeps history
 * append-only (ADR-0001) and means the mistake is visible rather than erased.
 *
 * Requires a physician sign-off even though a practice manager could have made the
 * merge — see the file header.
 */
export function planMergeCorrection(request: MergeCorrectionRequest): MergeCorrectionEffect {
  if (
    !request.signOffRoles.some((r) =>
      (ROLES_PERMITTED_TO_SIGN_OFF_CORRECTION as readonly string[]).includes(r),
    )
  ) {
    throw new MergeCorrectionNotPermittedError("physician_signoff_required");
  }
  if (request.reason.trim().length === 0) {
    throw new MergeCorrectionNotPermittedError("reason_required");
  }
  return {
    supersededPatientId: request.wronglyMergedPatientId,
    reason: request.reason,
    requiresNewPatientRecord: true,
    auditAction: "patient.merge_corrected",
  };
}

/** Stage 1 does not support split. Stated in code so it is not quietly added. */
export const SPLIT_SUPPORTED_IN_STAGE_1 = false;
