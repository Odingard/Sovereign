/**
 * @file Audit API routes (WO-002C S1-15)
 * @description `GET /audit/events`, `GET /audit/verify`, `POST /audit/exports`.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3 API table.
 *
 * `services/audit` holds the logic; this is the HTTP surface over it. The routes do
 * three things and delegate the rest:
 *
 *   1. Resolve the capability SERVER-SIDE from the route, never from the request.
 *      AGENTS.md doctrine 18: the requester does not define the security requirements
 *      for its own request.
 *   2. Take the tenant from the verified context, never from a parameter. A tenant id
 *      in a query string is a suggestion.
 *   3. Audit the access itself. Querying and exporting the audit log are both on the
 *      Stage 1 minimum audited actions list (§7.3), which is the point: the log
 *      records who read it.
 */

import type { RequestContext } from "@sovereign/contracts";
import type { AuthorizationEvaluator } from "@sovereign/domain";
import { CanonicalCapabilities } from "@sovereign/domain";
import { type SiteScope, requireCapability } from "@sovereign/kernel";
import type { FastifyInstance } from "fastify";

/** What the routes need from the audit service, as a port rather than an import. */
export interface AuditReadPort {
  query(
    tenantId: string,
    filters: Record<string, unknown>,
  ): Promise<{ rows: unknown[]; truncated: boolean; nextAfterSeq: bigint | null }>;
  verify(tenantId: string): Promise<{ verified: boolean; eventsChecked: number }>;
  export(request: {
    tenantId: string;
    requestedBy: string;
    approvals: { approverId: string; approvedAt: Date }[];
    filters: Record<string, unknown>;
  }): Promise<{ manifest: unknown; signature: string; body: string }>;
}

/** Emits the audit row for the access itself. */
export interface AuditAccessRecorder {
  record(context: RequestContext, action: string, result: "success" | "denied"): Promise<void>;
}

export interface AuditRouteOptions {
  readonly evaluator: AuthorizationEvaluator;
  readonly audit: AuditReadPort;
  readonly recorder: AuditAccessRecorder;
}

/**
 * The audit endpoints are tenant-wide, never site-scoped.
 *
 * Stated explicitly rather than left as a default. An audit chain covers every site in
 * the tenant, so narrowing it by the caller's sites would produce a partial answer that
 * looks complete — the exact failure the `truncated` flag exists to prevent elsewhere.
 * An auditor who may not see every site should not hold `audit:query` at all.
 */
const TENANT_WIDE: SiteScope = { grantedSiteIds: [], resourceSiteId: null };

function authorizationRequest(context: RequestContext, capability: string) {
  return {
    securityContext: context as never,
    requestedCapability: capability as never,
    targetResource: {
      aggregateType: "audit",
      aggregateId: context.tenantId,
      targetTenantId: context.tenantId as never,
    },
  };
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function registerAuditRoutes(app: FastifyInstance, options: AuditRouteOptions): void {
  app.get("/audit/events", async (request, reply) => {
    const context = request.sovereignContext;
    if (context === undefined) {
      return reply.code(401).send({ error: { code: "E_UNAUTHENTICATED" } });
    }

    await requireCapability(
      options.evaluator,
      authorizationRequest(context, CanonicalCapabilities.AUDIT_QUERY),
      context.tenantId,
      TENANT_WIDE,
    );

    const q = request.query as Record<string, unknown>;
    const page = await options.audit.query(context.tenantId, {
      patientId: typeof q.patient_id === "string" ? q.patient_id : undefined,
      actorId: typeof q.actor_id === "string" ? q.actor_id : undefined,
      action: typeof q.action === "string" ? q.action : undefined,
      correlationId: typeof q.correlation_id === "string" ? q.correlation_id : undefined,
      from: parseDate(q.from),
      to: parseDate(q.to),
      afterSeq: typeof q.after_seq === "string" ? BigInt(q.after_seq) : undefined,
    });

    // Recorded AFTER authorization and BEFORE the response is sent. A read that is
    // refused is not an access; a read that succeeded and was never recorded is the
    // failure this endpoint exists to make impossible.
    await options.recorder.record(context, "audit.query", "success");

    return {
      rows: page.rows,
      truncated: page.truncated,
      nextAfterSeq: page.nextAfterSeq === null ? null : page.nextAfterSeq.toString(),
    };
  });

  app.get("/audit/verify", async (request, reply) => {
    const context = request.sovereignContext;
    if (context === undefined) {
      return reply.code(401).send({ error: { code: "E_UNAUTHENTICATED" } });
    }

    await requireCapability(
      options.evaluator,
      authorizationRequest(context, CanonicalCapabilities.AUDIT_VERIFY),
      context.tenantId,
      TENANT_WIDE,
    );

    const result = await options.audit.verify(context.tenantId);
    await options.recorder.record(context, "audit.verify", "success");
    // The failure DETAIL is not returned: it names the sequence at which the chain
    // broke, which tells whoever broke it exactly what to repair. Verified or not is
    // what a caller needs; the detail belongs in the alert.
    return { verified: result.verified, eventsChecked: result.eventsChecked };
  });

  app.post("/audit/exports", async (request, reply) => {
    const context = request.sovereignContext;
    if (context === undefined) {
      return reply.code(401).send({ error: { code: "E_UNAUTHENTICATED" } });
    }

    await requireCapability(
      options.evaluator,
      authorizationRequest(context, CanonicalCapabilities.AUDIT_EXPORT),
      context.tenantId,
      TENANT_WIDE,
    );

    const body = (request.body ?? {}) as Record<string, unknown>;
    const approvals = Array.isArray(body.approvals)
      ? (body.approvals as Record<string, unknown>[]).flatMap((a) => {
          const approverId = a.approverId;
          const approvedAt = parseDate(a.approvedAt);
          return typeof approverId === "string" && approvedAt !== undefined
            ? [{ approverId, approvedAt }]
            : [];
        })
      : [];

    // The dual-control check lives in the service, not here. A second copy of the rule
    // at the edge is a second place for it to drift, and the one in the service is the
    // one that runs when something other than HTTP calls it.
    const result = await options.audit.export({
      tenantId: context.tenantId,
      requestedBy: context.userId,
      approvals,
      filters: (body.filters as Record<string, unknown>) ?? {},
    });

    await options.recorder.record(context, "audit.export", "success");
    return reply.code(201).send({
      manifest: result.manifest,
      signature: result.signature,
      body: result.body,
    });
  });
}
