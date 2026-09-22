/**
 * @sovereign/adapter-identity-scim — SCIM 2.0 provisioning.
 *
 * WO-002B S1-12. Enterprise user provisioning and, more importantly,
 * deprovisioning. Serves SCIM regardless of IdP: Identity Platform has no SCIM
 * server and none is expected (ADR-0012 §3).
 */

export * from "./auth.js";
export * from "./schemas.js";
export * from "./provisioning.js";
