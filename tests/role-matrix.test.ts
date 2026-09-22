import { execFileSync } from "node:child_process";
import {
  CanonicalCapabilities,
  DUAL_CONTROL_CAPABILITIES,
  MFA_REQUIRED_CAPABILITIES,
  ROLE_MATRIX,
  ROLE_MATRIX_VERSION,
  capabilitiesForRole,
  isDualControl,
  requiresMfa,
} from "@sovereign/domain";
import { describe, expect, it } from "vitest";

const KNOWN = new Set<string>(Object.values(CanonicalCapabilities));

describe("role matrix compilation (S1-10)", () => {
  it("has not drifted from config/roles/matrix.yaml", () => {
    // The YAML is the source of truth. If someone edits the generated file directly,
    // or edits the YAML and forgets to recompile, this fails.
    expect(() => execFileSync("pnpm", ["run", "test:roles"], { stdio: "pipe" })).not.toThrow();
  });

  it("only references capabilities that exist", () => {
    // A typo in the YAML would otherwise compile into a capability nobody can ever be
    // granted, and would read as a policy decision rather than a mistake.
    for (const [role, entry] of Object.entries(ROLE_MATRIX)) {
      for (const capability of entry.capabilities) {
        expect(KNOWN.has(capability), `${role} -> ${capability}`).toBe(true);
      }
    }
    for (const capability of [...DUAL_CONTROL_CAPABILITIES, ...MFA_REQUIRED_CAPABILITIES]) {
      expect(KNOWN.has(capability), String(capability)).toBe(true);
    }
  });

  it("is versioned", () => {
    expect(ROLE_MATRIX_VERSION).toBeGreaterThanOrEqual(1);
  });
});

describe("role matrix policy (S1-10)", () => {
  it("returns nothing for an unknown role", () => {
    // Deny by default. An unrecognised role must never inherit a permissive fallback.
    expect(capabilitiesForRole("not-a-role")).toEqual([]);
    expect(capabilitiesForRole("")).toEqual([]);
  });

  it("returns nothing for a role disabled in Stage 1", () => {
    expect(ROLE_MATRIX.patient?.enabled).toBe(false);
    expect(capabilitiesForRole("patient")).toEqual([]);
  });

  it("lets only clinical signers sign transactions", () => {
    // Class C authority. AGENTS.md doctrine: the clinician decides.
    const signers = Object.entries(ROLE_MATRIX)
      .filter(([, e]) => e.capabilities.includes(CanonicalCapabilities.ORDER_SIGN_TRANSACTION))
      .map(([role]) => role)
      .sort();
    expect(signers).toEqual(["app", "clinician"]);
  });

  it("gives support_readonly no capabilities at all", () => {
    // Emergency PHI access is a time-boxed break-glass grant with dual approval
    // (spec §6.3), never a role default.
    expect(capabilitiesForRole("support_readonly")).toEqual([]);
  });

  it("gives the auditor nothing that changes state", () => {
    const mutating = [
      CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      CanonicalCapabilities.PRIOR_AUTH_AUTHORIZE_SUBMISSION,
      CanonicalCapabilities.AUTHORITY_GRANT_ISSUE_CLASS_C,
      CanonicalCapabilities.POLICY_CONFIGURE_CLASS_B,
      CanonicalCapabilities.ADMIN_TENANT_MANAGE,
    ];
    for (const capability of mutating) {
      expect(capabilitiesForRole("auditor")).not.toContain(capability);
    }
  });

  it("keeps clinical signing away from purely administrative roles", () => {
    for (const role of ["practice_manager", "org_admin", "security_admin", "auditor"]) {
      expect(capabilitiesForRole(role)).not.toContain(CanonicalCapabilities.ORDER_SIGN_TRANSACTION);
    }
  });

  it("marks authority issuance and policy configuration as dual control", () => {
    expect(isDualControl(CanonicalCapabilities.AUTHORITY_GRANT_ISSUE_CLASS_C)).toBe(true);
    expect(isDualControl(CanonicalCapabilities.AUTHORITY_GRANT_REVOKE)).toBe(true);
    expect(isDualControl(CanonicalCapabilities.POLICY_CONFIGURE_CLASS_B)).toBe(true);
    expect(isDualControl(CanonicalCapabilities.CLINICAL_STATE_READ)).toBe(false);
  });

  it("requires MFA for every privileged capability", () => {
    for (const capability of [
      CanonicalCapabilities.ADMIN_TENANT_MANAGE,
      CanonicalCapabilities.ADMIN_AUDIT_READ,
      CanonicalCapabilities.AUTHORITY_GRANT_ISSUE_CLASS_C,
      CanonicalCapabilities.ORDER_SIGN_TRANSACTION,
      CanonicalCapabilities.PRIOR_AUTH_AUTHORIZE_SUBMISSION,
    ]) {
      expect(requiresMfa(capability), String(capability)).toBe(true);
    }
  });

  it("requires MFA for everything under dual control", () => {
    // Dual control without MFA would let two unverified sessions approve each other.
    for (const capability of DUAL_CONTROL_CAPABILITIES) {
      expect(requiresMfa(capability), String(capability)).toBe(true);
    }
  });

  it("does not require MFA merely to read clinical state", () => {
    // MFA on every read would push clinicians toward shared sessions, which is worse.
    expect(requiresMfa(CanonicalCapabilities.CLINICAL_STATE_READ)).toBe(false);
  });

  it("covers every Stage 1 role named in the spec", () => {
    const expected = [
      "app",
      "auditor",
      "clinician",
      "infusion_coordinator",
      "nurse_ma",
      "org_admin",
      "pa_specialist",
      "patient",
      "practice_manager",
      "security_admin",
      "support_readonly",
    ];
    expect(Object.keys(ROLE_MATRIX).sort()).toEqual(expected);
  });
});
