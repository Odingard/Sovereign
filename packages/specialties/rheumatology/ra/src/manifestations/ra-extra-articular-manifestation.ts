/**
 * @file RA Extra-Articular Manifestations
 * @description Candidate manifestations pending formal clinical scope approval in the RA Clinical Decision Register.
 * Invariant: Uses ObservationPresenceState.
 */

import type { AssertionValidity, ClinicalTime, EvidenceId } from "@sovereign/domain";
import type { RaExtraArticularManifestationKind } from "../concepts/ra-manifestation-concepts.js";
import type { ObservationPresenceState } from "../concepts/ra-observation-presence.js";

export interface RaExtraArticularManifestationAssertion {
  readonly assertionId: string;
  readonly manifestationKind: RaExtraArticularManifestationKind;
  readonly presenceState: ObservationPresenceState;
  readonly temporalStatus: "HISTORICAL" | "CURRENT_ACTIVE" | "CURRENT_CONTROLLED" | "UNKNOWN";
  readonly effectiveTime: ClinicalTime;
  readonly validity: AssertionValidity;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
