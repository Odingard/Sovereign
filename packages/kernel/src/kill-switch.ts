/**
 * @file Kill-switch hook (WO-002C S1-06)
 * @description Checked before every AI capability and external-action path.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.9, §7.1.
 *
 * "Disabled → truthful degraded response, manual path surfaced." Truthful is the
 * operative word. A disabled capability must not return an empty result that reads
 * like "nothing found" — that is a false negative in a clinical context, and
 * AGENTS.md doctrine 7 is explicit that unknown is not negative.
 *
 * Fails closed. If the registry cannot be read, the capability is treated as
 * disabled: AGENTS.md requires failing closed on policy ambiguity, and a registry
 * outage is exactly that.
 */

import { capabilityDisabled } from "./errors.js";
import type { KillSwitchRegistry } from "./ports.js";

export interface DegradedResponse {
  readonly available: false;
  readonly capability: string;
  /** What a human should do instead. Never empty. */
  readonly manualPath: string;
}

/** Throw if the capability is disabled or the registry is unreadable. */
export async function requireCapabilityEnabled(
  registry: KillSwitchRegistry,
  capability: string,
  tenantId: string | null,
): Promise<void> {
  let enabled: boolean;
  try {
    enabled = await registry.isEnabled(capability, tenantId);
  } catch {
    throw capabilityDisabled(`Kill-switch registry unreadable for ${capability}; failing closed`);
  }
  if (!enabled) {
    throw capabilityDisabled(`Capability ${capability} is disabled by kill switch`);
  }
}

/**
 * Build the degraded response for a disabled capability.
 *
 * `manualPath` is required rather than optional: a degraded response that does not
 * tell the clinician what to do instead is not truthful, it is just a dead end.
 */
export function degradedResponse(capability: string, manualPath: string): DegradedResponse {
  if (manualPath.trim().length === 0) {
    throw new Error("A degraded response must state the manual path");
  }
  return { available: false, capability, manualPath };
}
