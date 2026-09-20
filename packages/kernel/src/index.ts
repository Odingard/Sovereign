/**
 * @sovereign/kernel — shared service kernel.
 *
 * SCAFFOLD ONLY (WO-002A, ticket S1-01). This package intentionally contains no
 * behavior. It exists so that the ADR-0006 tier boundaries can be registered and
 * enforced by `scripts/verify-architecture.ts` before any consumer is written.
 *
 * Tier rule (ADR-0011 §Decision 2): kernel depends only on `@sovereign/contracts`
 * and `@sovereign/domain`. It must never import persistence, application,
 * workflow-runtime, audit, or any cloud/vendor SDK.
 *
 * Planned surface (docs/STAGE1_FOUNDATION_SPEC.md §8) — delivered by ticket S1-06
 * under WO-002B/WO-002C, NOT by this work order:
 *   1. RequestContext guard      — rejects unsigned/expired context (§5.1)
 *   2. Capability guard          — server-resolved ActionDefinition + domain
 *                                  AuthorizationEvaluator before every handler (§6.2)
 *   3. withTenant(ctx, fn)       — the only DB entry point for tenant data (§5.2)
 *   4. audit.emit(ctx, event)    — writes to domain_outbox_events in-transaction (§7.3)
 *   5. Outbox relay helper       — FOR UPDATE SKIP LOCKED publish loop
 *   6. Idempotency middleware    — (§6.4)
 *   7. Typed error taxonomy      — error_code only, never internal messages
 *   8. Telemetry hooks           — OTel spans carrying tenant_id/correlation_id
 *   9. Kill-switch hook          — checked before every AI/external-action path
 *
 * Adding any of the above here before its ticket is scope drift and fails review.
 */

/** Marks this package as a registered ADR-0006 tier scaffold. Carries no behavior. */
export const KERNEL_SCAFFOLD = {
  package: "@sovereign/kernel",
  introducedBy: "WO-002A/S1-01",
  implementedBy: "S1-06",
  status: "scaffold",
} as const;
