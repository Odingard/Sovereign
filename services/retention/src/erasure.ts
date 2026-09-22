/**
 * @file Erasure decisions (WO-002C S1-16)
 * @description Whether an erasure may proceed, and what it destroys.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.8, S1-D20, ADR-0007.
 *
 * Erasure in Sovereign is crypto-shred, not deletion. The per-tenant DEK version is
 * destroyed; ciphertext stays where it is and becomes permanently unreadable, and
 * tombstone rows keep identifiers and hashes so the audit chain and foreign keys
 * survive. Deleting rows instead would break the hash chain for every event after the
 * deletion point and make the whole audit record unverifiable — the record would be
 * destroyed along with the data.
 *
 * The order of checks below is deliberate and is the point of this file:
 *
 *   legal hold  ->  dual-control approval  ->  execute  ->  certificate
 *
 * The hold is checked FIRST, before approval is even considered. An approved erasure
 * that runs under a hold is a spoliation problem, not a bug: it cannot be undone and
 * it is the kind of thing that ends up in front of a court. Two approvals do not
 * override a hold, and the code should not be arrangeable so that they might.
 */

import { sha256Hex } from "@sovereign/crypto";

export type ErasureScope = "tenant" | "patient";

export interface LegalHold {
  readonly holdId: string;
  readonly scope: ErasureScope;
  readonly subjectId: string | null;
  readonly reason: string;
  readonly releasedAt: Date | null;
}

export interface ErasureRequest {
  readonly requestId: string;
  readonly tenantId: string;
  readonly scope: ErasureScope;
  readonly subjectId: string | null;
  readonly reason: string;
  readonly requestedBy: string;
  readonly approvedBy: string | null;
  /** Contract termination is a precondition for tenant erasure (§7.8). */
  readonly contractTerminationVerified: boolean;
}

export type ErasureRefusal =
  | "legal_hold_active"
  | "dual_control_required"
  | "self_approval"
  | "contract_not_terminated"
  | "reason_required";

export class ErasureRefusedError extends Error {
  constructor(
    readonly refusal: ErasureRefusal,
    readonly detail: string,
  ) {
    super(`Erasure refused: ${refusal}`);
    this.name = "ErasureRefusedError";
  }
}

/**
 * Holds that block a given erasure.
 *
 * A TENANT-scoped hold blocks everything, including a single-patient erasure. A
 * patient-scoped hold blocks only that patient. The asymmetry matters: a hold placed
 * over an entire tenant must not be circumvented by erasing its patients one at a
 * time.
 */
export function blockingHolds(
  request: Pick<ErasureRequest, "scope" | "subjectId">,
  holds: readonly LegalHold[],
): readonly LegalHold[] {
  return holds.filter((hold) => {
    if (hold.releasedAt !== null) {
      return false;
    }
    if (hold.scope === "tenant") {
      return true;
    }
    return request.scope === "patient" && hold.subjectId === request.subjectId;
  });
}

export interface ErasurePlan {
  readonly requestId: string;
  readonly tenantId: string;
  readonly scope: ErasureScope;
  readonly subjectId: string | null;
  /** Crypto-shred, never row deletion. */
  readonly action: "destroy_key_version";
  readonly tombstoneRetains: readonly ["identifiers", "hashes"];
  readonly auditAction: "tenant.erased" | "patient.erased";
}

/**
 * Decide whether an erasure may proceed.
 *
 * Throws rather than returning a boolean: a caller who forgets to check a return value
 * destroys data irrecoverably, and that is the wrong failure mode to leave available.
 */
export function planErasure(request: ErasureRequest, holds: readonly LegalHold[]): ErasurePlan {
  // FIRST. Before approval, before anything. Two approvals do not override a hold.
  const blocking = blockingHolds(request, holds);
  if (blocking.length > 0) {
    throw new ErasureRefusedError(
      "legal_hold_active",
      `Blocked by ${blocking.length} active legal hold(s): ${blocking.map((h) => h.holdId).join(", ")}`,
    );
  }

  if (request.reason.trim().length === 0) {
    throw new ErasureRefusedError("reason_required", "An erasure must record why");
  }
  if (request.approvedBy === null) {
    throw new ErasureRefusedError("dual_control_required", "Erasure requires a second approver");
  }
  if (request.approvedBy === request.requestedBy) {
    throw new ErasureRefusedError("self_approval", "The approver must differ from the requester");
  }
  if (request.scope === "tenant" && !request.contractTerminationVerified) {
    throw new ErasureRefusedError(
      "contract_not_terminated",
      "Tenant erasure requires verified contract termination",
    );
  }

  return {
    requestId: request.requestId,
    tenantId: request.tenantId,
    scope: request.scope,
    subjectId: request.subjectId,
    action: "destroy_key_version",
    tombstoneRetains: ["identifiers", "hashes"],
    auditAction: request.scope === "tenant" ? "tenant.erased" : "patient.erased",
  };
}

export interface DestructionCertificate {
  readonly requestId: string;
  readonly tenantId: string;
  readonly scope: ErasureScope;
  readonly subjectId: string | null;
  readonly destroyedKeyVersion: number;
  readonly executedAt: string;
  readonly requestedBy: string;
  readonly approvedBy: string;
  readonly certificateHash: string;
}

/**
 * Certificate of destruction (§7.8).
 *
 * Hashed over its own content so it cannot be altered after the fact. It deliberately
 * names both the requester and the approver: a certificate that records only "erased"
 * proves nothing about who authorised it, and that is the question asked after the
 * fact.
 */
export function issueDestructionCertificate(
  plan: ErasurePlan,
  destroyedKeyVersion: number,
  requestedBy: string,
  approvedBy: string,
  executedAt: Date,
): DestructionCertificate {
  const body = {
    requestId: plan.requestId,
    tenantId: plan.tenantId,
    scope: plan.scope,
    subjectId: plan.subjectId,
    destroyedKeyVersion,
    executedAt: executedAt.toISOString(),
    requestedBy,
    approvedBy,
  };
  return { ...body, certificateHash: sha256Hex(JSON.stringify(body)) };
}
