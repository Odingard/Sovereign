/**
 * @sovereign/telemetry — OpenTelemetry setup, PHI-redacting logger, metrics.
 *
 * SCAFFOLD ONLY (WO-002A, ticket S1-01). No behavior.
 *
 * Tier rule (ADR-0011 §Decision 2): depends only on `@sovereign/contracts` and
 * `@sovereign/domain`.
 *
 * Sentry is PROHIBITED in this package and in every PHI-capable app
 * (docs/SERVICE_ELIGIBILITY_MATRIX.md:48). It is permitted only in
 * `apps/marketing-site`, which holds no PHI.
 *
 * Planned surface (docs/STAGE1_FOUNDATION_SPEC.md §8.8, S1-D12) — delivered by
 * ticket S1-05 under WO-002C, NOT by this work order:
 *   1. OTel initialization        — traces/metrics/logs → Cloud Trace & Monitoring
 *   2. Allowlist logger           — ONLY fields registered in contracts/LogFields are
 *                                   emitted; every other field becomes `[redacted]`
 *   3. Span helpers               — tenant_id + correlation_id on every span
 *   4. Metrics registry           — the four golden signals per tenant
 *
 * The allowlist is a deny-by-default serializer, not a scrubber: an unregistered
 * field is dropped rather than pattern-matched. The PHI-leak unit test required at
 * S1-05 asserts seeded synthetic PHI never reaches log output.
 */

/** Marks this package as a registered ADR-0006 tier scaffold. Carries no behavior. */
export const TELEMETRY_SCAFFOLD = {
  package: "@sovereign/telemetry",
  introducedBy: "WO-002A/S1-01",
  implementedBy: "S1-05",
  status: "scaffold",
} as const;
