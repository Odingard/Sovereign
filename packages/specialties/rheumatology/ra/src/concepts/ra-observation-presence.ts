/**
 * @file Unknown-Safe Clinical Observation Presence State
 * @description Invariant: Unknown is NEVER negative. Not assessed is NEVER absent.
 */

export enum ObservationPresenceState {
  PRESENT = "PRESENT", // Explicitly assessed and documented as present
  ABSENT = "ABSENT", // Explicitly assessed and documented as absent
  NOT_ASSESSED = "NOT_ASSESSED", // Specifically omitted or not evaluated in encounter
  UNKNOWN = "UNKNOWN", // Information missing from record or epistemic uncertainty
}

export function isObservationConfirmedPresent(state: ObservationPresenceState): boolean {
  return state === ObservationPresenceState.PRESENT;
}

export function isObservationConfirmedAbsent(state: ObservationPresenceState): boolean {
  return state === ObservationPresenceState.ABSENT;
}

export function isObservationUncertainOrUnassessed(state: ObservationPresenceState): boolean {
  return (
    state === ObservationPresenceState.NOT_ASSESSED || state === ObservationPresenceState.UNKNOWN
  );
}
