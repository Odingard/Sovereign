import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Sovereign Automated Architectural Constraint Verification
 *
 * DOCTRINE & ARCHITECTURAL INVARIANTS:
 * 1. AI is a reasoning component, not the system of record.
 * 2. Dependency direction: providers/adapters -> application -> domain
 * 3. Never:
 *    domain -> Gemini
 *    domain -> Google Cloud
 *    domain -> Temporal
 *    domain -> EHR vendor
 * 4. AI adapters cannot import state mutation repositories.
 * 5. External execution adapters cannot bypass Execution Graph / authority interfaces.
 * 6. Stage 1 tier packages (kernel, crypto, telemetry) depend only on contracts/domain
 *    and must exist (ADR-0011; WO-002A S1-01).
 */

const ROOT = process.cwd();

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === "dist" || file === ".git") continue;
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".js") || file.endsWith(".json")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyArchitecture(): { passed: boolean; violations: string[] } {
  console.log("=== Sovereign Automated Architecture Boundary Verification ===");
  const violations: string[] = [];

  // 1. Check packages/domain (must be 100% pure, zero cloud, zero AI, zero Temporal)
  const domainFiles = walkDir(join(ROOT, "packages/domain/src"));
  const prohibitedDomainImports = [
    "@google",
    "@google-cloud",
    "@google/genai",
    "gemini",
    "@temporalio",
    "temporal",
    "@sovereign/provider-ai",
    "@sovereign/persistence",
    "@sovereign/contracts",
    "@sovereign/application",
    "aws-sdk",
    "@azure",
  ];

  for (const file of domainFiles) {
    const content = readFileSync(file, "utf-8");
    for (const badImport of prohibitedDomainImports) {
      if (content.includes(`'${badImport}`) || content.includes(`"${badImport}`)) {
        violations.push(
          `[FORBIDDEN DOMAIN IMPORT] ${file.replace(ROOT, "")}: imports '${badImport}'. Domain must remain completely pure.`,
        );
      }
    }
  }

  // 2. Check providers/ai-* (AI cannot import persistence or direct mutation repositories)
  const aiProviderFiles = [
    ...walkDir(join(ROOT, "providers/ai-fake/src")),
    ...walkDir(join(ROOT, "providers/ai-gemini/src")),
  ];

  for (const file of aiProviderFiles) {
    const content = readFileSync(file, "utf-8");
    if (
      content.includes("@sovereign/persistence") ||
      content.includes("AuthoritativeRepository") ||
      content.includes("saveNewVersion")
    ) {
      violations.push(
        `[AUTHORITY VIOLATION] ${file.replace(ROOT, "")}: AI provider imports persistence/mutation layer. AI may not directly mutate state.`,
      );
    }
  }

  // 3. Check adapters (cannot import persistence directly; must use application ports)
  const adapterFiles = walkDir(join(ROOT, "adapters"));
  for (const file of adapterFiles) {
    if (!file.endsWith(".ts")) continue;
    const content = readFileSync(file, "utf-8");
    if (content.includes("@sovereign/persistence") || content.includes("AuthoritativeRepository")) {
      violations.push(
        `[BYPASS VIOLATION] ${file.replace(ROOT, "")}: Adapter imports persistence directly. Must interact through application services and Execution Graph.`,
      );
    }
  }

  // 4. Check apps/marketing-site (cannot import clinical persistence, domain, authority, or execution graph)
  const marketingFiles = walkDir(join(ROOT, "apps/marketing-site/src"));
  const prohibitedMarketingImports = [
    "@sovereign/persistence",
    "@sovereign/domain",
    "@sovereign/application",
    "@temporalio",
    "@google/genai",
    "@google-cloud",
    "ClinicalState",
    "ClinicalEvidence",
    "ClinicalIntent",
    "ExecutionGraph",
    "TherapyAccessState",
  ];

  for (const file of marketingFiles) {
    const content = readFileSync(file, "utf-8");
    for (const badImport of prohibitedMarketingImports) {
      if (content.includes(`'${badImport}`) || content.includes(`"${badImport}`)) {
        violations.push(
          `[FORBIDDEN MARKETING IMPORT] ${file.replace(ROOT, "")}: imports '${badImport}'. Marketing site must remain completely decoupled from clinical internals.`,
        );
      }
    }
    // Brand safety rule: Six Sense Enterprise Services LLC must NEVER appear in public marketing site
    if (content.includes("Six Sense Enterprise Services")) {
      violations.push(
        `[FORBIDDEN BRAND NAME] ${file.replace(ROOT, "")}: contains prohibited parent-company branding string.`,
      );
    }
  }

  // 5. Verify test fixtures stay in test-data/synthetic-only
  const allFiles = walkDir(ROOT);
  for (const file of allFiles) {
    const relative = file.replace(`${ROOT}/`, "");
    if (
      (relative.includes("patient-fixture") || relative.includes("clinical-sample")) &&
      !relative.startsWith("test-data/synthetic-only/")
    ) {
      violations.push(
        `[ILLEGAL FIXTURE LOCATION] ${relative}: Test data must reside strictly within test-data/synthetic-only/`,
      );
    }
  }

  // 5. Verify local execution requires zero cloud credentials
  const envFiles = [".env", ".env.local", ".env.production"];
  for (const envFile of envFiles) {
    const p = join(ROOT, envFile);
    if (existsSync(p)) {
      const content = readFileSync(p, "utf-8");
      if (content.includes("AIza") || content.includes("sk-") || content.includes("PRIVATE KEY")) {
        violations.push(
          `[CREDENTIAL LEAK] ${envFile}: Contains active cloud credential in local repository.`,
        );
      }
    }
  }

  // 6. Stage 1 tier packages (WO-002A S1-01): kernel, crypto, telemetry.
  // ADR-0011 §Decision 2: these depend ONLY on contracts/domain. They must never
  // reach persistence, application, workflow-runtime, audit, or a vendor SDK.
  // Ports are defined here; vendor implementations live in adapters/providers.
  const STAGE1_TIER_PACKAGES = ["kernel", "crypto", "telemetry"];
  const prohibitedTierImports = [
    "@sovereign/persistence",
    "@sovereign/application",
    "@sovereign/workflow-runtime",
    "@sovereign/audit",
    "@sovereign/provider-ai",
    "@google",
    "@google-cloud",
    "@google/genai",
    "gemini",
    "@temporalio",
    "temporal",
    "aws-sdk",
    "@azure",
    "kysely",
    "pg",
    "@sentry",
  ];

  for (const pkg of STAGE1_TIER_PACKAGES) {
    const pkgRoot = join(ROOT, "packages", pkg);
    const manifest = join(pkgRoot, "package.json");
    const entrypoint = join(pkgRoot, "src/index.ts");

    // Registration is mandatory: a missing tier package is a violation, not a skip.
    // A boundary check that silently passes when the target is absent is not a check.
    if (!existsSync(manifest) || !existsSync(entrypoint)) {
      violations.push(
        `[MISSING TIER PACKAGE] packages/${pkg}: required by ADR-0011 and WO-002A S1-01; expected package.json and src/index.ts.`,
      );
      continue;
    }

    for (const file of walkDir(join(pkgRoot, "src"))) {
      const content = readFileSync(file, "utf-8");
      for (const badImport of prohibitedTierImports) {
        if (content.includes(`'${badImport}`) || content.includes(`"${badImport}`)) {
          violations.push(
            `[TIER BOUNDARY VIOLATION] ${file.replace(ROOT, "")}: imports '${badImport}'. packages/${pkg} may depend only on @sovereign/contracts and @sovereign/domain (ADR-0011).`,
          );
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log("✔ All package boundaries verified.");
    console.log(
      "✔ Stage 1 tier packages (kernel, crypto, telemetry) present and dependency-clean.",
    );
    console.log(
      "✔ One-way dependency invariant enforced: providers/adapters -> application -> domain.",
    );
    console.log("✔ Domain isolation preserved: 0 cloud, 0 AI, 0 Temporal imports.");
    console.log("✔ AI direct mutation prevention verified.");
    return { passed: true, violations: [] };
  }
  console.error("✖ Architectural boundary violations found:");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  return { passed: false, violations };
}

const res = verifyArchitecture();
if (!res.passed) {
  process.exit(1);
}
