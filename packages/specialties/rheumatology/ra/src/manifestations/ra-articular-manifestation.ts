/**
 * @file RA Articular Manifestations
 * @description Invariant: Uses ObservationPresenceState. Not assessed != absent; unknown != negative.
 */

import type { AssertionValidity, ClinicalTime, EvidenceId } from "@sovereign/domain";
import type { RaArticularManifestationKind } from "../concepts/ra-manifestation-concepts.js";
import type { ObservationPresenceState } from "../concepts/ra-observation-presence.js";

export interface RaArticularManifestationAssertion {
  readonly assertionId: string;
  readonly manifestationKind: RaArticularManifestationKind;
  readonly anatomicalLocation?: string; // e.g. "RIGHT_WRIST", "MCP2_LEFT"
  readonly presenceState: ObservationPresenceState;
  readonly effectiveTime: ClinicalTime;
  readonly validity: AssertionValidity;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
