/**
 * @file Security headers (WO-002B S1-11)
 * @description Response headers applied to every gateway response.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.4 — HSTS, CSP nonce, no-sniff, frame-deny.
 */

import { randomBytes } from "node:crypto";

/** A fresh CSP nonce per response. Reusing one across responses defeats the point. */
export function cspNonce(): string {
  return randomBytes(16).toString("base64");
}

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    // Two years, subdomains included, preload-eligible.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "Content-Security-Policy": [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      "connect-src 'self'",
      "img-src 'self' data:",
      "style-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    // The API needs none of these.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    // Responses may describe a patient. None of them may sit in a shared cache.
    "Cache-Control": "no-store",
  };
}

/** Request body ceiling (§7.4). */
export const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
