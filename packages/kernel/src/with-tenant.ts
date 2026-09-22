/**
 * @file withTenant (WO-002C S1-06)
 * @description The only entry point for tenant data.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.2, §8.3, ADR-0009.
 *
 * "No query runs outside `withTenant` except migrations and explicitly tagged
 * `@systemScope` jobs." The wrapper opens a transaction with `app.current_tenant`
 * set, so PostgreSQL RLS filters every statement inside it.
 *
 * RLS is defence in depth, never the sole control — repositories still carry explicit
 * `WHERE tenant_id = ?` predicates (ADR-0009). This wrapper is the layer that makes
 * forgetting the predicate non-fatal instead of catastrophic.
 */

import type { RequestContext } from "@sovereign/contracts";
import { contextInvalid } from "./errors.js";
import type { TenantTransactionPort, TransactionHandle } from "./ports.js";

export async function withTenant<T>(
  port: TenantTransactionPort,
  context: Pick<RequestContext, "tenantId">,
  fn: (trx: TransactionHandle) => Promise<T>,
): Promise<T> {
  // A blank tenant would set `app.current_tenant` to the empty string, and the RLS
  // policy compares against NULLIF(current_setting(...), '') — which yields NULL and
  // matches nothing. That fails closed, but silently, so it is rejected loudly here.
  if (context.tenantId.length === 0) {
    throw contextInvalid("withTenant called without a tenant id");
  }
  return port.withTenantTransaction(context.tenantId, fn);
}
