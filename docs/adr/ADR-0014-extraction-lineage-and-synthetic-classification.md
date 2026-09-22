# ADR-0014 — Extraction Lineage Describes Mechanism, Not Authenticity

Status: **Accepted** (Founder, 2026-09-22)

> Accepted by Andre Byrd (Founder), who also routed G-45 from clinical to architecture and
> supplied the three decisions recorded below. Architecture reviewer Roger has **not** reviewed
> this ADR; see G-44 — review for this period is retrospective by Founder decision.

Supersedes nothing. Resolves gap **G-45**, which was opened during WO-002C S1-05 and
initially mis-routed as `REQUIRES CLINICAL DECISION`.

## Context

`ExtractionLineage` (`packages/domain/src/evidence/source-provenance.ts`) enumerates
`HUMAN_CLINICIAN_ENTERED`, `DETERMINISTIC_PARSER`, `AI_CANDIDATE_VERIFIED`,
`DIRECT_LAB_FEED`, `IMAGE_STUDY_METADATA`.

Four test fixtures used invented literals that are not members of that enum —
`SYNTHETIC_GENERATION`, `SYNTHETIC_FIXTURE`, `RAW_INGESTION`, `RAW_FHIR_EXTRACT`.
PR-A2 mapped all four to `DETERMINISTIC_PARSER` and raised G-45 asking whether the
enum was instead missing a synthetic member.

G-45 was filed as a clinical decision. It is not one. The question is what the enum
*means*, which is an architecture question:

- **`ExtractionLineage` answers:** by what mechanism did this fact get from the source
  artifact into Sovereign?
- **`DataProvenanceOrigin` answers:** is the underlying data real, synthetic, or
  de-identified?

These are orthogonal, and `tests/domain-clarifications.test.ts` already asserts that
orthogonality for sensitivity versus origin. Conflating them in the lineage enum would
undo it.

## Decision

1. **No synthetic member is added to `ExtractionLineage`.** A production enum must
   never carry a value meaning "this isn't real". Such a value invites a branch in
   production code that behaves differently for synthetic data — and a branch that
   only executes for synthetic data is, by construction, a branch that is never
   exercised against real data before it matters.

2. **Synthetic-ness is carried by `DataProvenanceOrigin.SYNTHETIC_SIMULATION`, plus a
   `SYNTHETIC_*` naming convention on `sourceSystem`.** To keep that classification
   enforceable rather than decorative, ingestion outside a local or CI environment
   rejects any source system whose name begins with `SYNTHETIC_`. Implemented as
   `assertSourceSystemPermittedForEnvironment`; a test covers both directions.

   This is the useful half of the decision. A classification nothing checks is a
   comment.

3. **The PR-A2 fixture mapping to `DETERMINISTIC_PARSER` stands.** Note a correction
   to the original rationale: the fixtures are object literals constructed in tests,
   not files parsed from disk. The mapping is nonetheless right, for a better reason —
   each fixture *simulates* an ingestion path that is a deterministic parse, and its
   synthetic-ness is recorded beside it in `classification.origin`. The inline
   `PR-A2 mapping:` comments are replaced with a reference to this ADR.

## Consequences

- Positive: one meaning per enum. A reader asking "how did this get here?" and a reader
  asking "is this real?" look in different, correct places.
- Positive: `SYNTHETIC_*` becomes a guard rather than a label, and G0-B gains one more
  mechanical barrier alongside `scripts/verify-synthetic-data.ts`.
- Negative: the `SYNTHETIC_*` prefix is a naming convention, and conventions drift. The
  environment guard limits the damage but does not prevent a synthetic source system
  named something else entirely.
- Negative: test fixtures now claim a lineage they did not literally travel. That is
  the cost of not modelling test-ness in a production enum, and it is the cheaper cost.

## Rejected alternatives

- **Add `SYNTHETIC_GENERATION` to `ExtractionLineage`.** Rejected per decision 1.
- **Add a nullable `isSynthetic` flag to source provenance.** Rejected: duplicates
  `DataProvenanceOrigin`, and two fields that can disagree about the same fact are
  worse than one.
- **Leave the fixtures untyped with a cast.** Rejected: it would hide the question
  rather than answer it, and the next person would re-open it.

## Verification

- `ExtractionLineage` contains no member referring to synthetic or test data.
- `assertSourceSystemPermittedForEnvironment` rejects `SYNTHETIC_*` outside local/CI,
  with tests for both directions.
- No `PR-A2 mapping:` comment remains in the test suite; each cites this ADR.
- G-45 closed.
