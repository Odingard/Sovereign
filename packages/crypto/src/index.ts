/**
 * @sovereign/crypto — per-tenant envelope encryption and key management port.
 *
 * SCAFFOLD ONLY (WO-002A, ticket S1-01). No behavior. No key material. No cloud SDK.
 *
 * Tier rule (ADR-0011 §Decision 2): depends only on `@sovereign/contracts` and
 * `@sovereign/domain`. `KeyManagementPort` is DEFINED here; its Cloud KMS
 * implementation lives in an adapter, never in this package. Importing
 * `@google-cloud/kms` here inverts the port and fails `verify-architecture`.
 *
 * Planned surface (docs/STAGE1_FOUNDATION_SPEC.md §5.3) — delivered by ticket S1-07
 * under WO-002C, NOT by this work order:
 *   1. KeyManagementPort            — wrap/unwrap DEK; fake (file-backed) + Cloud KMS impls
 *   2. encryptField / decryptField  — AES-256-GCM, { v, kid, iv, ct, tag } in bytea
 *   3. DEK cache                    — in-process, 5 min TTL, cleared on tenant suspend
 *   4. Crypto-shred                 — destroy wrapped DEK version after legal-hold check
 *   5. Hashing helpers              — SHA-256 for the audit chain and artifact integrity
 *
 * Coverage gate when implemented: 100% (docs/STAGE1_FOUNDATION_SPEC.md:538).
 */

/** Marks this package as a registered ADR-0006 tier scaffold. Carries no behavior. */
export const CRYPTO_SCAFFOLD = {
  package: "@sovereign/crypto",
  introducedBy: "WO-002A/S1-01",
  implementedBy: "S1-07",
  status: "scaffold",
} as const;
