/**
 * @file Retention classes (WO-002C S1-16)
 * @description What each class keeps, for how long, and how it ends.
 *
 * Source: config/retention.yaml, docs/DATA_CLASSIFICATION_SCHEDULE.md, S1-D20.
 *
 * The values are duplicated from the YAML deliberately: the YAML is the reviewable
 * source of truth for humans, and this module is what the code reads. A test asserts
 * the two agree, so drift breaks the build rather than quietly changing how long
 * clinical data is kept.
 */

export type RetentionClass =
  | "legal_clinical"
  | "audit"
  | "operational"
  | "recording"
  | "generated_draft"
  | "support"
  | "analytics"
  | "synthetic";

export type ErasureMethod = "crypto_shred" | "purge" | "tombstone";

export interface RetentionRule {
  readonly retainDays: number;
  readonly erasure: ErasureMethod;
  /** True when the period is a legal minimum rather than a preference. */
  readonly minimum: boolean;
  /** False where row deletion would break an append-only structure. */
  readonly rowDeletionPermitted: boolean;
}

export const RETENTION_RULES: Readonly<Record<RetentionClass, RetentionRule>> = {
  legal_clinical: {
    retainDays: 3650,
    erasure: "crypto_shred",
    minimum: true,
    rowDeletionPermitted: false,
  },
  // The chain is hash-linked. Deleting one event breaks verification for every event
  // after it, so audit data is crypto-shredded at the tenant level and never
  // row-deleted.
  audit: { retainDays: 2555, erasure: "crypto_shred", minimum: true, rowDeletionPermitted: false },
  operational: { retainDays: 30, erasure: "purge", minimum: false, rowDeletionPermitted: true },
  recording: { retainDays: 30, erasure: "purge", minimum: false, rowDeletionPermitted: true },
  // A draft carries no authority and must never be retained as though it were a
  // record (ADR-0001).
  generated_draft: {
    retainDays: 90,
    erasure: "purge",
    minimum: false,
    rowDeletionPermitted: true,
  },
  support: { retainDays: 365, erasure: "purge", minimum: false, rowDeletionPermitted: true },
  analytics: { retainDays: 730, erasure: "purge", minimum: false, rowDeletionPermitted: true },
  synthetic: { retainDays: 90, erasure: "purge", minimum: false, rowDeletionPermitted: true },
} as const;

/**
 * Whether data of a class is past its retention period.
 *
 * For a class marked `minimum`, being past the period means erasure becomes
 * PERMITTED, not required. A ten-year clinical minimum is a floor; nothing obliges
 * Sovereign to destroy a record the instant it expires, and a job that did so would
 * be destroying data a clinician may still need.
 */
export function isPastRetention(
  retentionClass: RetentionClass,
  createdAt: Date,
  now: Date,
): boolean {
  const rule = RETENTION_RULES[retentionClass];
  const ageDays = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return ageDays > rule.retainDays;
}

/**
 * Whether an automated job may delete rows of this class.
 *
 * Separate from `isPastRetention` on purpose: expiry and deletability are different
 * questions, and conflating them is how an automated sweep ends up deleting audit
 * rows because they happened to be old.
 */
export function mayRowDelete(retentionClass: RetentionClass): boolean {
  return RETENTION_RULES[retentionClass].rowDeletionPermitted;
}

export function erasureMethodFor(retentionClass: RetentionClass): ErasureMethod {
  return RETENTION_RULES[retentionClass].erasure;
}
