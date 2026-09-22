/**
 * @file SIEM delivery (WO-002C S1-17)
 * @description Signing, backoff and dead-lettering.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.7.
 *
 * Delivery is at-least-once with an HMAC-SHA256 signature, exponential backoff from
 * one minute to one hour, and a 24-hour ceiling after which the event is dead-lettered
 * and an alert fires.
 *
 * At-least-once, not at-most-once: a duplicated audit event in a tenant's SIEM is
 * noise they can deduplicate on `event.id`. A DROPPED audit event is a gap in their
 * security record that neither side ever notices. Those costs are not close.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "X-Sovereign-Signature" as const;
export const TIMESTAMP_HEADER = "X-Sovereign-Timestamp" as const;

export const BACKOFF_INITIAL_MS = 60_000;
export const BACKOFF_MAX_MS = 3_600_000;
export const DEAD_LETTER_AFTER_MS = 86_400_000;

/**
 * Sign a payload.
 *
 * The timestamp is inside the signed material, not merely alongside it. Signing the
 * body alone lets an attacker who captures one delivery replay it indefinitely; with
 * the timestamp covered, the receiver can reject anything outside a freshness window
 * and the signature still proves the timestamp was not altered.
 */
export function signPayload(secret: string, body: string, timestamp: Date): string {
  return createHmac("sha256", secret)
    .update(`${Math.floor(timestamp.getTime() / 1000)}.${body}`)
    .digest("hex");
}

/** Constant-time verification, for the receiving side and for tests. */
export function verifySignature(
  secret: string,
  body: string,
  timestamp: Date,
  presented: string,
): boolean {
  const expected = signPayload(secret, body, timestamp);
  if (presented.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(presented, "hex"), Buffer.from(expected, "hex"));
}

/**
 * Backoff for a given attempt number, capped.
 *
 * Attempt 1 waits the initial interval; each subsequent attempt doubles until the
 * ceiling. No jitter in Stage 1 — with a handful of pilot tenants there is no
 * thundering herd to spread, and deterministic timing is easier to reason about
 * during an incident. Worth revisiting before GA.
 */
export function backoffMs(attempt: number): number {
  if (attempt <= 1) {
    return BACKOFF_INITIAL_MS;
  }
  return Math.min(BACKOFF_MAX_MS, BACKOFF_INITIAL_MS * 2 ** (attempt - 1));
}

/**
 * Whether to keep retrying.
 *
 * Bounded by elapsed time rather than attempt count. With a one-hour ceiling, an
 * attempt-count bound would mean very different real durations depending on where
 * the doubling stopped, and "we tried for 24 hours" is what a tenant actually needs
 * to hear.
 */
export function shouldRetry(firstFailedAt: Date, now: Date): boolean {
  return now.getTime() - firstFailedAt.getTime() < DEAD_LETTER_AFTER_MS;
}

export interface DeliveryAttempt {
  readonly eventId: string;
  readonly attempt: number;
  readonly firstFailedAt: Date;
}

export type DeliveryDecision =
  | { readonly kind: "retry"; readonly afterMs: number }
  | { readonly kind: "dead_letter"; readonly reason: "retry_window_exhausted" };

export function nextDeliveryDecision(attempt: DeliveryAttempt, now: Date): DeliveryDecision {
  if (!shouldRetry(attempt.firstFailedAt, now)) {
    return { kind: "dead_letter", reason: "retry_window_exhausted" };
  }
  return { kind: "retry", afterMs: backoffMs(attempt.attempt) };
}

/**
 * Whether a tenant's export is healthy enough to keep sending.
 *
 * A destination failing persistently is disabled rather than retried forever. The
 * events are not lost — they dead-letter — but hammering a broken endpoint turns one
 * tenant's misconfiguration into load on everyone.
 */
export const DISABLE_AFTER_CONSECUTIVE_FAILURES = 100;

export function shouldDisableExport(consecutiveFailures: number): boolean {
  return consecutiveFailures >= DISABLE_AFTER_CONSECUTIVE_FAILURES;
}
