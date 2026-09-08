/**
 * @file Early Access Lead Capture Contracts
 * @description Invariant: Collects business demographic details ONLY.
 * Strictly forbids patient information or PHI collection.
 */

import type { UtmParameters } from "../attribution/utm";

export type PracticeSizeOption =
  | "1-2 clinicians"
  | "3-5 clinicians"
  | "6-15 clinicians"
  | "16+ clinicians";

export type LocationCountOption = "1 location" | "2-4 locations" | "5+ locations";

export type RoleOption =
  | "Rheumatologist / Physician"
  | "Practice Administrator / Executive"
  | "Nurse / Medical Assistant"
  | "Prior Authorization / Access Specialist"
  | "Clinical Operations Director"
  | "Other";

export interface EarlyAccessFormData {
  readonly submissionId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly workEmail: string;
  readonly organization: string;
  readonly role: string;
  readonly practiceSize: string;
  readonly locationCount: string;
  readonly currentEhr?: string;
  readonly message?: string;
  // Anti-bot hidden fields
  readonly honeypot?: string;
  readonly formRenderedAt?: number;
}

export interface LeadSubmissionPayload extends EarlyAccessFormData {
  readonly utm?: UtmParameters;
  readonly submittedAt: string;
  readonly clientIp?: string;
}

export interface StoredLeadRecord {
  readonly submissionId: string;
  readonly leadId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly workEmail: string;
  readonly organization: string;
  readonly role: string;
  readonly practiceSize: string;
  readonly locationCount: string;
  readonly currentEhr?: string;
  readonly message?: string;
  readonly utm?: UtmParameters;
  readonly createdAt: string;
  readonly status: "NEW" | "CONTACTED" | "QUALIFIED" | "ARCHIVED";
}

export interface LeadSubmissionResult {
  readonly success: boolean;
  readonly leadId?: string;
  readonly message: string;
  readonly errors?: Record<string, string>;
}

export interface ILeadRepository {
  readonly repositoryName: string;
  saveLead(payload: LeadSubmissionPayload): Promise<LeadSubmissionResult>;
  getAllLeads?(): Promise<ReadonlyArray<StoredLeadRecord>>;
}
