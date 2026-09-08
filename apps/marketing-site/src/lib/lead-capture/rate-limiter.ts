/**
 * @file Public Lead Submission Rate Limiter
 * @description In-memory sliding window rate limiter to protect public API endpoints against abuse.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class SlidingWindowRateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxEntries: number;
  private checks = 0;

  constructor(maxRequests = 5, windowMs = 10 * 60 * 1000, maxEntries = 10_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
  }

  public check(identifier: string): { allowed: boolean; remaining: number; resetInMs: number } {
    const now = Date.now();
    this.checks += 1;
    if (this.checks % 100 === 0 || this.cache.size >= this.maxEntries) {
      this.sweep(now);
    }
    const entry = this.cache.get(identifier);

    if (!entry || now > entry.resetTime) {
      this.cache.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetInMs: this.windowMs,
      };
    }

    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInMs: Math.max(0, entry.resetTime - now),
      };
    }

    entry.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetInMs: Math.max(0, entry.resetTime - now),
    };
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }

  private sweep(now: number): void {
    for (const [key, entry] of this.cache) {
      if (entry.resetTime <= now) this.cache.delete(key);
    }
    while (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }
}

export const leadSubmissionRateLimiter = new SlidingWindowRateLimiter(5, 10 * 60 * 1000);
