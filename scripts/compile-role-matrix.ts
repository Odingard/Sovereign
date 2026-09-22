/**
 * Compile config/roles/matrix.yaml into a typed module the domain can consume.
 *
 * WO-002B S1-10. The YAML is the source of truth; this produces
 * packages/domain/src/authority/role-matrix.generated.ts.
 *
 * The domain stays dependency-free — it never reads a file or parses YAML. This
 * script runs at build time and in CI, and `tests/role-matrix.test.ts` fails if the
 * committed output drifts from the YAML.
 *
 * Unknown capability names are a hard error. A typo would otherwise compile into a
 * capability nobody can ever be granted, and it would look like a policy decision
 * rather than a mistake.
 *
 * Usage:  pnpm run compile:roles          write the generated module
 *         pnpm run compile:roles --check  fail if the committed output is stale
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { CanonicalCapabilities } from "../packages/domain/src/authority/capabilities.js";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "config/roles/matrix.yaml");
const OUTPUT = join(ROOT, "packages/domain/src/authority/role-matrix.generated.ts");

interface RoleEntry {
  description?: string;
  enabled?: boolean;
  capabilities?: string[];
}

interface Matrix {
  version: number;
  dual_control?: string[];
  requires_mfa?: string[];
  roles: Record<string, RoleEntry>;
}

function compile(): string {
  const matrix = parse(readFileSync(SOURCE, "utf8")) as Matrix;
  const known = new Set<string>(Object.values(CanonicalCapabilities));
  const problems: string[] = [];

  const check = (name: string, where: string) => {
    if (!known.has(name)) {
      problems.push(`${where}: unknown capability '${name}'`);
    }
  };

  for (const name of matrix.dual_control ?? []) check(name, "dual_control");
  for (const name of matrix.requires_mfa ?? []) check(name, "requires_mfa");
  for (const [role, entry] of Object.entries(matrix.roles)) {
    for (const name of entry.capabilities ?? []) check(name, `roles.${role}`);
  }
  if (problems.length > 0) {
    throw new Error(`config/roles/matrix.yaml is invalid:\n  - ${problems.join("\n  - ")}`);
  }

  const roles = Object.entries(matrix.roles)
    .map(([role, entry]) => {
      const caps = (entry.capabilities ?? []).map((c) => `      "${c}",`).join("\n");
      return [
        `  ${JSON.stringify(role)}: {`,
        `    enabled: ${entry.enabled !== false},`,
        "    capabilities: [",
        caps,
        "    ],",
        "  },",
      ]
        .filter((line) => line.trim().length > 0)
        .join("\n");
    })
    .join("\n");

  const list = (values: string[]) => values.map((v) => `  "${v}",`).join("\n");

  return `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Produced from config/roles/matrix.yaml by scripts/compile-role-matrix.ts.
 * Run \`pnpm run compile:roles\` after changing the YAML.
 *
 * A role is not an authority grant (AGENTS.md doctrine 17, ADR-0010). These are
 * capability DEFAULTS that make a capability eligible to be granted; authority comes
 * from an AuthorityGrant evaluated at the time of the action.
 */

import type { CapabilityIdentifier } from "../common/identifiers.js";

export const ROLE_MATRIX_VERSION = ${matrix.version};

export interface CompiledRole {
  readonly enabled: boolean;
  readonly capabilities: ReadonlyArray<CapabilityIdentifier>;
}

// Capability strings are validated against CanonicalCapabilities at compile time by
// scripts/compile-role-matrix.ts, so the brand is asserted once here rather than
// repeated on every entry.
const RAW_ROLE_MATRIX = {
${roles}
} as const;

export const ROLE_MATRIX: Readonly<Record<string, CompiledRole>> =
  RAW_ROLE_MATRIX as unknown as Readonly<Record<string, CompiledRole>>;

/** Capabilities requiring a second distinct human approver (spec §6.2). */
export const DUAL_CONTROL_CAPABILITIES: ReadonlyArray<CapabilityIdentifier> = [
${list(matrix.dual_control ?? [])}
] as unknown as ReadonlyArray<CapabilityIdentifier>;

/** Capabilities requiring an MFA claim in the request context (spec §6.2). */
export const MFA_REQUIRED_CAPABILITIES: ReadonlyArray<CapabilityIdentifier> = [
${list(matrix.requires_mfa ?? [])}
] as unknown as ReadonlyArray<CapabilityIdentifier>;

export function capabilitiesForRole(role: string): ReadonlyArray<CapabilityIdentifier> {
  const entry = ROLE_MATRIX[role];
  // Unknown or disabled role yields nothing. Deny by default: an unrecognised role
  // must never inherit a permissive fallback.
  return entry === undefined || !entry.enabled ? [] : entry.capabilities;
}

export function isDualControl(capability: string): boolean {
  return (DUAL_CONTROL_CAPABILITIES as ReadonlyArray<string>).includes(capability);
}

export function requiresMfa(capability: string): boolean {
  return (MFA_REQUIRED_CAPABILITIES as ReadonlyArray<string>).includes(capability);
}
`;
}

/**
 * Run the emitted source through Biome so the committed file satisfies the lint gate
 * and so `--check` compares formatted output to formatted output. Without this the
 * generator and the formatter disagree forever.
 */
function formatted(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "sovereign-roles-"));
  const scratch = join(dir, "role-matrix.generated.ts");
  try {
    writeFileSync(scratch, source);
    execFileSync("pnpm", ["exec", "biome", "format", "--write", scratch], { stdio: "pipe" });
    return readFileSync(scratch, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const generated = formatted(compile());

if (process.argv.includes("--check")) {
  const current = (() => {
    try {
      return readFileSync(OUTPUT, "utf8");
    } catch {
      return "";
    }
  })();
  if (current !== generated) {
    console.error(
      "\u2716 role-matrix.generated.ts is stale. Run `pnpm run compile:roles` and commit the result.",
    );
    process.exit(1);
  }
  console.log("\u2714 Role matrix is in sync with config/roles/matrix.yaml");
} else {
  writeFileSync(OUTPUT, generated);
  console.log(`\u2714 Wrote ${OUTPUT.replace(ROOT, "")}`);
}
