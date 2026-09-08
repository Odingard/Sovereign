/**
 * @file RA Therapy Lifecycle Status
 * @description Invariant: PLANNED is strictly excluded. Planned therapy belongs exclusively to ClinicalIntent.
 * Actual therapy exposure/current treatment requires evidence of real administration/initiation.
 */

export enum TherapyLifecycleStatus {
  ACTIVE = "ACTIVE", // Currently being taken by patient
  INACTIVE = "INACTIVE", // Not currently being taken
  HELD = "HELD", // Temporarily interrupted (infection, surgery, toxicity)
  DISCONTINUED = "DISCONTINUED", // Permanently stopped
  UNKNOWN = "UNKNOWN", // Status uncertain in current records
}

export function isTherapyCurrentlyAdministered(status: TherapyLifecycleStatus): boolean {
  return status === TherapyLifecycleStatus.ACTIVE;
}

export function isTherapyInterruptedOrHeld(status: TherapyLifecycleStatus): boolean {
  return status === TherapyLifecycleStatus.HELD;
}
