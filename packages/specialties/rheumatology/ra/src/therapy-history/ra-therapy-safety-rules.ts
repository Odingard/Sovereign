/**
 * @file RA Therapy Safety Rules & Invariant Validators
 * @description Enforces permanent clinical safety invariants:
 * 1. Discontinuation reason requires evidence.
 * 2. Inactive does not infer failure.
 * 3. Planned/ordered intent cannot create therapy exposure without administration evidence.
 */

import { InvariantViolationError } from "@sovereign/domain";
import type { RaTherapyDiscontinuationReason } from "./ra-therapy-discontinuation.js";
import type { RaTherapyExposure } from "./ra-therapy-exposure.js";

export function assertTherapyDiscontinuationReasonHasEvidence(
  reason: RaTherapyDiscontinuationReason,
): void {
  if (!reason.supportingEvidenceIds || reason.supportingEvidenceIds.length === 0) {
    throw new InvariantViolationError(
      `Discontinuation reason '${reason.reasonId}' for exposure '${reason.exposureId}' lacks supporting evidence. Every discontinuation reason requires provenance.`,
    );
  }
}

export function assertTherapyExposureHasEvidence(exposure: RaTherapyExposure): void {
  if (!exposure.exposureEvidenceIds || exposure.exposureEvidenceIds.length === 0) {
    throw new InvariantViolationError(
      `Therapy exposure '${exposure.exposureId}' lacks exposure evidence. Actual physical or administration evidence is required to assert exposure.`,
    );
  }
}
