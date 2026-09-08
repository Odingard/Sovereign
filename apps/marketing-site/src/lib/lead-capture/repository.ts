/**
 * @file Provider-Neutral Lead Capture Storage
 * @description Decouples lead capture from specific CRM vendors (HubSpot/Salesforce/Close).
 * Implements a durable in-memory repository suitable for early-access campaigns.
 */

import { randomUUID } from "node:crypto";
import type {
  ILeadRepository,
  LeadSubmissionPayload,
  LeadSubmissionResult,
  StoredLeadRecord,
} from "./types";

export class InMemoryLeadRepository implements ILeadRepository {
  public readonly repositoryName = "InMemoryLeadRepository";
  private leads: StoredLeadRecord[] = [];

  public async saveLead(payload: LeadSubmissionPayload): Promise<LeadSubmissionResult> {
    const leadId = `LEAD-${randomUUID().slice(0, 8).toUpperCase()}`;

    const record: StoredLeadRecord = {
      leadId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      workEmail: payload.workEmail,
      organization: payload.organization,
      role: payload.role,
      practiceSize: payload.practiceSize,
      locationCount: payload.locationCount,
      currentEhr: payload.currentEhr,
      message: payload.message,
      utm: payload.utm,
      createdAt: payload.submittedAt || new Date().toISOString(),
      status: "NEW",
    };

    this.leads.push(record);

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Lead Captured: ${leadId}]`, {
        name: `${record.firstName} ${record.lastName}`,
        email: record.workEmail,
        org: record.organization,
        size: record.practiceSize,
      });
    }

    return {
      success: true,
      leadId,
      message:
        "Thank you for your interest in Sovereign. Our team will review your practice information and be in touch.",
    };
  }

  public async getAllLeads(): Promise<ReadonlyArray<StoredLeadRecord>> {
    return [...this.leads];
  }

  public clear(): void {
    this.leads = [];
  }
}

// Default singleton repository
export const defaultLeadRepository = new InMemoryLeadRepository();

export function getLeadRepository(): ILeadRepository {
  return defaultLeadRepository;
}
