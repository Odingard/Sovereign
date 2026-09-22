/**
 * @file File-backed fake KMS (WO-002C S1-07)
 * @description A KeyManagementPort implementation for local dev and CI only.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.3 — "Local dev/CI: file-backed fake KMS
 * implementation of the port." ADR-0004 (local-first), ADR-0007 §1 (local dev is
 * offline-capable, synthetic only, zero cloud credentials).
 *
 * This exists so the whole encryption path — generate, wrap, unwrap, rotate,
 * crypto-shred — can be exercised with no cloud account and no spend. It is a real
 * implementation of the port, not a stub, which is how we learn whether the port is
 * actually a port (ADR-0012 §Consequences makes the same argument for the IdP).
 *
 * IT IS NOT SECURE AND MUST NEVER RUN OUTSIDE LOCAL DEV OR CI. Key material sits in
 * a plain file on disk. The guard below refuses to construct one when NODE_ENV is
 * "production", which is a tripwire rather than a security control — the real
 * control is that no cloud environment ever wires this class in.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  DEK_LENGTH_BYTES,
  type KekResource,
  KeyDestroyedError,
  type KeyId,
  type KeyManagementPort,
  KeyUnavailableError,
  type WrappedDek,
} from "./key-management-port.js";

interface KeyVersionRecord {
  /** Hex-encoded KEK material. Plain on disk — see the warning above. */
  readonly material: string;
  destroyed: boolean;
}

interface FakeKmsFile {
  readonly version: 1;
  /** kekResource -> keyId -> record */
  readonly keys: Record<string, Record<string, KeyVersionRecord>>;
}

const WRAP_IV_BYTES = 12;
const WRAP_TAG_BYTES = 16;

export class FakeKeyManagementService implements KeyManagementPort {
  private readonly path: string;

  constructor(path: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FakeKeyManagementService must never run in production. Wire a real KeyManagementPort adapter.",
      );
    }
    this.path = path;
  }

  private read(): FakeKmsFile {
    try {
      return JSON.parse(readFileSync(this.path, "utf8")) as FakeKmsFile;
    } catch {
      return { version: 1, keys: {} };
    }
  }

  private write(file: FakeKmsFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    // 0600: readable only by the running user. Cosmetic here, but it keeps the
    // local story honest about what this file contains.
    writeFileSync(this.path, JSON.stringify(file, null, 2), { mode: 0o600 });
  }

  /** Create a KEK version. Real KMS provisions these out of band; here it is explicit. */
  createKeyVersion(kekResource: KekResource, keyId: KeyId): void {
    const file = this.read();
    const versions = file.keys[kekResource] ?? {};
    versions[keyId] = { material: randomBytes(32).toString("hex"), destroyed: false };
    this.write({ version: 1, keys: { ...file.keys, [kekResource]: versions } });
  }

  private kekMaterial(kekResource: KekResource, keyId: KeyId): Buffer {
    const record = this.read().keys[kekResource]?.[keyId];
    if (record === undefined) {
      throw new KeyUnavailableError(`No such key version: ${keyId}`, kekResource);
    }
    if (record.destroyed) {
      throw new KeyDestroyedError(
        "Key version was destroyed; data under it is unrecoverable by design",
        kekResource,
        keyId,
      );
    }
    return Buffer.from(record.material, "hex");
  }

  /** Newest non-destroyed version, so callers need not track rotation. */
  private latestKeyId(kekResource: KekResource): KeyId {
    const versions = this.read().keys[kekResource];
    const live = Object.entries(versions ?? {})
      .filter(([, r]) => !r.destroyed)
      .map(([id]) => id)
      .sort();
    const newest = live.at(-1);
    if (newest === undefined) {
      throw new KeyUnavailableError("No live key version", kekResource);
    }
    return newest;
  }

  async generateDek(kekResource: KekResource): Promise<{ dek: Uint8Array; wrapped: WrappedDek }> {
    const keyId = this.latestKeyId(kekResource);
    const dek = randomBytes(DEK_LENGTH_BYTES);
    const kek = this.kekMaterial(kekResource, keyId);
    const iv = randomBytes(WRAP_IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", kek, iv, { authTagLength: WRAP_TAG_BYTES });
    const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
    return {
      dek,
      wrapped: {
        wrapped: Buffer.concat([iv, cipher.getAuthTag(), ct]),
        kekResource,
        keyId,
      },
    };
  }

  async unwrapDek(wrapped: WrappedDek): Promise<Uint8Array> {
    const kek = this.kekMaterial(wrapped.kekResource, wrapped.keyId);
    const buf = Buffer.from(wrapped.wrapped);
    if (buf.length < WRAP_IV_BYTES + WRAP_TAG_BYTES) {
      throw new KeyUnavailableError("Malformed wrapped DEK", wrapped.kekResource);
    }
    const iv = buf.subarray(0, WRAP_IV_BYTES);
    const tag = buf.subarray(WRAP_IV_BYTES, WRAP_IV_BYTES + WRAP_TAG_BYTES);
    const ct = buf.subarray(WRAP_IV_BYTES + WRAP_TAG_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", kek, iv, { authTagLength: WRAP_TAG_BYTES });
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(ct), decipher.final()]);
    } catch {
      throw new KeyUnavailableError("Failed to unwrap DEK", wrapped.kekResource);
    }
  }

  async destroyKeyVersion(kekResource: KekResource, keyId: KeyId): Promise<void> {
    const file = this.read();
    const record = file.keys[kekResource]?.[keyId];
    if (record === undefined) {
      throw new KeyUnavailableError(`No such key version: ${keyId}`, kekResource);
    }
    record.destroyed = true;
    // Material is dropped, not just flagged — a shred that leaves the key on disk is
    // not a shred.
    file.keys[kekResource][keyId] = { material: "", destroyed: true };
    this.write(file);
  }
}
