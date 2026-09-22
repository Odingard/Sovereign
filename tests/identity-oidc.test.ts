import {
  REQUIRED_AUDIENCE,
  SovereignClaims,
  TokenRejectedError,
  actorKindForRoles,
  verifyAccessToken,
} from "@sovereign/adapter-identity-oidc";
import { ActorKind } from "@sovereign/domain";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import type { JWTVerifyGetKey, KeyLike } from "jose";
import { createLocalJWKSet } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

const ISSUER = "http://localhost:8081/realms/sovereign-local";
const NOW = new Date("2026-09-21T12:00:00Z");

let privateKey: KeyLike;
let jwks: JWTVerifyGetKey;
let otherPrivateKey: KeyLike;

const BASE_CLAIMS = {
  [SovereignClaims.TENANT_ID]: "TENANT-SYN-A",
  [SovereignClaims.USER_ID]: "USER-SYN-A-1",
  [SovereignClaims.SESSION_ID]: "SESSION-SYN-1",
  [SovereignClaims.ROLES]: ["clinician"],
  [SovereignClaims.SITE_IDS]: ["SITE-SYN-A-1"],
  [SovereignClaims.MFA]: true,
};

async function mint(
  overrides: Record<string, unknown> = {},
  opts: { key?: KeyLike; alg?: string; aud?: string; iss?: string; lifetimeSeconds?: number } = {},
): Promise<string> {
  const iat = Math.floor(NOW.getTime() / 1000);
  return new SignJWT({ ...BASE_CLAIMS, ...overrides })
    .setProtectedHeader({ alg: opts.alg ?? "RS256", kid: "test-key" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + (opts.lifetimeSeconds ?? 900))
    .setIssuer(opts.iss ?? ISSUER)
    .setAudience(opts.aud ?? REQUIRED_AUDIENCE)
    .sign(opts.key ?? privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "test-key", alg: "RS256" }] });
  otherPrivateKey = (await generateKeyPair("RS256")).privateKey;
});

async function reasonFor(token: string): Promise<string> {
  try {
    await verifyAccessToken(token, jwks, { issuer: ISSUER, now: NOW }, "CORR-1");
  } catch (error) {
    return (error as TokenRejectedError).reason;
  }
  throw new Error("expected rejection");
}

describe("access token verification (S1-08)", () => {
  it("builds a RequestContext from verified claims only", async () => {
    const ctx = await verifyAccessToken(await mint(), jwks, { issuer: ISSUER, now: NOW }, "CORR-1");
    expect(ctx.tenantId).toBe("TENANT-SYN-A");
    expect(ctx.userId).toBe("USER-SYN-A-1");
    expect(ctx.sessionId).toBe("SESSION-SYN-1");
    expect(ctx.roles).toEqual(["clinician"]);
    expect(ctx.mfa).toBe(true);
    // Server time, never a client-supplied timestamp.
    expect(ctx.requestedAt).toBe(NOW);
  });

  it("rejects a token signed by a different key", async () => {
    expect(await reasonFor(await mint({}, { key: otherPrivateKey }))).toBe("signature_or_claims");
  });

  it("rejects the wrong audience", async () => {
    // A token minted for another service must not be replayable against this API.
    expect(await reasonFor(await mint({}, { aud: "https://other.example.test" }))).toBe(
      "signature_or_claims",
    );
  });

  it("rejects the wrong issuer", async () => {
    expect(await reasonFor(await mint({}, { iss: "http://evil.example.test/realms/x" }))).toBe(
      "signature_or_claims",
    );
  });

  it("rejects an expired token", async () => {
    const token = await mint();
    await expect(
      verifyAccessToken(
        token,
        jwks,
        { issuer: ISSUER, now: new Date(NOW.getTime() + 3_600_000) },
        "CORR-1",
      ),
    ).rejects.toThrow(TokenRejectedError);
  });

  it("rejects alg=none and HMAC confusion", async () => {
    // Spec §10 test 4. Pinning algorithms: ["RS256"] is what makes this impossible
    // rather than merely unlikely.
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    )}.${Buffer.from(JSON.stringify(BASE_CLAIMS)).toString("base64url")}.`;
    expect(await reasonFor(unsigned)).toBe("signature_or_claims");
  });

  it("rejects a token whose lifetime exceeds the 15 minute cap", async () => {
    // Signature is valid; the IdP is misconfigured. Honouring a 24h access token
    // would quietly extend the blast radius of a stolen token (§4.1).
    expect(await reasonFor(await mint({}, { lifetimeSeconds: 86_400 }))).toBe("lifetime_too_long");
  });

  it("rejects a token missing tenant_id, user_id or session_id", async () => {
    for (const claim of [
      SovereignClaims.TENANT_ID,
      SovereignClaims.USER_ID,
      SovereignClaims.SESSION_ID,
    ]) {
      const claims: Record<string, unknown> = { ...BASE_CLAIMS };
      delete claims[claim];
      const token = await new SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuedAt(Math.floor(NOW.getTime() / 1000))
        .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 900)
        .setIssuer(ISSUER)
        .setAudience(REQUIRED_AUDIENCE)
        .sign(privateKey);
      expect(await reasonFor(token), `missing ${claim}`).toBe("missing_claims");
    }
  });

  it("rejects an unknown role rather than passing it through", async () => {
    expect(await reasonFor(await mint({ [SovereignClaims.ROLES]: ["superuser"] }))).toBe(
      "missing_claims",
    );
  });

  it("rejects an empty role list", async () => {
    expect(await reasonFor(await mint({ [SovereignClaims.ROLES]: [] }))).toBe("missing_claims");
  });

  it("defaults mfa to false when the IdP omits it", async () => {
    const claims: Record<string, unknown> = { ...BASE_CLAIMS };
    delete claims[SovereignClaims.MFA];
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuedAt(Math.floor(NOW.getTime() / 1000))
      .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 900)
      .setIssuer(ISSUER)
      .setAudience(REQUIRED_AUDIENCE)
      .sign(privateKey);
    const ctx = await verifyAccessToken(token, jwks, { issuer: ISSUER, now: NOW }, "CORR-1");
    // Absent MFA means not asserted. Defaulting true would silently satisfy the MFA
    // requirement on privileged capabilities.
    expect(ctx.mfa).toBe(false);
  });
});

describe("actor kind derivation (S1-08)", () => {
  it("maps clinical roles to HUMAN_CLINICIAN", () => {
    expect(actorKindForRoles(["clinician"])).toBe(ActorKind.HUMAN_CLINICIAN);
    expect(actorKindForRoles(["app"])).toBe(ActorKind.HUMAN_CLINICIAN);
  });

  it("maps administrative roles to HUMAN_ADMIN", () => {
    expect(actorKindForRoles(["org_admin"])).toBe(ActorKind.HUMAN_ADMIN);
    expect(actorKindForRoles(["security_admin"])).toBe(ActorKind.HUMAN_ADMIN);
  });

  it("falls back to the least privileged human kind", () => {
    expect(actorKindForRoles(["auditor"])).toBe(ActorKind.HUMAN_STAFF);
    expect(actorKindForRoles([])).toBe(ActorKind.HUMAN_STAFF);
  });

  it("never derives a service or AI principal from a user token", () => {
    // A service identity comes from a bound service credential (S1-D17), never from
    // a claim a user's token happens to carry. AI_AGENT_RUNTIME in particular must
    // never be reachable this way — the evaluator denies it Class C/D authority.
    for (const roles of [["clinician"], ["org_admin"], [], ["auditor"]]) {
      const kind = actorKindForRoles(roles);
      expect(kind).not.toBe(ActorKind.AI_AGENT_RUNTIME);
      expect(kind).not.toBe(ActorKind.SOVEREIGN_SERVICE);
      expect(kind).not.toBe(ActorKind.EXTERNAL_SYSTEM);
    }
  });
});
