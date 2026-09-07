/**
 * @file Discriminated Sovereign Aggregate Domain Events
 * @description Strongly typed payloads for audit, outbox, and event streaming.
 */

import type { EpistemicStatus } from "../common/epistemic-status.js";
import type {
  EvidenceId,
  ExecutionGraphId,
  ExecutionNodeId,
  IntentId,
  TherapyAccessCaseId,
} from "../common/identifiers.js";
import type { DomainEvent } from "./domain-event.js";

export interface ClinicalEvidenceRecordedPayload {
  readonly evidenceId: EvidenceId;
  readonly sourceLocator: string;
  readonly sourceSystem: string;
  readonly contentHash: string;
}

export type ClinicalEvidenceRecordedEvent = DomainEvent<
  "ClinicalEvidenceRecorded",
  ClinicalEvidenceRecordedPayload
>;

export interface ClinicalAssertionCreatedPayload {
  readonly stateId: string;
  readonly assertionId: string;
  readonly conceptCode: string;
  readonly epistemicStatus: EpistemicStatus;
  readonly supportingEvidenceIds: ReadonlyArray<EvidenceId>;
}

export type ClinicalAssertionCreatedEvent = DomainEvent<
  "ClinicalAssertionCreated",
  ClinicalAssertionCreatedPayload
>;

export interface ClinicalIntentTransitionedPayload {
  readonly intentId: IntentId;
  readonly previousStage: string;
  readonly newStage: string;
  readonly authorityReference?: string;
}

export type ClinicalIntentTransitionedEvent = DomainEvent<
  "ClinicalIntentTransitioned",
  ClinicalIntentTransitionedPayload
>;

export interface ClinicalIntentSupersededPayload {
  readonly intentId: IntentId;
  readonly supersededByIntentId: IntentId;
}

export type ClinicalIntentSupersededEvent = DomainEvent<
  "ClinicalIntentSuperseded",
  ClinicalIntentSupersededPayload
>;

export interface ExecutionNodeCompletedPayload {
  readonly graphId: ExecutionGraphId;
  readonly nodeId: ExecutionNodeId;
  readonly externalReferenceId: string;
  readonly verifyingEvidenceId: EvidenceId;
}

export type ExecutionNodeCompletedEvent = DomainEvent<
  "ExecutionNodeCompleted",
  ExecutionNodeCompletedPayload
>;

export interface TherapyAccessStageChangedPayload {
  readonly caseId: TherapyAccessCaseId;
  readonly previousStage: string;
  readonly newStage: string;
}

export type TherapyAccessStageChangedEvent = DomainEvent<
  "TherapyAccessStageChanged",
  TherapyAccessStageChangedPayload
>;

export type SovereignDomainEvent =
  | ClinicalEvidenceRecordedEvent
  | ClinicalAssertionCreatedEvent
  | ClinicalIntentTransitionedEvent
  | ClinicalIntentSupersededEvent
  | ExecutionNodeCompletedEvent
  | TherapyAccessStageChangedEvent;
