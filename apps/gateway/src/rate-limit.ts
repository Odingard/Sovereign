/**
 * @file Per-tenant rate limiting (WO-002B S1-11)
 * @description Token bucket keyed by tenant.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.4, ENTERPRISE_BUILD_PLAN.md noisy-neighbour
 * mitigation. Default 50 rps, burst 200.
 *
 * Keyed by TENANT, not by IP or user. The threat this addresses is one tenant
 * consuming capacity that belongs to another — a shared-pool problem (ADR-0011 pool
 * model). Keying by IP would let one tenant exhaust the pool from many addresses, and
 * would throttle a whole clinic behind one NAT as if it were an attacker.
 *
 * In-process. With several gateway instances each enforces its own bucket, so the
 * effective limit is per-instance. That is a deliberate Stage 1 simplification: a
 * shared limiter needs Redis or Cloud Armor, which is cloud work. Recorded so nobody
 * reads this as a global guarantee.
 */

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Whole seconds until the next token, for the Retry-After header. */
  readonly retryAfterSeconds: number;
  readonly remaining: number;
}

export interface RateLimitOptions {
  readonly ratePerSecond?: number;
  readonly burst?: number;
  readonly now?: () => number;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export class TenantRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly rate: number;
  private readonly burst: number;
  private readonly now: () => number;

  constructor(options: RateLimitOptions = {}) {
    this.rate = options.ratePerSecond ?? 50;
    this.burst = options.burst ?? 200;
    this.now = options.now ?? Date.now;
  }

  consume(tenantId: string, cost = 1): RateLimitDecision {
    const nowMs = this.now();
    const bucket = this.buckets.get(tenantId) ?? { tokens: this.burst, lastRefillMs: nowMs };

    const elapsedSeconds = Math.max(0, (nowMs - bucket.lastRefillMs) / 1000);
    bucket.tokens = Math.min(this.burst, bucket.tokens + elapsedSeconds * this.rate);
    bucket.lastRefillMs = nowMs;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.buckets.set(tenantId, bucket);
      return { allowed: true, retryAfterSeconds: 0, remaining: Math.floor(bucket.tokens) };
    }

    this.buckets.set(tenantId, bucket);
    const deficit = cost - bucket.tokens;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(deficit / this.rate)),
      remaining: 0,
    };
  }

  /** Drop idle buckets so a long-lived process does not grow unbounded. */
  evictIdle(idleMs = 10 * 60 * 1000): void {
    const cutoff = this.now() - idleMs;
    for (const [tenantId, bucket] of this.buckets) {
      if (bucket.lastRefillMs < cutoff) {
        this.buckets.delete(tenantId);
      }
    }
  }

  get trackedTenants(): number {
    return this.buckets.size;
  }
}
