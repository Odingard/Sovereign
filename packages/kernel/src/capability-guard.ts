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
 * Deny maps to 403 — except across tenants, where it maps to 404, because a 403
 * confirms the object exists and turns the API into a cross-tenant enumeration
 * oracle (spec §10 test 1).
 */

import type { AuthorizationEvaluator, AuthorizationRequest } from "@sovereign/domain";
import { AuthorizationOutcome } from "@sovereign/domain";
import { forbidden, notFound } from "./errors.js";

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
): Promise<CapabilityDecision> {
  // Cross-tenant is decided before the evaluator runs. Even a PERMIT for a resource
  // in another tenant is a 404 — there is no legitimate path to another tenant's
  // object through this guard.
  if (String(request.targetResource.targetTenantId) !== requestTenantId) {
    throw notFound("Cross-tenant resource reference");
  }

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
