import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/**
 * Sovereign Dedicated Synthetic Data & PHI Verification Script
 *
 * DOCTRINE (AGENTS.md #10, #11):
 * No real PHI before WO-000 receives GO.
 * Development uses synthetic data only.
 * Gitleaks detects secrets; this script detects real patient data patterns,
 * verifies synthetic markers, and enforces fixture isolation.
 */

const PHI_PATTERNS = [
  {
    name: "Social Security Number",
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/,
  },
  {
    name: "US Phone Number in Data Context",
    regex: /\b(?:\+?1[-. ]?)?\(?([2-9][0-8][0-9])\)?[-. ]?([2-9][0-9]{2})[-. ]?([0-9]{4})\b/,
  },
  {
    name: "Standard Medical Record Number (non-synthetic format)",
    regex: /\bMRN[#:\s]*[0-9]{7,10}\b/i,
  },
];

const IGNORE_DIRS = new Set([".git", "node_modules", "dist", ".agents", ".next"]);
const IGNORE_FILES = new Set(["verify-synthetic-data.ts", ".gitleaks.toml"]);

function walk(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  for (const file of files) {
    if (IGNORE_DIRS.has(file)) continue;
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyRepository(): { passed: boolean; violations: string[] } {
  console.log("=== Sovereign Synthetic Data & PHI Verification ===");
  const allFiles = walk(process.cwd());
  const violations: string[] = [];

  for (const file of allFiles) {
    const relativePath = file.replace(`${process.cwd()}/`, "");
    const filename = file.split("/").pop() || "";
    if (IGNORE_FILES.has(filename)) continue;

    const ext = extname(file);
    // Scan text, markdown, json, yaml, ts, js files
    if (![".md", ".txt", ".json", ".yaml", ".yml", ".ts", ".js", ".mjs"].includes(ext)) {
      continue;
    }

    const content = readFileSync(file, "utf-8");

    // Rule 1: Check for PHI regex patterns
    for (const pattern of PHI_PATTERNS) {
      if (pattern.regex.test(content)) {
        // Exclude self and governance doc references
        if (
          relativePath.includes("WO-000-cloud-security-phi-gate.md") ||
          relativePath.includes("DATA_CLASSIFICATION_SCHEDULE.md")
        ) {
          continue;
        }
        violations.push(`[PHI PATTERN DETECTED] ${relativePath}: Matches ${pattern.name}`);
      }
    }

    // Rule 2: Test fixtures must only reside in approved locations
    if (
      (filename.includes("fixture") || filename.includes("patient-data")) &&
      !relativePath.startsWith("test-data/synthetic-only")
    ) {
      violations.push(
        `[ILLEGAL FIXTURE LOCATION] ${relativePath}: Test fixtures must reside in test-data/synthetic-only/`,
      );
    }

    // Rule 3: JSON fixtures in test-data must declare synthetic: true
    if (relativePath.startsWith("test-data/synthetic-only") && ext === ".json") {
      try {
        const parsed = JSON.parse(content);
        if (parsed.synthetic !== true) {
          violations.push(
            `[MISSING SYNTHETIC MARKER] ${relativePath}: Must contain '"synthetic": true'`,
          );
        }
      } catch (e) {
        violations.push(`[INVALID JSON FIXTURE] ${relativePath}: Could not parse JSON`);
      }
    }
  }

  if (violations.length === 0) {
    console.log("✔ All repository files passed synthetic verification.");
    console.log("✔ Zero real PHI patterns detected.");
    console.log("✔ Gate Posture Preserved: HOLD — NO REAL PHI.");
    return { passed: true, violations: [] };
  }
  console.error("✖ Prohibited data violations found:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  return { passed: false, violations };
}

const result = verifyRepository();
if (!result.passed) {
  process.exit(1);
}
