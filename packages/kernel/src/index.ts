/**
 * @sovereign/kernel — shared service kernel.
 *
 * WO-002C ticket S1-06. Tier rule (ADR-0011): depends only on @sovereign/contracts
 * and @sovereign/domain. Everything needing I/O is a port in ./ports.ts.
 */

export * from "./errors.js";
export * from "./ports.js";
export * from "./context-guard.js";
export * from "./capability-guard.js";
export * from "./with-tenant.js";
export * from "./audit-emitter.js";
export * from "./idempotency.js";
export * from "./kill-switch.js";
