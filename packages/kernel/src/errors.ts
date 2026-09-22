/**
 * @file Typed error taxonomy (WO-002C S1-06)
 * @description Errors that map to safe HTTP responses.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.7 — "typed taxonomy mapped to safe HTTP
 * codes; `error_code` only, never internal messages, in responses."
 *
 * A response carries a stable machine code and nothing else. Internal messages leak
 * schema names, query text, file paths and occasionally data; they belong in the log
 * (allowlisted) and the audit row, never on the wire.
 */

export enum ErrorCode {
  UNAUTHENTICATED = "E_UNAUTHENTICATED",
  CONTEXT_INVALID = "E_CONTEXT_INVALID",
  CONTEXT_EXPIRED = "E_CONTEXT_EXPIRED",
  SERVICE_IDENTITY_MISSING = "E_SERVICE_IDENTITY_MISSING",
  FORBIDDEN = "E_FORBIDDEN",
  NOT_FOUND = "E_NOT_FOUND",
  MFA_REQUIRED = "E_MFA_REQUIRED",
  DUAL_CONTROL_REQUIRED = "E_DUAL_CONTROL_REQUIRED",
  IDEMPOTENCY_KEY_REQUIRED = "E_IDEMPOTENCY_KEY_REQUIRED",
  IDEMPOTENCY_KEY_REUSED = "E_IDEMPOTENCY_KEY_REUSED",
  CAPABILITY_DISABLED = "E_CAPABILITY_DISABLED",
  TENANT_MISMATCH = "E_TENANT_MISMATCH",
  INTERNAL = "E_INTERNAL",
}

export class SovereignError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    /** Internal only. Never serialised into a response. */
    message: string,
  ) {
    super(message);
    this.name = "SovereignError";
  }

  /** The only shape that ever reaches a client. */
  toWireResponse(): { error: { code: ErrorCode } } {
    return { error: { code: this.code } };
  }
}

export const unauthenticated = (why: string) =>
  new SovereignError(ErrorCode.UNAUTHENTICATED, 401, why);
export const contextInvalid = (why: string) =>
  new SovereignError(ErrorCode.CONTEXT_INVALID, 401, why);
export const contextExpired = (why: string) =>
  new SovereignError(ErrorCode.CONTEXT_EXPIRED, 401, why);
export const serviceIdentityMissing = (why: string) =>
  new SovereignError(ErrorCode.SERVICE_IDENTITY_MISSING, 401, why);
export const forbidden = (why: string) => new SovereignError(ErrorCode.FORBIDDEN, 403, why);
export const mfaRequired = (why: string) => new SovereignError(ErrorCode.MFA_REQUIRED, 403, why);
export const capabilityDisabled = (why: string) =>
  new SovereignError(ErrorCode.CAPABILITY_DISABLED, 503, why);
export const idempotencyKeyRequired = (why: string) =>
  new SovereignError(ErrorCode.IDEMPOTENCY_KEY_REQUIRED, 400, why);
export const idempotencyKeyReused = (why: string) =>
  new SovereignError(ErrorCode.IDEMPOTENCY_KEY_REUSED, 409, why);

/**
 * A dual-control action was attempted without two distinct approvers.
 *
 * 409, per spec §10.9: "Dual control: same user requests and approves → 409." Not 400
 * — the request is well formed. Not 403 either, which was the first choice here and
 * was wrong: 403 says the caller may not do this, when in fact they may, once somebody
 * else agrees. 409 says the request conflicts with the current state of the approval,
 * which is exactly what has happened and is what tells the caller to go and get a
 * second person rather than to give up.
 */
export const dualControlRequired = (why: string) =>
  new SovereignError(ErrorCode.DUAL_CONTROL_REQUIRED, 409, why);

/**
 * A cross-tenant reference is reported as 404, never 403.
 *
 * Spec §10 test 1: "Token of tenant A requests every resource ID belonging to B →
 * 404 (not 403; no existence leak)." A 403 confirms the object exists, which is an
 * enumeration oracle across tenants.
 */
export const notFound = (why: string) => new SovereignError(ErrorCode.NOT_FOUND, 404, why);
