/**
 * @file Kernel ports (WO-002C S1-06)
 * @description Interfaces the kernel needs from the outside world.
 *
 * ADR-0011 restricts this package to `contracts` and `domain`, so the kernel cannot
 * import `@sovereign/persistence` — it declares what it needs and a service wires the
 * implementation. Same pattern as KeyManagementPort in packages/crypto.
 */

import type { AuditEventInput } from "@sovereign/contracts";

/** A transaction handle. Opaque to the kernel; the adapter knows what it is. */
export type TransactionHandle = unknown;

/**
 * Opens a transaction with the tenant session variable set.
 *
 * The implementation must run `set_config('app.current_tenant', $1, true)` inside the
 * transaction so PostgreSQL RLS applies (ADR-0009, migration 002). Setting it outside
 * the transaction, or forgetting it, silently disables tenant isolation — which is
 * why no service is allowed to open its own transaction.
 */
export interface TenantTransactionPort {
  withTenantTransaction<T>(
    tenantId: string,
    fn: (trx: TransactionHandle) => Promise<T>,
  ): Promise<T>;
}

/**
 * Appends to `domain_outbox_events` inside the caller's transaction.
 *
 * In-transaction is the whole point (§7.3): if the audit row cannot commit, the
 * business write must not commit either.
 */
export interface OutboxPort {
  append(trx: TransactionHandle, event: AuditEventInput): Promise<void>;
}

export interface IdempotencyRecord {
  readonly requestHash: string;
  readonly response: unknown;
}

/** Stores `(tenant, user, key) -> (request hash, response)` with a 24h TTL (§6.4). */
export interface IdempotencyStore {
  get(tenantId: string, userId: string, key: string): Promise<IdempotencyRecord | undefined>;
  put(
    tenantId: string,
    userId: string,
    key: string,
    record: IdempotencyRecord,
    ttlMs: number,
  ): Promise<void>;
}

/** Reads the kill-switch registry (§8.9). Deny-on-unknown is the caller's job. */
export interface KillSwitchRegistry {
  isEnabled(capability: string, tenantId: string | null): Promise<boolean>;
}
