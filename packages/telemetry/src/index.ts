/**
 * @sovereign/telemetry — PHI-redacting logger and the tracing port.
 *
 * WO-002C ticket S1-05. Tier rule (ADR-0011): depends only on @sovereign/contracts
 * and @sovereign/domain. Vendor SDKs (OpenTelemetry, Cloud Trace) belong in adapters.
 *
 * Sentry is PROHIBITED here and in every PHI-capable app
 * (docs/SERVICE_ELIGIBILITY_MATRIX.md:48); it is permitted only in
 * apps/marketing-site, which holds no PHI.
 */

export * from "./redacting-logger.js";
export * from "./tracing-port.js";
