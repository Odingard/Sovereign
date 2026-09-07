/**
 * @file Sovereign Domain Error Hierarchy
 */

export abstract class SovereignDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvariantViolationError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_INVARIANT_VIOLATION");
  }
}

export class AuthorityMissingError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_AUTHORITY_MISSING");
  }
}

export class EpistemicViolationError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_EPISTEMIC_VIOLATION");
  }
}

export class ConcurrencyConflictError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_CONCURRENCY_CONFLICT");
  }
}

export class TenantIsolationError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_TENANT_ISOLATION_BREACH");
  }
}

export class PatientIsolationError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_PATIENT_ISOLATION_BREACH");
  }
}

export class SupersededEntityError extends SovereignDomainError {
  constructor(message: string) {
    super(message, "ERR_ENTITY_SUPERSEDED");
  }
}
