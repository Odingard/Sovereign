/**
 * @file Health and integration health (WO-002B S1-11)
 * @description /health/live, /health/ready, /v1/integration-health.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.4, PRD FR-038.
 *
 * "No secrets, no PHI, no stack traces." Dependency status is a bounded enum and two
 * timestamps. A health endpoint that echoes a connection error leaks host names,
 * credentials and schema, and it is one of the few endpoints deliberately reachable
 * without authentication.
 */

export type DependencyStatus = "healthy" | "degraded" | "unavailable" | "misconfigured";

export interface DependencyHealth {
  readonly status: DependencyStatus;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
}

export const TRACKED_DEPENDENCIES = ["db", "pubsub", "kms", "idp", "gcs"] as const;
export type TrackedDependency = (typeof TRACKED_DEPENDENCIES)[number];

export type IntegrationHealth = Record<TrackedDependency, DependencyHealth>;

export interface HealthProbe {
  check(dependency: TrackedDependency): Promise<boolean>;
}

/**
 * Tracks dependency health without ever storing an error.
 *
 * A probe returns a boolean. It cannot return a message, so no message can reach the
 * response — the type system enforces what a code review would otherwise have to.
 */
export class IntegrationHealthTracker {
  private readonly state = new Map<TrackedDependency, DependencyHealth>();

  constructor(private readonly now: () => Date = () => new Date()) {
    for (const dependency of TRACKED_DEPENDENCIES) {
      // Unknown is "misconfigured", not "healthy". An unprobed dependency must never
      // read as working (AGENTS.md doctrine 7: unknown is not negative — and it is
      // not positive either).
      this.state.set(dependency, {
        status: "misconfigured",
        lastSuccessAt: null,
        lastFailureAt: null,
      });
    }
  }

  record(dependency: TrackedDependency, ok: boolean): void {
    const previous = this.state.get(dependency);
    const stamp = this.now().toISOString();
    this.state.set(dependency, {
      status: ok ? "healthy" : "unavailable",
      lastSuccessAt: ok ? stamp : (previous?.lastSuccessAt ?? null),
      lastFailureAt: ok ? (previous?.lastFailureAt ?? null) : stamp,
    });
  }

  snapshot(): IntegrationHealth {
    const out = {} as Record<TrackedDependency, DependencyHealth>;
    for (const dependency of TRACKED_DEPENDENCIES) {
      out[dependency] = this.state.get(dependency) as DependencyHealth;
    }
    return out;
  }

  /**
   * Readiness. The database is the only hard dependency: without it the gateway
   * cannot serve a correct answer to anything. A Pub/Sub or GCS outage degrades
   * features but must not take the whole surface down, including the audit reads an
   * incident responder needs.
   */
  isReady(): boolean {
    return this.state.get("db")?.status === "healthy";
  }
}
