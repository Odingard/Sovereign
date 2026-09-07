/**
 * @file Versioning Model: Domain Concurrency vs. Serialization Schema
 * @description Distinguishes domain aggregateVersion from serialization schemaVersion.
 * Invariant: Schema migrations or contract changes do not artificially advance the clinical history.
 */

export interface VersionedAggregateIdentity {
  /** Domain concurrency and state evolution version (starts at 1, incremented on state mutations) */
  readonly aggregateVersion: number;
  /** Serialization schema contract version (e.g., 1 for initial canonical schema, 2 after upcasting) */
  readonly schemaVersion: number;
}

export const CANONICAL_SCHEMA_VERSION = 1;
