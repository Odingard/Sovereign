/**
 * Provider-neutral lead persistence.
 * Production succeeds only after a configured shared endpoint confirms durable storage.
 */

import { randomUUID } from "node:crypto";
import type {
  ILeadRepository,
  LeadSubmissionPayload,
  LeadSubmissionResult,
  StoredLeadRecord,
} from "./types";

const SUCCESS_MESSAGE =
  "Thank you for your interest in Sovereign. Our team will review your practice information and be in touch.";

function toStoredRecord(payload: LeadSubmissionPayload, leadId: string): StoredLeadRecord {
  return {
    submissionId: payload.submissionId,
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
}

export class InMemoryLeadRepository implements ILeadRepository {
  public readonly repositoryName = "InMemoryLeadRepository";
  private readonly leads = new Map<string, StoredLeadRecord>();

  public async saveLead(payload: LeadSubmissionPayload): Promise<LeadSubmissionResult> {
    const existing = this.leads.get(payload.submissionId);
    if (existing) return { success: true, leadId: existing.leadId, message: SUCCESS_MESSAGE };
    const leadId = `LEAD-${randomUUID().slice(0, 8).toUpperCase()}`;
    this.leads.set(payload.submissionId, toStoredRecord(payload, leadId));
    return { success: true, leadId, message: SUCCESS_MESSAGE };
  }

  public async getAllLeads(): Promise<ReadonlyArray<StoredLeadRecord>> {
    return [...this.leads.values()];
  }

  public clear(): void {
    this.leads.clear();
  }
}

type FetchLike = typeof fetch;

export class WebhookLeadRepository implements ILeadRepository {
  public readonly repositoryName = "WebhookLeadRepository";

  constructor(
    private readonly endpoint: string,
    private readonly token?: string,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  public async saveLead(payload: LeadSubmissionPayload): Promise<LeadSubmissionResult> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": payload.submissionId,
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        submissionId: payload.submissionId,
        contact: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          workEmail: payload.workEmail,
          organization: payload.organization,
          role: payload.role,
        },
        practice: {
          size: payload.practiceSize,
          locations: payload.locationCount,
          currentEhr: payload.currentEhr,
        },
        message: payload.message,
        attribution: payload.utm,
        submittedAt: payload.submittedAt,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { success: false, message: "We could not save your request. Please try again." };
    }

    const data = (await response.json()) as { leadId?: unknown };
    if (typeof data.leadId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.leadId)) {
      return { success: false, message: "The lead service returned an invalid confirmation." };
    }
    return { success: true, leadId: data.leadId, message: SUCCESS_MESSAGE };
  }
}

class UnavailableLeadRepository implements ILeadRepository {
  public readonly repositoryName = "UnavailableLeadRepository";
  public async saveLead(): Promise<LeadSubmissionResult> {
    return {
      success: false,
      message: "Early-access requests are temporarily unavailable. Please try again later.",
    };
  }
}

const developmentRepository = new InMemoryLeadRepository();

export function getLeadRepository(): ILeadRepository {
  const endpoint = process.env.SOVEREIGN_LEAD_ENDPOINT;
  if (endpoint) {
    return new WebhookLeadRepository(endpoint, process.env.SOVEREIGN_LEAD_API_TOKEN);
  }
  return process.env.NODE_ENV === "production"
    ? new UnavailableLeadRepository()
    : developmentRepository;
}

export const defaultLeadRepository = developmentRepository;
