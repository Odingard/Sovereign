import { createHash } from "node:crypto";
import { sanitizeUtmParameters } from "@/lib/attribution/utm";
import { leadSubmissionRateLimiter } from "@/lib/lead-capture/rate-limiter";
import { getLeadRepository } from "@/lib/lead-capture/repository";
import type { EarlyAccessFormData, LeadSubmissionPayload } from "@/lib/lead-capture/types";
import { validateEarlyAccessForm } from "@/lib/lead-capture/validation";
import { type NextRequest, NextResponse } from "next/server";

const MAX_BODY_BYTES = 16 * 1024;
const STRING_FIELDS = [
  "submissionId",
  "firstName",
  "lastName",
  "workEmail",
  "organization",
  "role",
  "practiceSize",
  "locationCount",
  "currentEhr",
  "message",
  "honeypot",
] as const;

class PayloadTooLargeError extends Error {}

async function readBoundedJson(req: NextRequest): Promise<unknown> {
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError();
  }
  if (!req.body) throw new SyntaxError("Missing request body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseFormBody(value: unknown): {
  data?: Partial<EarlyAccessFormData>;
  utm?: ReturnType<typeof sanitizeUtmParameters>;
  errors?: Record<string, string>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { errors: { form: "Request body must be an object." } };
  }
  const input = value as Record<string, unknown>;
  const data: Record<string, string | number | undefined> = {};
  const errors: Record<string, string> = {};
  for (const field of STRING_FIELDS) {
    const candidate = input[field];
    if (candidate !== undefined && typeof candidate !== "string") {
      errors[field] = "This field must be text.";
    } else {
      data[field] = candidate;
    }
  }
  if (input.formRenderedAt !== undefined && typeof input.formRenderedAt !== "number") {
    errors.formRenderedAt = "Invalid form timestamp.";
  } else {
    data.formRenderedAt = input.formRenderedAt as number | undefined;
  }
  if (input.utm !== undefined && sanitizeUtmParameters(input.utm) === undefined) {
    errors.utm = "Invalid attribution data.";
  }
  return {
    data: data as Partial<EarlyAccessFormData>,
    utm: sanitizeUtmParameters(input.utm),
    errors: Object.keys(errors).length ? errors : undefined,
  };
}

function resolveRateLimitIdentifier(headers: Headers): string {
  const trustedProxy = process.env.SOVEREIGN_TRUSTED_PROXY;
  const trustedHeader =
    trustedProxy === "cloudflare"
      ? "cf-connecting-ip"
      : trustedProxy === "vercel"
        ? "x-vercel-forwarded-for"
        : undefined;
  const address = trustedHeader ? headers.get(trustedHeader)?.split(",")[0]?.trim() : undefined;
  const source = address || "unresolved-client";
  return createHash("sha256").update(source).digest("hex").slice(0, 24);
}

export async function POST(req: NextRequest) {
  const clientKey = resolveRateLimitIdentifier(req.headers);
  const rateLimit = leadSubmissionRateLimiter.check(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetInMs / 1000).toString() } },
    );
  }

  let raw: unknown;
  try {
    raw = await readBoundedJson(req);
  } catch (error) {
    const tooLarge = error instanceof PayloadTooLargeError;
    return NextResponse.json(
      {
        success: false,
        message: tooLarge ? "Request body is too large." : "Invalid JSON request body.",
      },
      { status: tooLarge ? 413 : 400 },
    );
  }

  const parsed = parseFormBody(raw);
  if (parsed.errors || !parsed.data) {
    return NextResponse.json(
      { success: false, message: "Please correct the errors in the form.", errors: parsed.errors },
      { status: 400 },
    );
  }

  const body = parsed.data;
  const validation = validateEarlyAccessForm(body, true);
  if (validation.isSpam) {
    return NextResponse.json({ success: false, message: "Submission rejected." }, { status: 400 });
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

  const text = (field: keyof EarlyAccessFormData) => String(body[field] || "").trim();
  const payload: LeadSubmissionPayload = {
    submissionId: text("submissionId"),
    firstName: text("firstName"),
    lastName: text("lastName"),
    workEmail: text("workEmail").toLowerCase(),
    organization: text("organization"),
    role: text("role"),
    practiceSize: text("practiceSize"),
    locationCount: text("locationCount"),
    currentEhr: body.currentEhr ? text("currentEhr") : undefined,
    message: body.message ? text("message") : undefined,
    honeypot: "",
    formRenderedAt: body.formRenderedAt,
    utm: parsed.utm,
    submittedAt: new Date().toISOString(),
  };

  try {
    const result = await getLeadRepository().saveLead(payload);
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch (error) {
    console.error(
      "[Early Access Persistence Error]",
      error instanceof Error ? error.name : "Unknown",
    );
    return NextResponse.json(
      { success: false, message: "We could not save your request. Please try again later." },
      { status: 503 },
    );
  }
}
