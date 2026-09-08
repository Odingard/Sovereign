/**
 * @file RA Treatment Interruption & Operational Holds
 * @description Invariant: Non-boolean lifecycle state. Represents clinical hold facts without guessing resumption.
 */

import type { ClinicalTime, EvidenceId } from "@sovereign/domain";
import type { TherapyLifecycleStatus } from "../therapy-history/ra-therapy-status.js";

export enum HoldReasonCategory {
  ACUTE_INFECTION = "ACUTE_INFECTION",
  PERIOPERATIVE_HOLD = "PERIOPERATIVE_HOLD",
  LABORATORY_TOXICITY = "LABORATORY_TOXICITY",
  PATIENT_DECISION = "PATIENT_DECISION",
  UNKNOWN = "UNKNOWN",
}

export interface RaTreatmentInterruptionRecord {
  readonly interruptionId: string;
  readonly exposureId: string;
  readonly status: TherapyLifecycleStatus.HELD;
  readonly holdReason: HoldReasonCategory;
  readonly holdStartTime: ClinicalTime;
  readonly plannedResumeTime?: ClinicalTime;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}
