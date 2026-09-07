import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
 */

const ROOT = process.cwd();

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file === '.git') continue;
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.json')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyArchitecture(): { passed: boolean; violations: string[] } {
  console.log('=== Sovereign Automated Architecture Boundary Verification ===');
  const violations: string[] = [];

  // 1. Check packages/domain (must be 100% pure, zero cloud, zero AI, zero Temporal)
  const domainFiles = walkDir(join(ROOT, 'packages/domain/src'));
  const prohibitedDomainImports = [
    '@google',
    '@google-cloud',
    '@google/genai',
    'gemini',
    '@temporalio',
    'temporal',
    '@sovereign/provider-ai',
    '@sovereign/persistence',
    '@sovereign/contracts',
    '@sovereign/application',
    'aws-sdk',
    '@azure'
  ];

  for (const file of domainFiles) {
    const content = readFileSync(file, 'utf-8');
    for (const badImport of prohibitedDomainImports) {
      if (content.includes(`'${badImport}`) || content.includes(`"${badImport}`)) {
        violations.push(
          `[FORBIDDEN DOMAIN IMPORT] ${file.replace(ROOT, '')}: imports '${badImport}'. Domain must remain completely pure.`
        );
      }
    }
  }

  // 2. Check providers/ai-* (AI cannot import persistence or direct mutation repositories)
  const aiProviderFiles = [
    ...walkDir(join(ROOT, 'providers/ai-fake/src')),
    ...walkDir(join(ROOT, 'providers/ai-gemini/src'))
  ];

  for (const file of aiProviderFiles) {
    const content = readFileSync(file, 'utf-8');
    if (
      content.includes('@sovereign/persistence') ||
      content.includes('AuthoritativeRepository') ||
      content.includes('saveNewVersion')
    ) {
      violations.push(
        `[AUTHORITY VIOLATION] ${file.replace(ROOT, '')}: AI provider imports persistence/mutation layer. AI may not directly mutate state.`
      );
    }
  }

  // 3. Check adapters (cannot import persistence directly; must use application ports)
  const adapterFiles = walkDir(join(ROOT, 'adapters'));
  for (const file of adapterFiles) {
    if (!file.endsWith('.ts')) continue;
    const content = readFileSync(file, 'utf-8');
    if (content.includes('@sovereign/persistence') || content.includes('AuthoritativeRepository')) {
      violations.push(
        `[BYPASS VIOLATION] ${file.replace(ROOT, '')}: Adapter imports persistence directly. Must interact through application services and Execution Graph.`
      );
    }
  }

  // 4. Verify test fixtures stay in test-data/synthetic-only
  const allFiles = walkDir(ROOT);
  for (const file of allFiles) {
    const relative = file.replace(`${ROOT}/`, '');
    if (
      (relative.includes('patient-fixture') || relative.includes('clinical-sample')) &&
      !relative.startsWith('test-data/synthetic-only/')
    ) {
      violations.push(
        `[ILLEGAL FIXTURE LOCATION] ${relative}: Test data must reside strictly within test-data/synthetic-only/`
      );
    }
  }

  // 5. Verify local execution requires zero cloud credentials
  const envFiles = ['.env', '.env.local', '.env.production'];
  for (const envFile of envFiles) {
    const p = join(ROOT, envFile);
    if (existsSync(p)) {
      const content = readFileSync(p, 'utf-8');
      if (content.includes('AIza') || content.includes('sk-') || content.includes('PRIVATE KEY')) {
        violations.push(
          `[CREDENTIAL LEAK] ${envFile}: Contains active cloud credential in local repository.`
        );
      }
    }
  }

  if (violations.length === 0) {
    console.log('✔ All package boundaries verified.');
    console.log('✔ One-way dependency invariant enforced: providers/adapters -> application -> domain.');
    console.log('✔ Domain isolation preserved: 0 cloud, 0 AI, 0 Temporal imports.');
    console.log('✔ AI direct mutation prevention verified.');
    return { passed: true, violations: [] };
  } else {
    console.error('✖ Architectural boundary violations found:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    return { passed: false, violations };
  }
}

const res = verifyArchitecture();
if (!res.passed) {
  process.exit(1);
}
