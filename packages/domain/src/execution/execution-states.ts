/**
 * @file Execution State Separations: Node State vs. External Attempt State
 * @description Invariant: Node lifecycle state is strictly separated from external attempt wire state.
 * Attempting or transmitting work does NOT equal clinical-objective completion.
 */

/**
 * Internal Execution Node State (orchestration lifecycle)
 */
export enum ExecutionNodeState {
  PENDING = "PENDING",
  READY = "READY",
  IN_PROGRESS = "IN_PROGRESS",
  BLOCKED = "BLOCKED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  SUPERSEDED = "SUPERSEDED",
}

/**
 * External Execution / Transaction Attempt State (adapter/wire lifecycle)
 */
export enum ExternalAttemptState {
  ATTEMPTED = "ATTEMPTED",
  TRANSMITTED = "TRANSMITTED",
  RECEIVED = "RECEIVED",
  ACCEPTED = "ACCEPTED",
  UNKNOWN = "UNKNOWN",
  FAILED = "FAILED",
  CONFIRMED = "CONFIRMED",
}
