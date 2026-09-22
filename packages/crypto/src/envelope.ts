/**
 * @file Per-tenant envelope encryption (WO-002C S1-07)
 * @description AES-256-GCM field encryption under a tenant's DEK.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.3, S1-D10.
 *
 * Two properties this file exists to guarantee:
 *
 * 1. A ciphertext is bound to its tenant. The tenant id is authenticated as
 *    additional data (AAD), so a row copied from tenant A into tenant B fails to
 *    decrypt rather than decrypting into the wrong tenant. RLS (ADR-0009) is the
 *    first defence against cross-tenant reads; this is the last one, and it holds
 *    even if a database-level control is misconfigured.
 *
 * 2. Every encryption uses a fresh random IV. GCM catastrophically loses
 *    confidentiality and authenticity if an IV is reused under the same key, so the
 *    IV is never derived, never a counter, and never supplied by a caller.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/** 96-bit IV, the size GCM is specified and optimised for. */
export const IV_LENGTH_BYTES = 12 as const;
/** 128-bit authentication tag. */
export const TAG_LENGTH_BYTES = 16 as const;
/** Envelope format version. Bump only for a breaking layout change. */
export const ENVELOPE_VERSION = 1 as const;

export interface Envelope {
  readonly v: typeof ENVELOPE_VERSION;
  /** The key version that produced this ciphertext, so rotation does not strand data. */
  readonly kid: string;
  readonly iv: Uint8Array;
  readonly ct: Uint8Array;
  readonly tag: Uint8Array;
}

export class DecryptionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionFailedError";
  }
}

function assertDekLength(dek: Uint8Array): void {
  if (dek.length !== 32) {
    throw new DecryptionFailedError(`DEK must be 32 bytes for AES-256, received ${dek.length}`);
  }
}

/**
 * Bind a ciphertext to its tenant.
 *
 * Passed to GCM as additional authenticated data: not encrypted, but covered by the
 * tag, so any change to it makes decryption fail.
 */
function aadFor(tenantId: string): Buffer {
  if (tenantId.length === 0) {
    throw new DecryptionFailedError("tenantId is required to bind a ciphertext to a tenant");
  }
  return Buffer.from(`sovereign:v1:tenant:${tenantId}`, "utf8");
}

/** Encrypt `plaintext` under `dek`, bound to `tenantId`. */
export function encryptField(
  dek: Uint8Array,
  keyId: string,
  tenantId: string,
  plaintext: string | Uint8Array,
): Envelope {
  assertDekLength(dek);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", dek, iv, { authTagLength: TAG_LENGTH_BYTES });
  cipher.setAAD(aadFor(tenantId));
  const input = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ct = Buffer.concat([cipher.update(input), cipher.final()]);
  return { v: ENVELOPE_VERSION, kid: keyId, iv, ct, tag: cipher.getAuthTag() };
}

/**
 * Decrypt an envelope. Throws if the tag fails, the tenant does not match, or the
 * envelope was produced by a different format version.
 *
 * Failure is never partial: GCM verifies the tag before returning plaintext, so a
 * tampered ciphertext yields an error rather than corrupted data.
 */
export function decryptField(dek: Uint8Array, tenantId: string, envelope: Envelope): Buffer {
  assertDekLength(dek);
  if (envelope.v !== ENVELOPE_VERSION) {
    throw new DecryptionFailedError(`Unsupported envelope version ${envelope.v}`);
  }
  if (envelope.iv.length !== IV_LENGTH_BYTES) {
    throw new DecryptionFailedError("Malformed envelope: bad IV length");
  }
  if (envelope.tag.length !== TAG_LENGTH_BYTES) {
    throw new DecryptionFailedError("Malformed envelope: bad tag length");
  }
  const decipher = createDecipheriv("aes-256-gcm", dek, envelope.iv, {
    authTagLength: TAG_LENGTH_BYTES,
  });
  decipher.setAAD(aadFor(tenantId));
  decipher.setAuthTag(envelope.tag);
  try {
    return Buffer.concat([decipher.update(envelope.ct), decipher.final()]);
  } catch {
    // The underlying message is deliberately discarded. Distinguishing "wrong key"
    // from "wrong tenant" from "tampered" would tell an attacker which guess was
    // closer (AGENTS.md: error_code only, never internal messages).
    throw new DecryptionFailedError("Authenticated decryption failed");
  }
}

/**
 * Serialize an envelope for a `bytea` column.
 *
 * Layout: [version:1][kidLen:1][kid][iv:12][tag:16][ct:*]
 * Fixed-width fields avoid any length ambiguity on parse.
 */
export function serializeEnvelope(envelope: Envelope): Buffer {
  const kid = Buffer.from(envelope.kid, "utf8");
  if (kid.length > 255) {
    throw new DecryptionFailedError("kid exceeds 255 bytes");
  }
  return Buffer.concat([
    Buffer.from([envelope.v, kid.length]),
    kid,
    envelope.iv,
    envelope.tag,
    envelope.ct,
  ]);
}

export function deserializeEnvelope(bytes: Uint8Array): Envelope {
  const buf = Buffer.from(bytes);
  const minimum = 2 + IV_LENGTH_BYTES + TAG_LENGTH_BYTES;
  if (buf.length < minimum) {
    throw new DecryptionFailedError("Malformed envelope: too short");
  }
  const v = buf[0];
  if (v !== ENVELOPE_VERSION) {
    throw new DecryptionFailedError(`Unsupported envelope version ${v}`);
  }
  const kidLen = buf[1] as number;
  let offset = 2;
  if (buf.length < minimum + kidLen) {
    throw new DecryptionFailedError("Malformed envelope: truncated");
  }
  const kid = buf.subarray(offset, offset + kidLen).toString("utf8");
  offset += kidLen;
  const iv = buf.subarray(offset, offset + IV_LENGTH_BYTES);
  offset += IV_LENGTH_BYTES;
  const tag = buf.subarray(offset, offset + TAG_LENGTH_BYTES);
  offset += TAG_LENGTH_BYTES;
  return { v: ENVELOPE_VERSION, kid, iv, ct: buf.subarray(offset), tag };
}

/** Constant-time comparison, for any place a secret is compared. */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
