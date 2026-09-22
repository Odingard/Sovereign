/**
 * @file Break-glass emergency access policy (WO-002B, S1-09/S1-10)
 * @description The rules for emergency PHI access. Pure policy, no I/O.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §6.3, ADR-0010, AGENTS.md doctrine 17.
 *
 * > `support_readonly` cannot read PHI columns by default. Emergency PHI access
 * > requires `breakglass:request` → dual approval → time-boxed grant (max 4 h) →
 * > every read audited with `reason` mandatory. Alert fires on activation. AI
 * > principals can never use break-glass.
 *
 * Break-glass exists because the alternative is worse. A support engineer facing a
 * clinical emergency at 3am with no path to the data will find one anyway — a shared
 * login, a colleague's session, a database console — and none of those leave a record.
 * A designed path that is loud, narrow and time-boxed is safer than an undesigned one
 * that is silent.
 *
 * "Loud" is the part that carries the weight. Every constraint here is about making
 * the access impossible to take quietly, not about making it hard to take. Someone
 * with a genuine emergency should get through in seconds. Someone without one should
 * find that they cannot do it alone, cannot do it without saying why, cannot do it
 * without it ending by itself, and cannot do it without somebody being told.
 */

import { ActorKind } from "../identity/actor.js";

/** Spec §6.3. Not configurable — a tenant cannot widen its own emergency window. */
export const BREAK_GLASS_MAX_DURATION_MS = 4 * 60 * 60 * 1000;

/** A reason shorter than this is not a reason. */
export const BREAK_GLASS_MIN_REASON_LENGTH = 20;

export enum BreakGlassRefusal {
  AI_PRINCIPAL = "BREAK_GLASS_AI_PRINCIPAL",
  INSUFFICIENT_APPROVALS = "BREAK_GLASS_INSUFFICIENT_APPROVALS",
  SELF_APPROVAL = "BREAK_GLASS_SELF_APPROVAL",
  REASON_MISSING = "BREAK_GLASS_REASON_MISSING",
  DURATION_EXCEEDS_MAXIMUM = "BREAK_GLASS_DURATION_EXCEEDS_MAXIMUM",
  DURATION_NOT_POSITIVE = "BREAK_GLASS_DURATION_NOT_POSITIVE",
}

export interface BreakGlassRequest {
  readonly tenantId: string;
  readonly requestedByActorId: string;
  readonly requestedByActorKind: ActorKind;
  /** Free text from the requester. Recorded verbatim on every read under the grant. */
  readonly reason: string;
  readonly requestedDurationMs: number;
  /** Distinct approver ids. Two are required and neither may be the requester. */
  readonly approverActorIds: readonly string[];
  readonly patientIdScope?: string;
}

export type BreakGlassEvaluation =
  | { readonly granted: true; readonly expiresAt: Date; readonly alert: BreakGlassAlert }
  | { readonly granted: false; readonly refusal: BreakGlassRefusal };

/** What fires on activation. Carries no PHI — a patient id is an identifier, not content. */
export interface BreakGlassAlert {
  readonly tenantId: string;
  readonly actorId: string;
  readonly approvedBy: readonly string[];
  readonly expiresAt: Date;
  readonly patientIdScope: string | null;
}

/**
 * Decide a break-glass request.
 *
 * Refusals are returned rather than thrown, and are ordered deliberately: the AI check
 * comes first, because an AI principal must be refused before any human-shaped
 * reasoning about approvals and reasons is applied to it. There is no configuration,
 * no emergency, and no approval that makes it permissible (AGENTS.md doctrine 9 and
 * the WO-002 invariant). Treating it as "a caller that failed some checks" would make
 * it one bug away from being a caller that passed them.
 */
export function evaluateBreakGlassRequest(
  request: BreakGlassRequest,
  serverNow: Date,
): BreakGlassEvaluation {
  if (
    request.requestedByActorKind === ActorKind.AI_AGENT_RUNTIME ||
    request.requestedByActorKind === ActorKind.SOVEREIGN_SERVICE
  ) {
    return { granted: false, refusal: BreakGlassRefusal.AI_PRINCIPAL };
  }

  const approvers = [...new Set(request.approverActorIds)];
  if (approvers.includes(request.requestedByActorId)) {
    // Checked before the count, so approving your own request and padding it with one
    // other person reports the self-approval rather than "you need more approvers".
    return { granted: false, refusal: BreakGlassRefusal.SELF_APPROVAL };
  }
  if (approvers.length < 2) {
    return { granted: false, refusal: BreakGlassRefusal.INSUFFICIENT_APPROVALS };
  }

  // A reason is mandatory because every read under this grant is audited with it. A
  // blank or token reason makes that audit trail worthless at the moment somebody
  // most needs to read it — which is the only moment it is ever read.
  if (request.reason.trim().length < BREAK_GLASS_MIN_REASON_LENGTH) {
    return { granted: false, refusal: BreakGlassRefusal.REASON_MISSING };
  }

  if (request.requestedDurationMs <= 0) {
    return { granted: false, refusal: BreakGlassRefusal.DURATION_NOT_POSITIVE };
  }
  if (request.requestedDurationMs > BREAK_GLASS_MAX_DURATION_MS) {
    // Refused, NOT silently clamped to the maximum. A caller who asked for 24 hours
    // and was quietly given 4 will plan around 24 and be surprised in the middle of
    // whatever the emergency was. Refusing tells them now.
    return { granted: false, refusal: BreakGlassRefusal.DURATION_EXCEEDS_MAXIMUM };
  }

  const expiresAt = new Date(serverNow.getTime() + request.requestedDurationMs);
  return {
    granted: true,
    expiresAt,
    alert: {
      tenantId: request.tenantId,
      actorId: request.requestedByActorId,
      approvedBy: [...approvers].sort(),
      expiresAt,
      patientIdScope: request.patientIdScope ?? null,
    },
  };
}

/**
 * Whether a read under a break-glass grant may proceed.
 *
 * Separate from the grant decision because the grant is issued once and read against
 * many times. An expired grant that is still in the database must refuse — expiry is
 * a property checked at use, not a cleanup job that might not have run.
 */
export function mayReadUnderBreakGlass(
  grant: { readonly expiresAt: Date; readonly revokedAt?: Date | null },
  serverNow: Date,
  readReason: string,
): boolean {
  if (grant.revokedAt != null && grant.revokedAt <= serverNow) {
    return false;
  }
  if (grant.expiresAt <= serverNow) {
    return false;
  }
  // Mandatory per read, not only per grant (§6.3). One reason given four hours ago
  // does not explain what somebody is looking at now.
  return readReason.trim().length >= BREAK_GLASS_MIN_REASON_LENGTH;
}
