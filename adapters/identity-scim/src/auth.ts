/**
 * @file SCIM connection authentication (WO-002B S1-12)
 * @description Bearer token per enterprise connection, stored hashed, scoped to one tenant.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.6.
 *
 * The token is never stored. `scim_connection.token_hash` holds SHA-256 of it, so a
 * stolen database yields no working credential (migration 003 has a test asserting
 * there is no `token` column at all).
 *
 * A connection is bound to exactly ONE tenant. Spec §10 test 19: tenant A's SCIM token
 * must not be able to touch tenant B. The tenant comes from the connection record, not
 * from the request — a SCIM client cannot name the tenant it wants to act on.
 */

import { constantTimeEquals, sha256 } from "@sovereign/crypto";

export interface ScimConnection {
  readonly connectionId: string;
  /** Resolved from the connection record. Never from the request. */
  readonly tenantId: string;
  readonly tokenHash: Uint8Array;
  readonly status: "active" | "revoked";
}

export class ScimAuthenticationError extends Error {
  constructor(readonly reason: "missing" | "malformed" | "unknown" | "revoked") {
    // One message for every reason. Distinguishing "unknown token" from "revoked
    // connection" tells a prober which half of their guess was right.
    super("SCIM authentication failed");
    this.name = "ScimAuthenticationError";
  }
}

export function hashScimToken(token: string): Buffer {
  return sha256(token);
}

/**
 * Authenticate a SCIM request.
 *
 * `lookup` is a function rather than a table so the caller controls the query, but the
 * comparison happens here, in constant time — a fast-fail compare on a token hash
 * leaks it byte by byte to a patient attacker.
 */
export async function authenticateScim(
  authorizationHeader: string | undefined,
  lookup: (tokenHash: Uint8Array) => Promise<ScimConnection | undefined>,
): Promise<ScimConnection> {
  if (authorizationHeader === undefined || authorizationHeader.length === 0) {
    throw new ScimAuthenticationError("missing");
  }
  if (!authorizationHeader.startsWith("Bearer ")) {
    throw new ScimAuthenticationError("malformed");
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (token.length === 0) {
    throw new ScimAuthenticationError("malformed");
  }

  const presented = hashScimToken(token);
  const connection = await lookup(presented);
  if (connection === undefined) {
    throw new ScimAuthenticationError("unknown");
  }
  if (!constantTimeEquals(presented, connection.tokenHash)) {
    // Defence in depth: the lookup already matched on hash, but if an implementation
    // ever loosens that query this comparison still holds.
    throw new ScimAuthenticationError("unknown");
  }
  if (connection.status !== "active") {
    throw new ScimAuthenticationError("revoked");
  }
  return connection;
}
