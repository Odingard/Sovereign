/**
 * @file KeyManagementPort (WO-002C S1-07)
 * @description The boundary between Sovereign and any key-management vendor.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §5.3, S1-D10, S1-D19, ADR-0007 §3.
 *
 * The port is defined here; implementations live elsewhere. A Cloud KMS adapter must
 * never be imported into this package — `scripts/verify-architecture.ts` fails the
 * build if it is (ADR-0011 tier rule).
 *
 * Key hierarchy:
 *   KEK   lives in the KMS/HSM, never leaves it, wraps and unwraps DEKs
 *   DEK   256-bit, one per tenant, decrypted in memory only for the life of a request
 *
 * BYOK (S1-D19) is configuration, not a code path: an enterprise tenant's
 * `kekResource` simply points at a key in their own project or an external EKM.
 */

/**
 * A fully-qualified KEK reference. On GCP this is a Cloud KMS resource name; for the
 * local fake it is an opaque identifier. Sovereign never parses it.
 */
export type KekResource = string;

/**
 * Identifies which key version produced a ciphertext, so rotation does not strand
 * existing data. Written into every envelope as `kid`.
 */
export type KeyId = string;

export interface WrappedDek {
  /** The DEK encrypted under the KEK. Never plaintext. */
  readonly wrapped: Uint8Array;
  /** The KEK that wrapped it. */
  readonly kekResource: KekResource;
  /** The KEK version, recorded so rotation is auditable. */
  readonly keyId: KeyId;
}

/**
 * Key management operations Sovereign depends on.
 *
 * Deliberately small. Everything the domain needs is wrap, unwrap, and destroy.
 * Anything larger leaks vendor semantics across the boundary.
 */
export interface KeyManagementPort {
  /** Generate a new 256-bit DEK and return it wrapped. Plaintext is never persisted. */
  generateDek(kekResource: KekResource): Promise<{ dek: Uint8Array; wrapped: WrappedDek }>;

  /** Recover a DEK for use in memory. */
  unwrapDek(wrapped: WrappedDek): Promise<Uint8Array>;

  /**
   * Crypto-shred: destroy the KEK version so every DEK wrapped under it becomes
   * permanently unrecoverable, and with it every ciphertext under those DEKs.
   *
   * IRREVERSIBLE. Spec §7.8 requires a legal-hold check and dual-control approval
   * before this is called. This port enforces neither — those are workflow concerns
   * in `services/identity`. A port that silently enforced policy would hide it.
   */
  destroyKeyVersion(kekResource: KekResource, keyId: KeyId): Promise<void>;
}

/** Raised when key material cannot be recovered. Never carries key bytes. */
export class KeyUnavailableError extends Error {
  constructor(
    message: string,
    readonly kekResource: KekResource,
  ) {
    super(message);
    this.name = "KeyUnavailableError";
  }
}

/**
 * Raised when a destroyed key version is used.
 *
 * Distinct from KeyUnavailableError on purpose: "unavailable" may be transient and
 * should fail closed but be retried, while "destroyed" is permanent and a retry is
 * pointless. The KMS-unavailable chaos drill (S1-D24) depends on telling them apart.
 */
export class KeyDestroyedError extends Error {
  constructor(
    message: string,
    readonly kekResource: KekResource,
    readonly keyId: KeyId,
  ) {
    super(message);
    this.name = "KeyDestroyedError";
  }
}

/** DEK length in bytes. AES-256 requires 32. */
export const DEK_LENGTH_BYTES = 32 as const;
