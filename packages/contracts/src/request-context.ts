/**
 * @file Request Context Contract (WO-002C S1-04)
 * @description The authenticated, server-resolved envelope carried with every request.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.1.
 *
 * DOCTRINE — the single most important rule in this file:
 * `tenantId` is derived from verified JWT claims at the gateway and NOWHERE ELSE.
 * AGENTS.md:58 forbids inferring tenant, and §5.1 states: "Any code path that reads
 * `tenant_id` from user-controlled input fails review." The schema cannot enforce
 * provenance on its own — a Semgrep rule (.semgrep/tenant-from-request.yaml) and the
 * kernel's context guard (S1-06) do that. This type exists so there is exactly one
 * shape for the answer.
 */

import { ActorKind } from "@sovereign/domain";
import { z } from "zod";

/**
 * Roles per docs/STAGE1_FOUNDATION_SPEC.md §6.1.
 *
 * A role is NOT an authority grant (AGENTS.md doctrine 17). Roles select capability
 * defaults from config/roles/matrix.yaml; authority always comes from an
 * `AuthorityGrant` evaluated by the domain `AuthorizationEvaluator` (ADR-0010).
 */
export const RoleSchema = z.enum([
  "clinician",
  "app", // advanced practice provider
  "nurse_ma",
  "pa_specialist",
  "infusion_coordinator",
  "practice_manager",
  "org_admin",
  "security_admin",
  "auditor",
  "support_readonly",
  "patient", // registered, NOT enabled in Stage 1
]);
export type Role = z.infer<typeof RoleSchema>;

/** Roles that may not be issued in Stage 1 regardless of IdP claims. */
export const STAGE1_DISABLED_ROLES: readonly Role[] = ["patient"] as const;

/**
 * Actor kind is the domain enum (ADR-0010, packages/domain/src/identity/actor.ts).
 *
 * DEVIATION from spec §5.1, recorded deliberately: the spec sketches
 * `actorType: 'user' | 'service' | 'system'`. Carrying that alongside the domain's
 * `ActorKind` would create two overlapping sources of truth for "what kind of actor
 * is this", and the coarse form cannot express the distinction the authorization
 * evaluator depends on — notably AI_AGENT_RUNTIME, which may never hold Class C or D
 * authority. The domain enum is strictly more informative, so it is the only one.
 */
export const ActorKindSchema = z.nativeEnum(ActorKind);

export const RequestContextSchema = z
  .object({
    /** From verified JWT claims only. Never from body, query, or header. */
    tenantId: z.string().min(1),
    userId: z.string().min(1),
    sessionId: z.string().min(1),
    roles: z.array(RoleSchema).min(1),
    siteIds: z.array(z.string().min(1)),
    actorKind: ActorKindSchema,
    /** From X-Correlation-Id when well-formed, otherwise generated at the edge. */
    correlationId: z.string().min(1),
    causationId: z.string().min(1).optional(),
    /** Required on mutating endpoints; enforced by the kernel, not by this schema (§6.4). */
    idempotencyKey: z.string().uuid().optional(),
    /** Trusted server time. Never a client-supplied timestamp. */
    requestedAt: z.date(),
    /** True only when the IdP asserted MFA. Privileged capabilities require it (§6.2). */
    mfa: z.boolean(),
  })
  .strict();

export type RequestContext = z.infer<typeof RequestContextSchema>;

/**
 * The signed internal header carrying user context between the gateway and services.
 *
 * Per §5.1 this is HMAC-signed with a per-environment secret and valid for 60s. It is
 * carried IN ADDITION TO a bound service identity (Google-signed ID token plus mTLS,
 * S1-D17) — services reject a request presenting only one. The header alone is never
 * sufficient: AGENTS.md doctrine 18, "the requester does not define the security
 * requirements for its own request."
 */
export const SIGNED_CONTEXT_HEADER = "X-Sovereign-Context" as const;
export const SIGNED_CONTEXT_MAX_AGE_SECONDS = 60 as const;
export const CORRELATION_ID_HEADER = "X-Correlation-Id" as const;
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;
