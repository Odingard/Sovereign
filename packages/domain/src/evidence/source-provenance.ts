/**
 * @file Source & Provenance Metadata
 * @description Immutable source artifact reference and ingestion custody.
 */

/**
 * By what MECHANISM a fact reached Sovereign from its source artifact.
 *
 * ADR-0014: this enum describes mechanism, never authenticity. Whether the underlying
 * data is real, synthetic or de-identified is carried by `DataProvenanceOrigin`, and
 * the two are deliberately orthogonal.
 *
 * No member of this enum may ever mean "this isn't real". Such a value invites a
 * production branch that behaves differently for synthetic data — and a branch that
 * only runs for synthetic data is one that is never exercised against real data
 * before it matters.
 */
export enum ExtractionLineage {
  HUMAN_CLINICIAN_ENTERED = "HUMAN_CLINICIAN_ENTERED",
  DETERMINISTIC_PARSER = "DETERMINISTIC_PARSER",
  AI_CANDIDATE_VERIFIED = "AI_CANDIDATE_VERIFIED",
  DIRECT_LAB_FEED = "DIRECT_LAB_FEED",
  IMAGE_STUDY_METADATA = "IMAGE_STUDY_METADATA",
}

export interface SourceProvenanceLocator {
  readonly sourceSystem: string; // e.g. "EPIC_AMBULATORY_V1"
  readonly sourceLocator: string; // e.g. "DocumentReference/789123"
  readonly contentMimeType: string; // e.g. "application/pdf" or "application/json"
  readonly contentSha256: string; // SHA-256 hash of raw source artifact
  readonly extractionLineage: ExtractionLineage;
}

/**
 * Environments in which a `SYNTHETIC_*` source system may be ingested.
 *
 * ADR-0014 decision 2. The classification is only worth having if something enforces
 * it; otherwise `SYNTHETIC_SIMULATION` is a comment.
 */
export const SYNTHETIC_SOURCE_PREFIX = "SYNTHETIC_";
export const ENVIRONMENTS_PERMITTING_SYNTHETIC_SOURCES = ["local", "ci", "test"] as const;

export type SovereignEnvironment = "local" | "ci" | "test" | "dev" | "staging" | "prod";

export class SyntheticSourceNotPermittedError extends Error {
  constructor(
    readonly sourceSystem: string,
    readonly environment: SovereignEnvironment,
  ) {
    super(
      `Source system '${sourceSystem}' is synthetic and may not be ingested in environment '${environment}'`,
    );
    this.name = "SyntheticSourceNotPermittedError";
  }
}

/**
 * Reject a synthetic source system outside local, CI and test.
 *
 * Note the direction: this does NOT assert that non-synthetic sources are real. It
 * stops synthetic data being ingested where real data lives, which is the failure that
 * would corrupt a clinical record. The reverse failure — real data in a local
 * environment — is covered by `scripts/verify-synthetic-data.ts` and G0-B.
 */
export function assertSourceSystemPermittedForEnvironment(
  sourceSystem: string,
  environment: SovereignEnvironment,
): void {
  if (!sourceSystem.startsWith(SYNTHETIC_SOURCE_PREFIX)) {
    return;
  }
  const permitted = (ENVIRONMENTS_PERMITTING_SYNTHETIC_SOURCES as readonly string[]).includes(
    environment,
  );
  if (!permitted) {
    throw new SyntheticSourceNotPermittedError(sourceSystem, environment);
  }
}
