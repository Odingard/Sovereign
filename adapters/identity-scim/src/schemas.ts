/**
 * @file SCIM 2.0 resource schemas (WO-002B S1-12)
 * @description The subset of RFC 7643 Sovereign accepts.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.6, RFC 7643/7644.
 *
 * Deliberately a SUBSET. SCIM permits a large optional surface — photos, addresses,
 * phone numbers, x509 certificates, arbitrary enterprise extensions. Sovereign accepts
 * none of it. An IdP that syncs a user's home address into a clinical system has just
 * created PHI-adjacent data in a table nobody classified, and the quietest way for
 * that to happen is an over-permissive schema.
 *
 * What we take: identity, activation state, and group membership. Nothing else.
 */

import { z } from "zod";

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User" as const;
export const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group" as const;
export const SCIM_LIST_RESPONSE = "urn:ietf:params:scim:api:messages:2.0:ListResponse" as const;
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error" as const;
export const SCIM_PATCH_OP = "urn:ietf:params:scim:api:messages:2.0:PatchOp" as const;

/**
 * A SCIM user, reduced.
 *
 * `.strip()` rather than `.strict()`: an IdP will send fields we do not want, and
 * rejecting the whole request would break provisioning on any IdP configuration
 * change. Unknown fields are DROPPED, not stored — same deny-by-default posture as
 * the log allowlist.
 */
export const ScimUserSchema = z
  .object({
    schemas: z.array(z.string()).refine((s) => s.includes(SCIM_USER_SCHEMA), {
      message: "schemas must include the SCIM core User urn",
    }),
    id: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    userName: z.string().min(1),
    active: z.boolean().default(true),
    name: z
      .object({
        givenName: z.string().optional(),
        familyName: z.string().optional(),
      })
      .optional(),
    emails: z
      .array(z.object({ value: z.string().email(), primary: z.boolean().optional() }))
      .optional(),
  })
  .strip();

export type ScimUser = z.infer<typeof ScimUserSchema>;

export const ScimGroupSchema = z
  .object({
    schemas: z.array(z.string()).refine((s) => s.includes(SCIM_GROUP_SCHEMA)),
    id: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    displayName: z.string().min(1),
    members: z.array(z.object({ value: z.string().min(1) })).default([]),
  })
  .strip();

export type ScimGroup = z.infer<typeof ScimGroupSchema>;

/** PATCH, restricted to the one operation that matters: activation state. */
export const ScimPatchSchema = z
  .object({
    schemas: z.array(z.string()).refine((s) => s.includes(SCIM_PATCH_OP)),
    Operations: z
      .array(
        z.object({
          op: z.enum(["add", "replace", "remove", "Add", "Replace", "Remove"]),
          path: z.string().optional(),
          value: z.unknown().optional(),
        }),
      )
      .min(1),
  })
  .strip();

export type ScimPatch = z.infer<typeof ScimPatchSchema>;

/** SCIM error envelope. Carries a status and a short detail, never an internal message. */
export function scimError(
  status: number,
  scimType: string,
): {
  schemas: string[];
  status: string;
  scimType: string;
} {
  return { schemas: [SCIM_ERROR_SCHEMA], status: String(status), scimType };
}
