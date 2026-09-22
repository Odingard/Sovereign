/**
 * @sovereign/gateway — the authenticated HTTP edge.
 *
 * WO-002B S1-11. Verifies the IdP token, resolves tenancy from verified claims only,
 * signs an internal context, rate-limits per tenant, and applies security headers.
 *
 * Deliberately NOT here: route handlers for /v1/*. Those arrive with the services
 * they front (S1-09, S1-14, S1-15). This ticket delivers the edge itself.
 */

export * from "./rate-limit.js";
export * from "./security-headers.js";
export * from "./health.js";
export * from "./app.js";
export * from "./audit-routes.js";
