/**
 * @file RA Imaging Evidence Assertions
 * @description Invariant: Structural findings use ObservationPresenceState. Not assessed != absent; unknown != negative.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";
import { ObservationPresenceState } from "../concepts/ra-observation-presence.js";

export enum ImagingModality {
  PLAIN_RADIOGRAPH = "PLAIN_RADIOGRAPH",
  ULTRASOUND_POWER_DOPPLER = "ULTRASOUND_POWER_DOPPLER",
  MAGNETIC_RESONANCE_IMAGING = "MAGNETIC_RESONANCE_IMAGING",
  COMPUTED_TOMOGRAPHY = "COMPUTED_TOMOGRAPHY",
}

export interface RaImagingAssertion {
  readonly assertionId: string;
  readonly modality: ImagingModality;
  readonly anatomicalRegion: string; // e.g. "HANDS_AND_WRISTS", "FEET"
  readonly erosions: ObservationPresenceState;
  readonly jointSpaceNarrowing: ObservationPresenceState;
  readonly activeSynovitis: ObservationPresenceState;
  readonly narrativeSummary?: string; // Supplemental human annotation; NOT deterministic logic
  readonly imagingTime: ClinicalTime;
  readonly supportingEvidenceId: EvidenceId;
}
