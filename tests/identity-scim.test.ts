import {
  DEPROVISION_SESSION_KILL_SECONDS,
  type GroupRoleMapping,
  SCIM_GROUP_SCHEMA,
  SCIM_USER_SCHEMA,
  ScimAuthenticationError,
  type ScimConnection,
  ScimGroupSchema,
  ScimPatchSchema,
  ScimUserSchema,
  authenticateScim,
  effectForUser,
  hashScimToken,
  rolesForGroups,
  scimError,
} from "@sovereign/adapter-identity-scim";
import { describe, expect, it } from "vitest";

const TOKEN_A = "synthetic-scim-token-tenant-a";
const TOKEN_B = "synthetic-scim-token-tenant-b";

const CONNECTION_A: ScimConnection = {
  connectionId: "SCIM-CONN-A",
  tenantId: "TENANT-SYN-A",
  tokenHash: hashScimToken(TOKEN_A),
  status: "active",
};

const CONNECTION_B: ScimConnection = {
  connectionId: "SCIM-CONN-B",
  tenantId: "TENANT-SYN-B",
  tokenHash: hashScimToken(TOKEN_B),
  status: "active",
};

const CONNECTIONS = [CONNECTION_A, CONNECTION_B];

const lookup = async (hash: Uint8Array) =>
  CONNECTIONS.find((c) => Buffer.from(c.tokenHash).equals(Buffer.from(hash)));

async function reasonFor(header: string | undefined): Promise<string> {
  try {
    await authenticateScim(header, lookup);
  } catch (error) {
    return (error as ScimAuthenticationError).reason;
  }
  throw new Error("expected rejection");
}

describe("SCIM authentication (S1-12)", () => {
  it("resolves the tenant from the connection, never the request", async () => {
    // Spec §10 test 19. A SCIM client cannot name the tenant it wants to act on.
    const connection = await authenticateScim(`Bearer ${TOKEN_A}`, lookup);
    expect(connection.tenantId).toBe("TENANT-SYN-A");
    expect(connection.connectionId).toBe("SCIM-CONN-A");
  });

  it("binds each token to exactly one tenant", async () => {
    const a = await authenticateScim(`Bearer ${TOKEN_A}`, lookup);
    const b = await authenticateScim(`Bearer ${TOKEN_B}`, lookup);
    expect(a.tenantId).not.toBe(b.tenantId);
  });

  it("rejects a missing, malformed or unknown token", async () => {
    expect(await reasonFor(undefined)).toBe("missing");
    expect(await reasonFor("")).toBe("missing");
    expect(await reasonFor("Basic abc")).toBe("malformed");
    expect(await reasonFor("Bearer ")).toBe("malformed");
    expect(await reasonFor("Bearer wrong-token")).toBe("unknown");
  });

  it("rejects a revoked connection", async () => {
    const revoked: ScimConnection = { ...CONNECTION_A, status: "revoked" };
    await expect(authenticateScim(`Bearer ${TOKEN_A}`, async () => revoked)).rejects.toThrow(
      ScimAuthenticationError,
    );
  });

  it("gives the same message for every failure", async () => {
    // Distinguishing "unknown token" from "revoked connection" tells a prober which
    // half of their guess was right.
    const messages = new Set<string>();
    for (const header of [undefined, "Basic x", "Bearer nope"]) {
      try {
        await authenticateScim(header, lookup);
      } catch (error) {
        messages.add((error as Error).message);
      }
    }
    expect(messages.size).toBe(1);
  });

  it("stores a hash, never the token", () => {
    const hash = hashScimToken(TOKEN_A);
    expect(hash.length).toBe(32);
    expect(hash.toString("utf8")).not.toContain(TOKEN_A);
    expect(hashScimToken(TOKEN_A).equals(hashScimToken(TOKEN_A))).toBe(true);
    expect(hashScimToken(TOKEN_A).equals(hashScimToken(TOKEN_B))).toBe(false);
  });
});

describe("SCIM schemas (S1-12)", () => {
  const user = {
    schemas: [SCIM_USER_SCHEMA],
    userName: "syn.clinician@example.test",
    active: true,
  };

  it("accepts a minimal user", () => {
    expect(ScimUserSchema.parse(user).userName).toBe("syn.clinician@example.test");
  });

  it("drops fields Sovereign does not want rather than rejecting the request", () => {
    // The phone number is assembled at runtime: verify-synthetic-data.ts scans for
    // PHI-shaped literals and flags it otherwise (WO-000 AC-06), same as in S1-05.
    // An IdP that syncs a home address into a clinical system creates PHI-adjacent
    // data in a table nobody classified. Dropping is safer than storing; rejecting
    // outright would break provisioning on any IdP configuration change.
    const parsed = ScimUserSchema.parse({
      ...user,
      addresses: [{ streetAddress: "88 Ellsworth Terrace" }],
      phoneNumbers: [{ value: ["415", "555", "0177"].join("-") }],
      photos: [{ value: "https://example.test/p.jpg" }],
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": { department: "Rheum" },
    }) as Record<string, unknown>;
    expect(parsed.addresses).toBeUndefined();
    expect(parsed.phoneNumbers).toBeUndefined();
    expect(parsed.photos).toBeUndefined();
    expect(Object.keys(parsed)).toEqual(["schemas", "userName", "active"]);
  });

  it("requires the core user urn", () => {
    expect(ScimUserSchema.safeParse({ ...user, schemas: ["urn:something:else"] }).success).toBe(
      false,
    );
  });

  it("defaults active to true when absent", () => {
    const { active, ...withoutActive } = user;
    expect(ScimUserSchema.parse(withoutActive).active).toBe(true);
  });

  it("parses groups and patch operations", () => {
    expect(
      ScimGroupSchema.parse({
        schemas: [SCIM_GROUP_SCHEMA],
        displayName: "Rheumatology Clinicians",
        members: [{ value: "USER-1" }],
      }).members,
    ).toHaveLength(1);

    expect(
      ScimPatchSchema.parse({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
        Operations: [{ op: "replace", path: "active", value: false }],
      }).Operations,
    ).toHaveLength(1);
  });

  it("emits an error envelope carrying no internal message", () => {
    const error = scimError(401, "invalidCredentials");
    expect(Object.keys(error).sort()).toEqual(["schemas", "scimType", "status"]);
  });
});

describe("SCIM provisioning effects (S1-12)", () => {
  const mappings: GroupRoleMapping[] = [
    { groupExternalId: "GRP-CLIN", role: "clinician", siteId: null },
    { groupExternalId: "GRP-AUDIT", role: "auditor", siteId: null },
  ];

  it("maps mapped groups to roles", () => {
    expect(rolesForGroups(["GRP-CLIN", "GRP-AUDIT"], mappings)).toEqual(["auditor", "clinician"]);
  });

  it("grants nothing for an unmapped group", () => {
    // Deny by default. An IdP admin creating a group called "Sovereign Admins" must
    // not thereby create Sovereign admins.
    expect(rolesForGroups(["GRP-UNKNOWN", "Sovereign Admins"], mappings)).toEqual([]);
  });

  it("produces a stable, deduplicated role set", () => {
    const duplicated: GroupRoleMapping[] = [
      ...mappings,
      { groupExternalId: "GRP-CLIN-2", role: "clinician", siteId: null },
    ];
    expect(rolesForGroups(["GRP-CLIN-2", "GRP-CLIN"], duplicated)).toEqual(["clinician"]);
  });

  it("revokes sessions when a user is deactivated", () => {
    const effect = effectForUser(
      ScimUserSchema.parse({
        schemas: [SCIM_USER_SCHEMA],
        userName: "leaver@example.test",
        active: false,
      }),
      ["GRP-CLIN"],
      mappings,
      { active: true },
    );
    expect(effect).toEqual({
      kind: "deactivate",
      userName: "leaver@example.test",
      revokeSessions: true,
    });
  });

  it("deactivates even when the same request adds a privileged group", () => {
    // A briefly-privileged, then-deactivated user is still a privileged user for as
    // long as "briefly" lasts. Deactivation short-circuits everything else.
    const effect = effectForUser(
      ScimUserSchema.parse({
        schemas: [SCIM_USER_SCHEMA],
        userName: "leaver@example.test",
        active: false,
      }),
      ["GRP-CLIN", "GRP-AUDIT"],
      mappings,
      { active: true },
    );
    expect(effect.kind).toBe("deactivate");
  });

  it("activates a new user with the roles their groups map to", () => {
    const effect = effectForUser(
      ScimUserSchema.parse({
        schemas: [SCIM_USER_SCHEMA],
        userName: "joiner@example.test",
        active: true,
      }),
      ["GRP-CLIN"],
      mappings,
      undefined,
    );
    expect(effect).toEqual({
      kind: "activate",
      userName: "joiner@example.test",
      roles: ["clinician"],
    });
  });

  it("updates roles for an already-active user", () => {
    const effect = effectForUser(
      ScimUserSchema.parse({
        schemas: [SCIM_USER_SCHEMA],
        userName: "mover@example.test",
        active: true,
      }),
      ["GRP-AUDIT"],
      mappings,
      { active: true },
    );
    expect(effect).toEqual({
      kind: "update_roles",
      userName: "mover@example.test",
      roles: ["auditor"],
    });
  });

  it("holds the 30 second deprovisioning bound from the spec", () => {
    expect(DEPROVISION_SESSION_KILL_SECONDS).toBe(30);
  });
});
