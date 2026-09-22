/**
 * @file Hashing helpers (WO-002C S1-07)
 * @description SHA-256 for the audit chain and artifact integrity.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3 (audit chain), §7.2 (artifact
 * content_hash), S1-D11.
 *
 * Chain hashing needs a canonical encoding: two structurally identical events must
 * produce identical bytes regardless of key order, or verification fails on data
 * that was never tampered with.
 */

import { createHash } from "node:crypto";

/** Lowercase hex SHA-256. Hex, not base64, because the audit schema stores hex. */
export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function sha256(input: string | Uint8Array): Buffer {
  return createHash("sha256").update(input).digest();
}

/**
 * Deterministic JSON: object keys sorted recursively, so encoding depends on content
 * and never on insertion order.
 *
 * `undefined` is dropped to match JSON.stringify. Dates become ISO-8601 strings.
 * BigInt becomes a decimal string — the audit chain's `seq` is a bigint and would
 * otherwise throw.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" ? value.toString() : value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) {
      out[key] = canonicalize(v);
    }
  }
  return out;
}

/**
 * One link of the audit chain: sha256(prevHash || canonicalJson(event)).
 *
 * The caller must exclude the derived fields (`prevHash`, `eventHash`, `recordedAt`)
 * from `event` — see AUDIT_HASH_EXCLUDED_FIELDS in @sovereign/contracts. Including a
 * hash in its own preimage is not computable.
 */
export function chainHash(prevHashHex: string, event: unknown): string {
  return sha256Hex(
    Buffer.concat([Buffer.from(prevHashHex, "hex"), Buffer.from(canonicalJson(event), "utf8")]),
  );
}

/** The prevHash of the first event in a tenant's chain. */
export const GENESIS_HASH = "0".repeat(64);
