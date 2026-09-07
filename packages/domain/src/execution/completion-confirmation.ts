/**
 * @file Structured Completion Confirmation Model
 * @description Invariant: Completion requires structured evidence and external attribution, not merely a hash.
 */

import type { ConfirmationId, EvidenceId, ExecutionNodeId } from "../common/identifiers.js";

export enum ConfirmationChannel {
  ELECTRONIC_PORTAL = "ELECTRONIC_PORTAL",
  EDI_TRANSACTION = "EDI_TRANSACTION",
  DIRECT_EHR_INTERFACE = "DIRECT_EHR_INTERFACE",
  SECURE_COMMUNICATION = "SECURE_COMMUNICATION",
  MANUAL_CLINICAL_VERIFICATION = "MANUAL_CLINICAL_VERIFICATION",
}

export interface CompletionConfirmation {
  readonly confirmationId: ConfirmationId;
  readonly nodeId: ExecutionNodeId;
  readonly externalReferenceId: string; // e.g. Payer Auth #, Prescription Rx #, Appointment #
  readonly verifyingEvidenceId: EvidenceId; // Reference to ClinicalEvidence
  readonly externalTimestamp: Date;
  readonly channel: ConfirmationChannel;
  readonly confirmationPayloadSha256?: string;
  readonly confirmationNarrative: string;
}
