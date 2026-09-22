/**
 * @file Sovereign custom claims (WO-002B S1-08)
 * @description The namespaced claims Sovereign requires on an access token.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §4.1, §4.2, ADR-0010, ADR-0012.
 *
 * The IdP holds AUTHENTICATION ONLY. These claims say who the caller is and which
 * tenant they belong to; they never say what the caller may do. Roles appear here
 * because the gateway needs them to build a RequestContext, but a role is not an
 * authority grant (AGENTS.md doctrine 17) — authority comes from an AuthorityGrant
 * evaluated by the domain at the time of the action.
 *
 * Claims are namespaced by URI because a bare `roles` claim collides with whatever
 * the IdP itself puts there, and a collision in this particular field would be a
 * privilege question decided by accident.
 */

import { RoleSchema } from "@sovereign/contracts";
import { z } from "zod";

export const CLAIM_NAMESPACE = "https://sovereign.health/" as const;

export const SovereignClaims = {
  TENANT_ID: `${CLAIM_NAMESPACE}tenant_id`,
  ORG_ID: `${CLAIM_NAMESPACE}org_id`,
  USER_ID: `${CLAIM_NAMESPACE}user_id`,
  ROLES: `${CLAIM_NAMESPACE}roles`,
  SITE_IDS: `${CLAIM_NAMESPACE}site_ids`,
  MFA: `${CLAIM_NAMESPACE}mfa`,
  SESSION_ID: `${CLAIM_NAMESPACE}session_id`,
} as const;

/**
 * Required audience and token lifetime (§4.1).
 *
 * `aud` is checked because a token minted for another service must not be replayable
 * against this API.
 */
export const REQUIRED_AUDIENCE = "https://api.sovereign.health" as const;
export const MAX_ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60;

/**
 * The claim set the gateway requires.
 *
 * `.strict()` is deliberately NOT used: an IdP adds its own claims (sub, iat, azp,
 * typ...) and rejecting them would break on any IdP configuration change. What
 * matters is that the claims Sovereign depends on are present and well-formed.
 */
export const SovereignClaimsSchema = z.object({
  [SovereignClaims.TENANT_ID]: z.string().min(1),
  [SovereignClaims.USER_ID]: z.string().min(1),
  [SovereignClaims.SESSION_ID]: z.string().min(1),
  [SovereignClaims.ROLES]: z.array(RoleSchema).min(1),
  [SovereignClaims.SITE_IDS]: z.array(z.string().min(1)).default([]),
  [SovereignClaims.MFA]: z.boolean().default(false),
  [SovereignClaims.ORG_ID]: z.string().min(1).optional(),
});

export type SovereignClaimSet = z.infer<typeof SovereignClaimsSchema>;
