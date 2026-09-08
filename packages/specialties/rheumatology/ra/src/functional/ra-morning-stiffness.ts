/**
 * @file RA Morning Stiffness Assessment
 * @description Invariant: Uses ObservationPresenceState. Not assessed != absent; unknown != negative.
 */

import type { AssertionValidity, ClinicalTime, EvidenceId } from "@sovereign/domain";
import type { ObservationPresenceState } from "../concepts/ra-observation-presence.js";
import type { ReportingSourceProvenance } from "./ra-functional-status.js";

export interface RaMorningStiffnessAssertion {
  readonly assertionId: string;
  readonly presenceState: ObservationPresenceState;
  readonly durationMinutes?: number;
  readonly diurnalSeverity?: "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";
  readonly observerProvenance: ReportingSourceProvenance;
  readonly effectiveTime: ClinicalTime;
  readonly validity: AssertionValidity;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
