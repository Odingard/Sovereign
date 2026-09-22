/**
 * @file Idempotency (WO-002C S1-06)
 * @description Replay protection for mutating endpoints.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §6.4, §8.6.
 *
 * Rules:
 *   same key + same request hash  -> replay the stored response
 *   same key + different hash     -> 409, the key is being reused for something else
 *   no key on a mutating endpoint -> 400
 *
 * Scoped to (tenant, user, key) so one tenant's key space cannot collide with or
 * probe another's.
 */

import { createHash } from "node:crypto";
import { idempotencyKeyRequired, idempotencyKeyReused } from "./errors.js";
import type { IdempotencyStore } from "./ports.js";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Stable hash of the request body, so "same request" is well defined. */
export function hashRequest(body: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(body ?? null))
    .digest("hex");
}

export type IdempotencyOutcome<T> =
  | { readonly kind: "replay"; readonly response: T }
  | { readonly kind: "proceed"; readonly record: (response: T) => Promise<void> };

/**
 * Check a key before executing a mutation.
 *
 * Returns either the stored response to replay, or a callback to record the result
 * once the mutation succeeds. The result is recorded by the caller AFTER the work
 * commits — recording first would make a failed mutation look successful on replay.
 */
export async function checkIdempotency<T>(
  store: IdempotencyStore,
  tenantId: string,
  userId: string,
  key: string | undefined,
  body: unknown,
): Promise<IdempotencyOutcome<T>> {
  if (key === undefined || key.length === 0) {
    throw idempotencyKeyRequired("Mutating endpoints require an Idempotency-Key header");
  }
  const requestHash = hashRequest(body);
  const existing = await store.get(tenantId, userId, key);

  if (existing !== undefined) {
    if (existing.requestHash !== requestHash) {
      throw idempotencyKeyReused("Idempotency-Key reused with a different request body");
    }
    return { kind: "replay", response: existing.response as T };
  }

  return {
    kind: "proceed",
    record: async (response: T) => {
      await store.put(tenantId, userId, key, { requestHash, response }, IDEMPOTENCY_TTL_MS);
    },
  };
}
