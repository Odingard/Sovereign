/**
 * @file Early Access Form API Route
 * @description POST /api/early-access
 * Validates business lead data, rejects spam/bots, rate-limits submissions,
 * and saves to the provider-neutral lead repository.
 */

import type { UtmParameters } from "@/lib/attribution/utm";
import { leadSubmissionRateLimiter } from "@/lib/lead-capture/rate-limiter";
import { getLeadRepository } from "@/lib/lead-capture/repository";
import type { EarlyAccessFormData, LeadSubmissionPayload } from "@/lib/lead-capture/types";
import { validateEarlyAccessForm } from "@/lib/lead-capture/validation";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // 1. Resolve client IP for rate limiting
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";

    // 2. Enforce sliding window rate limit
    const rateLimit = leadSubmissionRateLimiter.check(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimit.resetInMs / 1000).toString(),
          },
        },
      );
    }

    // 3. Parse JSON body
    let body: Partial<EarlyAccessFormData> & { utm?: UtmParameters };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    // 4. Validate data with anti-spam and PHI guard
    const validation = validateEarlyAccessForm(body, true);
    if (validation.isSpam) {
      // Reject bot / honeypot submissions
      return NextResponse.json(
        { success: false, message: "Submission rejected." },
        { status: 400 },
      );
    }

    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Please correct the errors in the form.",
          errors: validation.errors,
        },
        { status: 400 },
      );
    }

    // 5. Construct payload
    const payload: LeadSubmissionPayload = {
      firstName: (body.firstName || "").trim(),
      lastName: (body.lastName || "").trim(),
      workEmail: (body.workEmail || "").trim().toLowerCase(),
      organization: (body.organization || "").trim(),
      role: (body.role || "").trim(),
      practiceSize: (body.practiceSize || "").trim(),
      locationCount: (body.locationCount || "").trim(),
      currentEhr: body.currentEhr ? body.currentEhr.trim() : undefined,
      message: body.message ? body.message.trim() : undefined,
      utm: body.utm,
      submittedAt: new Date().toISOString(),
      clientIp,
    };

    // 6. Save via provider-neutral lead repository
    const repository = getLeadRepository();
    const result = await repository.saveLead(payload);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[Early Access Submission Error]", error);
    return NextResponse.json(
      {
        success: false,
        message: "An unexpected error occurred. Please try again later.",
      },
      { status: 500 },
    );
  }
}
