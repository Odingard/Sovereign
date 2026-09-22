/**
 * @file In-process DEK cache (WO-002C S1-07)
 * @description Short-lived cache of unwrapped tenant DEKs.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.3 — "DEK cache in-process, 5 min TTL,
 * cleared on tenant suspend."
 *
 * The cache exists because unwrapping calls the KMS, and doing that per field would
 * be slow and expensive. It is a deliberate trade: plaintext key material lives in
 * process memory for up to five minutes.
 *
 * Three rules follow from that trade, and each is enforced below:
 *   1. Entries expire. A suspended or offboarded tenant must stop decrypting quickly.
 *   2. `evict(tenantId)` is immediate and total, for tenant suspend and crypto-shred.
 *   3. Key bytes are zeroed on eviction, so a later heap dump is less likely to
 *      contain them. Best-effort — the runtime may have copied the buffer — but the
 *      cost is one memset and the alternative is leaving keys lying around.
 *
 * In-process only, never shared, never serialised, never logged.
 */

export const DEFAULT_DEK_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  dek: Uint8Array;
  readonly keyId: string;
  readonly expiresAt: number;
}

export class DekCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_DEK_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  get(tenantId: string): { dek: Uint8Array; keyId: string } | undefined {
    const entry = this.entries.get(tenantId);
    if (entry === undefined) {
      return undefined;
    }
    if (this.now() >= entry.expiresAt) {
      this.evict(tenantId);
      return undefined;
    }
    return { dek: entry.dek, keyId: entry.keyId };
  }

  set(tenantId: string, dek: Uint8Array, keyId: string): void {
    // Replacing an entry evicts the old one first, so rotation does not leave the
    // superseded key in memory.
    this.evict(tenantId);
    this.entries.set(tenantId, { dek, keyId, expiresAt: this.now() + this.ttlMs });
  }

  /** Immediate and total. Called on tenant suspend, offboarding and crypto-shred. */
  evict(tenantId: string): void {
    const entry = this.entries.get(tenantId);
    if (entry !== undefined) {
      entry.dek.fill(0);
      this.entries.delete(tenantId);
    }
  }

  /** Evict every tenant. Used on shutdown and in tests. */
  clear(): void {
    for (const tenantId of [...this.entries.keys()]) {
      this.evict(tenantId);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}
