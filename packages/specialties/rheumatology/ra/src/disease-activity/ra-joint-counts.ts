/**
 * @file RA 28-Joint Assessment & Unknown-Safe Homunculus
 * @description Invariant: Individual joints use ObservationPresenceState. Not-assessed != absent; unknown != negative.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";
import type { ObservationPresenceState } from "../concepts/ra-observation-presence.js";

export interface JointHomunculus28 {
  // Shoulders, Elbows, Wrists (left/right)
  readonly leftShoulder: ObservationPresenceState;
  readonly rightShoulder: ObservationPresenceState;
  readonly leftElbow: ObservationPresenceState;
  readonly rightElbow: ObservationPresenceState;
  readonly leftWrist: ObservationPresenceState;
  readonly rightWrist: ObservationPresenceState;

  // MCP joints 1-5 (left/right)
  readonly leftMcp: readonly [
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
  ];
  readonly rightMcp: readonly [
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
  ];

  // PIP joints 1-5 (left/right)
  readonly leftPip: readonly [
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
  ];
  readonly rightPip: readonly [
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
    ObservationPresenceState,
  ];

  // Knees (left/right)
  readonly leftKnee: ObservationPresenceState;
  readonly rightKnee: ObservationPresenceState;
}

export enum ExaminerKind {
  RHEUMATOLOGIST = "RHEUMATOLOGIST",
  TRAINED_CLINICAL_OBSERVER = "TRAINED_CLINICAL_OBSERVER",
  PATIENT_SELF_REPORT = "PATIENT_SELF_REPORT",
  UNKNOWN = "UNKNOWN",
}

export interface RaJointCountObservation {
  readonly observationId: string;
  readonly tenderJointCount28: number; // Confirmed present count (0-28)
  readonly swollenJointCount28: number; // Confirmed present count (0-28)
  readonly tenderHomunculus?: JointHomunculus28;
  readonly swollenHomunculus?: JointHomunculus28;
  readonly examinerKind: ExaminerKind;
  readonly observationTime: ClinicalTime;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
