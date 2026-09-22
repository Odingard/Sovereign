import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DecryptionFailedError,
  DekCache,
  ENVELOPE_VERSION,
  FakeKeyManagementService,
  GENESIS_HASH,
  IV_LENGTH_BYTES,
  KeyDestroyedError,
  KeyUnavailableError,
  TAG_LENGTH_BYTES,
  canonicalJson,
  chainHash,
  constantTimeEquals,
  decryptField,
  deserializeEnvelope,
  encryptField,
  serializeEnvelope,
  sha256,
  sha256Hex,
} from "@sovereign/crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const TENANT_A = "TENANT-SYN-A";
const TENANT_B = "TENANT-SYN-B";
const KEK = "fake://sovereign-dev-kr/tenant-kek";
const DEK_A = Buffer.alloc(32, 0x11);
const DEK_B = Buffer.alloc(32, 0x22);

describe("envelope encryption (S1-07)", () => {
  it("round-trips a value", () => {
    const env = encryptField(DEK_A, "kid-1", TENANT_A, "synthetic demographics");
    expect(decryptField(DEK_A, TENANT_A, env).toString("utf8")).toBe("synthetic demographics");
  });

  it("round-trips raw bytes as well as strings", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x10, 0x7f]);
    const env = encryptField(DEK_A, "kid-1", TENANT_A, bytes);
    expect(new Uint8Array(decryptField(DEK_A, TENANT_A, env))).toEqual(bytes);
  });

  it("refuses a ciphertext moved to another tenant", () => {
    // The last line of defence behind RLS. A row copied from A into B must not
    // decrypt, even with the right key, because tenantId is authenticated as AAD.
    const env = encryptField(DEK_A, "kid-1", TENANT_A, "tenant A demographics");
    expect(() => decryptField(DEK_A, TENANT_B, env)).toThrow(DecryptionFailedError);
  });

  it("refuses a tampered ciphertext", () => {
    const env = encryptField(DEK_A, "kid-1", TENANT_A, "synthetic");
    const ct = Buffer.from(env.ct);
    ct[0] ^= 0xff;
    expect(() => decryptField(DEK_A, TENANT_A, { ...env, ct })).toThrow(DecryptionFailedError);
  });

  it("refuses a tampered authentication tag", () => {
    const env = encryptField(DEK_A, "kid-1", TENANT_A, "synthetic");
    const tag = Buffer.from(env.tag);
    tag[0] ^= 0xff;
    expect(() => decryptField(DEK_A, TENANT_A, { ...env, tag })).toThrow(DecryptionFailedError);
  });

  it("refuses the wrong key", () => {
    const env = encryptField(DEK_A, "kid-1", TENANT_A, "synthetic");
    expect(() => decryptField(DEK_B, TENANT_A, env)).toThrow(DecryptionFailedError);
  });

  it("uses a fresh IV every time", () => {
    // GCM loses both confidentiality and authenticity if an IV repeats under one key.
    const ivs = new Set<string>();
    for (let i = 0; i < 200; i++) {
      ivs.add(
        Buffer.from(encryptField(DEK_A, "kid-1", TENANT_A, "same plaintext").iv).toString("hex"),
      );
    }
    expect(ivs.size).toBe(200);
  });

  it("produces different ciphertext for identical plaintext", () => {
    const a = encryptField(DEK_A, "kid-1", TENANT_A, "same");
    const b = encryptField(DEK_A, "kid-1", TENANT_A, "same");
    expect(Buffer.from(a.ct).toString("hex")).not.toBe(Buffer.from(b.ct).toString("hex"));
  });

  it("rejects a DEK that is not 32 bytes", () => {
    expect(() => encryptField(Buffer.alloc(16, 1), "kid-1", TENANT_A, "x")).toThrow(
      DecryptionFailedError,
    );
  });

  it("requires a tenant id", () => {
    expect(() => encryptField(DEK_A, "kid-1", "", "x")).toThrow(DecryptionFailedError);
  });

  it("matches a known-answer vector", () => {
    // Pins AES-256-GCM with our exact AAD construction. If this breaks, either the
    // algorithm parameters or the AAD format changed, and every stored ciphertext
    // in every environment is affected.
    const dek = Buffer.alloc(32, 0x2b);
    const env = {
      v: ENVELOPE_VERSION,
      kid: "kat",
      iv: Buffer.alloc(12, 0x7c),
      ct: Buffer.from("e275ac4f4b0bb8c34663186ae3f91de4c0f04302f6a985cef92031", "hex"),
      tag: Buffer.from("2207a9ff6a74170b4c49aa0720707db0", "hex"),
    } as const;
    expect(decryptField(dek, "TENANT-SYN-KAT", env).toString("utf8")).toBe(
      "synthetic demographics blob",
    );
  });

  it("round-trips through bytea serialization", () => {
    const env = encryptField(DEK_A, "kid-long-name-v2", TENANT_A, "synthetic");
    const back = deserializeEnvelope(serializeEnvelope(env));
    expect(back.kid).toBe("kid-long-name-v2");
    expect(decryptField(DEK_A, TENANT_A, back).toString("utf8")).toBe("synthetic");
  });

  it("rejects malformed serialized envelopes", () => {
    expect(() => deserializeEnvelope(Buffer.alloc(4))).toThrow(DecryptionFailedError);
    const good = serializeEnvelope(encryptField(DEK_A, "k", TENANT_A, "x"));
    const badVersion = Buffer.from(good);
    badVersion[0] = 9;
    expect(() => deserializeEnvelope(badVersion)).toThrow(DecryptionFailedError);
    expect(() => deserializeEnvelope(good.subarray(0, 20))).toThrow(DecryptionFailedError);
  });

  it("rejects envelopes with bad IV or tag lengths", () => {
    const env = encryptField(DEK_A, "k", TENANT_A, "x");
    expect(() => decryptField(DEK_A, TENANT_A, { ...env, iv: Buffer.alloc(8) })).toThrow(
      DecryptionFailedError,
    );
    expect(() => decryptField(DEK_A, TENANT_A, { ...env, tag: Buffer.alloc(8) })).toThrow(
      DecryptionFailedError,
    );
    expect(() => decryptField(DEK_A, TENANT_A, { ...env, v: 2 as never })).toThrow(
      DecryptionFailedError,
    );
  });

  it("rejects an envelope truncated after the kid length byte", () => {
    // Header claims a 200-byte kid but the buffer cannot hold it.
    const truncated = Buffer.concat([Buffer.from([1, 200]), Buffer.alloc(30)]);
    expect(() => deserializeEnvelope(truncated)).toThrow(DecryptionFailedError);
  });

  it("rejects an over-long kid", () => {
    const env = encryptField(DEK_A, "k".repeat(300), TENANT_A, "x");
    expect(() => serializeEnvelope(env)).toThrow(DecryptionFailedError);
  });

  it("uses standard GCM parameter sizes", () => {
    const env = encryptField(DEK_A, "k", TENANT_A, "x");
    expect(env.iv.length).toBe(IV_LENGTH_BYTES);
    expect(env.tag.length).toBe(TAG_LENGTH_BYTES);
  });

  it("compares secrets in constant time", () => {
    expect(constantTimeEquals(Buffer.from("abc"), Buffer.from("abc"))).toBe(true);
    expect(constantTimeEquals(Buffer.from("abc"), Buffer.from("abd"))).toBe(false);
    expect(constantTimeEquals(Buffer.from("abc"), Buffer.from("ab"))).toBe(false);
  });
});

describe("fake KMS (S1-07)", () => {
  let dir: string;
  let kms: FakeKeyManagementService;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "sovereign-kms-"));
    kms = new FakeKeyManagementService(join(dir, "keys.json"));
    kms.createKeyVersion(KEK, "v1");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("wraps and unwraps a DEK", async () => {
    const { dek, wrapped } = await kms.generateDek(KEK);
    expect(dek.length).toBe(32);
    expect(Buffer.from(wrapped.wrapped).toString("hex")).not.toContain(
      Buffer.from(dek).toString("hex"),
    );
    expect(Buffer.from(await kms.unwrapDek(wrapped))).toEqual(Buffer.from(dek));
  });

  it("encrypts under a wrapped DEK end to end", async () => {
    const { dek, wrapped } = await kms.generateDek(KEK);
    const env = encryptField(dek, wrapped.keyId, TENANT_A, "synthetic PHI column");
    const recovered = await kms.unwrapDek(wrapped);
    expect(decryptField(recovered, TENANT_A, env).toString("utf8")).toBe("synthetic PHI column");
  });

  it("uses the newest live key version after rotation", async () => {
    kms.createKeyVersion(KEK, "v2");
    const { wrapped } = await kms.generateDek(KEK);
    expect(wrapped.keyId).toBe("v2");
  });

  it("makes data unrecoverable after crypto-shred", async () => {
    kms.createKeyVersion(KEK, "v-shred");
    const file = join(dir, "shred.json");
    const shredKms = new FakeKeyManagementService(file);
    shredKms.createKeyVersion(KEK, "v1");
    const { dek, wrapped } = await shredKms.generateDek(KEK);
    const env = encryptField(dek, wrapped.keyId, TENANT_A, "synthetic");

    await shredKms.destroyKeyVersion(KEK, "v1");

    // Distinct from KeyUnavailableError: destroyed is permanent, retrying is pointless.
    await expect(shredKms.unwrapDek(wrapped)).rejects.toThrow(KeyDestroyedError);
    // The ciphertext survives; nothing can open it. That is the point of crypto-shred.
    expect(env.ct.length).toBeGreaterThan(0);
  });

  it("reports an unknown key version as unavailable", async () => {
    await expect(
      kms.unwrapDek({ wrapped: Buffer.alloc(40), kekResource: KEK, keyId: "nope" }),
    ).rejects.toThrow(KeyUnavailableError);
  });

  it("rejects a malformed wrapped DEK", async () => {
    await expect(
      kms.unwrapDek({ wrapped: Buffer.alloc(4), kekResource: KEK, keyId: "v1" }),
    ).rejects.toThrow(KeyUnavailableError);
  });

  it("reports a wrapped DEK that fails authentication as unavailable", async () => {
    // Correct length so it passes the shape check, but the tag will not verify.
    await expect(
      kms.unwrapDek({ wrapped: Buffer.alloc(60, 0x5a), kekResource: KEK, keyId: "v1" }),
    ).rejects.toThrow(KeyUnavailableError);
  });

  it("reports an unknown KEK as unavailable", async () => {
    await expect(kms.generateDek("fake://nonexistent")).rejects.toThrow(KeyUnavailableError);
    await expect(kms.destroyKeyVersion(KEK, "nope")).rejects.toThrow(KeyUnavailableError);
  });

  it("refuses to construct in production", () => {
    // NODE_ENV is typed readonly, so mutate through the record view.
    const env = process.env as Record<string, string | undefined>;
    const prior = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      expect(() => new FakeKeyManagementService(join(dir, "x.json"))).toThrow(
        /never run in production/,
      );
    } finally {
      env.NODE_ENV = prior;
    }
  });
});

describe("DEK cache (S1-07)", () => {
  it("returns a cached DEK within the TTL", () => {
    let now = 1000;
    const cache = new DekCache(5000, () => now);
    cache.set(TENANT_A, Buffer.from(DEK_A), "v1");
    now = 4000;
    expect(cache.get(TENANT_A)?.keyId).toBe("v1");
  });

  it("expires a DEK after the TTL", () => {
    let now = 1000;
    const cache = new DekCache(5000, () => now);
    cache.set(TENANT_A, Buffer.from(DEK_A), "v1");
    now = 6001;
    expect(cache.get(TENANT_A)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("zeroes key material on eviction", () => {
    // Best-effort scrub so a later heap dump is less likely to contain the key.
    const cache = new DekCache();
    const dek = Buffer.from(DEK_A);
    cache.set(TENANT_A, dek, "v1");
    cache.evict(TENANT_A);
    expect(Buffer.from(dek).every((b) => b === 0)).toBe(true);
  });

  it("zeroes the superseded key when an entry is replaced", () => {
    const cache = new DekCache();
    const old = Buffer.from(DEK_A);
    cache.set(TENANT_A, old, "v1");
    cache.set(TENANT_A, Buffer.from(DEK_B), "v2");
    expect(Buffer.from(old).every((b) => b === 0)).toBe(true);
    expect(cache.get(TENANT_A)?.keyId).toBe("v2");
  });

  it("isolates tenants and clears everything on demand", () => {
    const cache = new DekCache();
    cache.set(TENANT_A, Buffer.from(DEK_A), "v1");
    cache.set(TENANT_B, Buffer.from(DEK_B), "v1");
    expect(cache.get(TENANT_A)?.dek).not.toEqual(cache.get(TENANT_B)?.dek);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get(TENANT_A)).toBeUndefined();
  });

  it("returns undefined for an unknown tenant", () => {
    expect(new DekCache().get("TENANT-NONE")).toBeUndefined();
  });
});

describe("hashing (S1-07)", () => {
  it("produces lowercase hex sha256", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("returns raw digest bytes as well as hex", () => {
    expect(sha256("abc").toString("hex")).toBe(sha256Hex("abc"));
    expect(sha256("abc").length).toBe(32);
  });

  it("canonicalizes independently of key order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("canonicalizes nested structures, dates, bigints and bytes", () => {
    expect(canonicalJson({ z: { y: 1, x: 2 }, a: [3, { c: 1, b: 2 }] })).toBe(
      '{"a":[3,{"b":2,"c":1}],"z":{"x":2,"y":1}}',
    );
    expect(canonicalJson({ at: new Date("2026-09-21T00:00:00Z") })).toBe(
      '{"at":"2026-09-21T00:00:00.000Z"}',
    );
    // seq is a bigint in the audit chain and would otherwise throw.
    expect(canonicalJson({ seq: 42n })).toBe('{"seq":"42"}');
    expect(canonicalJson({ b: new Uint8Array([0xde, 0xad]) })).toBe('{"b":"dead"}');
  });

  it("drops undefined but keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("chains deterministically and changes when any field changes", () => {
    const event = { action: "patient.read", tenantId: TENANT_A };
    const first = chainHash(GENESIS_HASH, event);
    expect(chainHash(GENESIS_HASH, { tenantId: TENANT_A, action: "patient.read" })).toBe(first);
    expect(chainHash(GENESIS_HASH, { ...event, action: "patient.write" })).not.toBe(first);
    expect(chainHash(first, event)).not.toBe(first);
  });

  it("starts a tenant chain from a 64-zero genesis hash", () => {
    expect(GENESIS_HASH).toMatch(/^0{64}$/);
  });
});
