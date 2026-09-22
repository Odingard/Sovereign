/**
 * @sovereign/service-audit — hash-chained append-only clinical audit.
 *
 * WO-002C S1-15. Consumes audit events, appends them to a per-tenant chain, verifies
 * the chain, and writes daily anchors.
 */

export * from "./chain.js";
export * from "./verify.js";
