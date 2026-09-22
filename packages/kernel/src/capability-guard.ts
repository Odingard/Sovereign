/**
 * @file Capability guard (WO-002C S1-06)
 * @description Server-resolved authorization before every handler.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.2, §6.2, ADR-0010.
 *
 * The guard never trusts the request for anything security-relevant. The route
 * declares a capability; the kernel resolves the ActionDefinition server-side and
 * calls the domain AuthorizationEvaluator. AGENTS.md doctrine 18: the requester does
 * not define the security requirements for its own request.
 *
 * Deny maps to 403 — except across tenants and across sites, where it maps to 404,
 * because a 403 confirms the object exists and turns the API into an enumeration
 * oracle (spec §10 tests 1 and 7).
 */

import type { AuthorizationEvaluator, AuthorizationRequest } from "@sovereign/domain";
import { AuthorizationOutcome } from "@sovereign/domain";
import { forbidden, notFound } from "./errors.js";

/**
 * Which sites the caller may reach, and which site the resource belongs to.
 *
 * REQUIRED, not optional, and that is the whole point. `siteIds` has been carried in
 * every token and every RequestContext since S1-08 and was read by nothing (G-56): a
 * user granted site X could reach a patient in site Y, because no code compared the
 * two. An optional parameter would have reproduced that exactly — the callers who
 * forgot it would be the ones that needed it, and nothing would say so.
 *
 * Same decision, same reason, as `hasBoundServiceIdentity` in the context guard.
 */
export interface SiteScope {
  /**
   * Site ids from the VERIFIED context. Never from the request body.
   *
   * An empty list grants access to no site-scoped resource at all. It does not mean
   * "every site": breadth of access is something granted, never inferred from the
   * absence of a restriction (AGENTS.md doctrine 17, role is not grant). A user who
   * legitimately works across a whole tenant is given every site explicitly, which is
   * a statement somebody made rather than a silence somebody read.
   */
  readonly grantedSiteIds: readonly string[];
  /**
   * The site this resource belongs to, or null when it is tenant-wide.
   *
   * null must come from the resource actually being tenant-wide — a billing
   * configuration, a tenant setting — and never from "we did not look it up". A
   * lookup that failed is not a tenant-wide resource.
   */
  readonly resourceSiteId: string | null;
}

export interface CapabilityDecision {
  readonly permitted: boolean;
  readonly outcome: AuthorizationOutcome;
  readonly decisionId: string;
  readonly reasonCode: string;
}

/**
 * Evaluate and throw on denial.
 *
 * `requestTenantId` is the tenant from the verified context; `targetResource
 * .targetTenantId` is the tenant of the object being addressed. They are compared
 * here rather than trusted to match.
 */
export async function requireCapability(
  evaluator: AuthorizationEvaluator,
  request: AuthorizationRequest,
  requestTenantId: string,
  siteScope: SiteScope,
): Promise<CapabilityDecision> {
  // Cross-tenant is decided before the evaluator runs. Even a PERMIT for a resource
  // in another tenant is a 404 — there is no legitimate path to another tenant's
  // object through this guard.
  if (String(request.targetResource.targetTenantId) !== requestTenantId) {
    throw notFound("Cross-tenant resource reference");
  }

  // Site scope is decided next, and for the same reason: a resource the caller may
  // not reach should not be distinguishable from one that does not exist. Within a
  // tenant a 403 would confirm that a patient is being seen at another of the
  // organisation's clinics, which is itself a disclosure (spec §10 test 7).
  assertSiteAccess(siteScope);

  const decision = await evaluator.evaluate(request);
  const result: CapabilityDecision = {
    permitted: decision.outcome === AuthorizationOutcome.PERMIT,
    outcome: decision.outcome,
    decisionId: String(decision.decisionId),
    reasonCode: String(decision.reasonCode),
  };

  if (!result.permitted) {
    // Every outcome other than PERMIT is a refusal at the edge. REQUIRES_AUTHORITY
    // and REQUIRES_HUMAN_REVIEW are legitimate domain states, but neither is
    // permission to proceed, and collapsing them to "allowed" is exactly the
    // confusion AGENTS.md doctrine 16 warns about.
    throw forbidden(`Authorization outcome ${decision.outcome} for ${request.requestedCapability}`);
  }
  return result;
}

/**
 * Refuse a resource outside the caller's granted sites.
 *
 * Exported separately because not every site-scoped read goes through a capability
 * evaluation — a list endpoint filters rather than authorizes a single object — and
 * those paths need the same rule rather than their own version of it.
 */
export function assertSiteAccess(siteScope: SiteScope): void {
  if (siteScope.resourceSiteId === null) {
    return;
  }
  if (!siteScope.grantedSiteIds.includes(siteScope.resourceSiteId)) {
    throw notFound("Resource outside the caller's granted sites");
  }
}
