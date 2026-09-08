/**
 * @file Generic Server-Resolved Authorization Binding
 * @description Decouples clinical authority binding from raw unstable JSON serialization.
 * Invariant: Authorization bindings must be resolved from trusted Sovereign state.
 * Caller-supplied bindings or content digests are untrusted and must never satisfy a grant.
 */

import { InvariantViolationError } from "../common/domain-error.js";

export type AuthorizationBindingType =
  | "SEMANTIC_ACTION"
  | "INTENT_ORDER"
  | "EXECUTION_NODE"
  | "CONTENT_DIGEST";

export interface AuthorizationBinding {
  readonly bindingType: AuthorizationBindingType;
  readonly resourceIdentifier: string;
  readonly versionOrTimestamp?: string;
  readonly contentDigest?: {
    readonly algorithm: "SHA-256";
    readonly value: string;
  };
}

/**
 * Validates that an authoritative server-resolved binding satisfies the grant's required binding.
 */
export function assertAuthorizationBindingsMatch(
  serverBinding: AuthorizationBinding,
  grantBinding: AuthorizationBinding,
): void {
  if (serverBinding.bindingType !== grantBinding.bindingType) {
    throw new InvariantViolationError(
      `Binding type mismatch: server resolved '${serverBinding.bindingType}', but grant requires '${grantBinding.bindingType}'.`,
    );
  }

  if (serverBinding.resourceIdentifier !== grantBinding.resourceIdentifier) {
    throw new InvariantViolationError(
      `Binding resource mismatch: server resolved '${serverBinding.resourceIdentifier}', but grant requires '${grantBinding.resourceIdentifier}'.`,
    );
  }

  if (
    grantBinding.versionOrTimestamp &&
    serverBinding.versionOrTimestamp !== grantBinding.versionOrTimestamp
  ) {
    throw new InvariantViolationError(
      `Binding version mismatch: server resolved '${serverBinding.versionOrTimestamp}', but grant requires '${grantBinding.versionOrTimestamp}'.`,
    );
  }

  if (grantBinding.contentDigest) {
    if (!serverBinding.contentDigest) {
      throw new InvariantViolationError(
        "Grant requires content digest binding, but server-resolved binding contains no digest.",
      );
    }
    if (serverBinding.contentDigest.value !== grantBinding.contentDigest.value) {
      throw new InvariantViolationError(
        `Binding digest mismatch: server resolved '${serverBinding.contentDigest.value}', but grant requires '${grantBinding.contentDigest.value}'.`,
      );
    }
  }
}
