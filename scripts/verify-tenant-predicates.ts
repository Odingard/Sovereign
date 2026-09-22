/**
 * Sovereign Tenant Predicate Verification (G-50)
 *
 * ADR-0009 requires row-level security as DEFENCE IN DEPTH, never as the sole
 * control: repositories keep explicit `WHERE tenant_id = ?` predicates, and RLS is
 * the layer underneath that makes forgetting one non-fatal rather than catastrophic.
 *
 * Until now that second layer was convention. A repository dropping its predicate
 * halves the defence and nothing detected it — recorded as G-50 in the threat model's
 * "what would change this assessment" for TB-09, the one boundary where convention is
 * not enough.
 *
 * WHAT THIS CHECKS
 *
 * Every Kysely query against a tenant-scoped table must carry a tenant predicate in
 * its chain. `insertInto` is exempt: a tenant id arrives in the inserted values, and
 * RLS `WITH CHECK` refuses a row whose tenant does not match the session.
 *
 * Raw `sql` templates are checked too, since G-55. They used to be exempt on the
 * grounds that they are opaque to this analysis — which was true, and which mattered
 * more than it looked: `jobs/` and the audit read path are written entirely in raw
 * `sql`, so the code holding the WIDEST authority in the system sat in the one place
 * the checker did not look. A blind spot that the important code happens to live in
 * is not a limitation, it is a hole.
 *
 * WHAT THIS DOES NOT CATCH, stated so nobody mistakes it for more than it is:
 *   - a predicate built dynamically rather than written literally
 *   - a predicate that is present but compares against the wrong value
 *   - a table name interpolated into a raw `sql` template rather than written out
 *
 * It catches the realistic regression: someone writes a new repository method, or
 * edits an existing one, and omits the predicate. That is the failure mode worth
 * automating, and the remaining gaps are covered by RLS and the adversarial suite.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/**
 * Tables that carry tenant data. Derived from the migrations, minus the exempt
 * register — a table exempt from RLS is one where a tenant predicate is also not the
 * control, and requiring one would be noise.
 */
const EXEMPT: string[] = JSON.parse(
  readFileSync(join(ROOT, "config/rls-exempt.json"), "utf-8"),
).exempt.map((entry: { table: string }) => entry.table);

const TENANT_TABLES = [
  "clinical_evidence",
  "clinical_states",
  "clinical_intents",
  "execution_graphs",
  "therapy_access_cases",
  "domain_outbox_events",
  "actors",
  "organization_units",
  "actor_org_unit_assignments",
  "authority_grants",
  "authorization_audit_log",
  "actor_identity_mappings",
  "patient_identity_mappings",
  "tenant_key",
  "site",
  "approval",
  "scim_connection",
  "scim_group_role",
  "clinical_audit_event",
  "chain_anchor",
  "source_system",
  "patient",
  "patient_identifier",
  "source_artifact",
  "clinical_fact",
  "reconciliation_item",
  "legal_hold",
  "erasure_request",
  "siem_export",
  "siem_dead_letter",
  "billable_unit",
  "late_billable_unit",
].filter((table) => !EXEMPT.includes(table));

/** Query builders that read or mutate existing rows, and therefore need a predicate. */
const READING_BUILDERS = ["selectFrom", "updateTable", "deleteFrom"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly table: string;
  readonly builder: string;
}

/**
 * Extract the query chain starting at a builder call.
 *
 * A chain runs until the statement that terminates it — `.execute`,
 * `.executeTakeFirst`, `.executeTakeFirstOrThrow` — or a blank line. Reading to the
 * terminator rather than a fixed window means a long chain with the predicate at the
 * end is still seen.
 */
function chainFrom(lines: string[], start: number): string {
  const collected: string[] = [];
  for (let i = start; i < lines.length && i < start + 40; i++) {
    const line = lines[i] as string;
    collected.push(line);
    if (/\.execute(TakeFirst(OrThrow)?)?\(/.test(line)) break;
    if (line.trim() === "" && collected.length > 1) break;
  }
  return collected.join("\n");
}

function hasTenantPredicate(chain: string): boolean {
  return (
    /\.where\(\s*["'`]tenant_id["'`]/.test(chain) ||
    // A tenant-scoped helper is an acceptable form of the same predicate.
    /withTenantTransaction|setTenantSession/.test(chain)
  );
}

/**
 * Whether a query is a declared cross-tenant system job.
 *
 * Spec §5.2 permits migrations and explicitly tagged @systemScope jobs to query
 * outside `withTenant`. The tag must appear in the doc comment immediately above the
 * method — searching the whole file would let one tagged method excuse every other
 * query in it.
 *
 * Requiring the tag is the point. A cross-tenant query is sometimes correct; an
 * UNDECLARED one never is, and spec §13 S1-25 requires a walkthrough of every
 * @systemScope job at Gate 1. Grepping for the tag is how that walkthrough finds them.
 */
function isDeclaredSystemScope(lines: string[], queryLine: number): boolean {
  for (let i = queryLine; i >= 0 && i > queryLine - 30; i--) {
    const line = lines[i] as string;
    if (line.includes("@systemScope")) return true;
    // A closing brace above means we have left this method's doc comment.
    if (/^\s*}\s*$/.test(line) && i < queryLine - 1) return false;
  }
  return false;
}

/**
 * Tables a raw `sql` template reads or mutates.
 *
 * Matches `FROM x`, `UPDATE x` and `DELETE FROM x`. `INSERT INTO` is excluded for the
 * same reason `insertInto` is: the tenant id arrives in the values and RLS `WITH CHECK`
 * refuses a row whose tenant does not match the session.
 *
 * A table name that is interpolated rather than written out is not matched, and cannot
 * be — see the header. That is a narrower gap than the one this closes.
 */
function tablesInRawSql(template: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\bFROM\s+([a-z_][a-z0-9_]*)/gi,
    /\bUPDATE\s+([a-z_][a-z0-9_]*)/gi,
    /\bDELETE\s+FROM\s+([a-z_][a-z0-9_]*)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of template.matchAll(pattern)) {
      const table = (match[1] as string).toLowerCase();
      if (TENANT_TABLES.includes(table)) found.add(table);
    }
  }
  return [...found];
}

/**
 * Collect a raw `sql` template literal starting at a line that opens one.
 *
 * Reads to the closing backtick rather than a fixed window, so a long multi-line query
 * with its predicate at the bottom is still seen whole.
 */
function rawSqlTemplateFrom(lines: string[], start: number): { text: string; end: number } | null {
  const first = lines[start] as string;
  const open = first.indexOf("`", first.indexOf("sql"));
  if (open === -1) return null;
  if (first.indexOf("`", open + 1) !== -1) {
    return { text: first.slice(open + 1, first.indexOf("`", open + 1)), end: start };
  }
  const collected = [first.slice(open + 1)];
  for (let i = start + 1; i < lines.length && i < start + 60; i++) {
    const line = lines[i] as string;
    const close = line.indexOf("`");
    if (close !== -1) {
      collected.push(line.slice(0, close));
      return { text: collected.join("\n"), end: i };
    }
    collected.push(line);
  }
  return null;
}

/**
 * Whether a raw template carries a tenant predicate.
 *
 * Requires `tenant_id` on the left of a comparison, so a query that merely SELECTS the
 * column does not count as one that filters on it. That distinction is the whole
 * check: `SELECT tenant_id FROM patient` reads every tenant's rows.
 */
function rawSqlHasTenantPredicate(template: string): boolean {
  return /\btenant_id\s*(=|IN\b|=\s*ANY)/i.test(template);
}

const systemScoped: Violation[] = [];

function verify(): Violation[] {
  const violations: Violation[] = [];
  const files = [
    ...walk(join(ROOT, "packages/persistence/src")),
    ...walk(join(ROOT, "services")),
    ...walk(join(ROOT, "adapters")),
    // jobs/ was outside the scanned roots as well as outside the checked syntax.
    // Two independent reasons the widest-authority code was never looked at (G-55).
    ...walk(join(ROOT, "jobs")),
  ];

  for (const file of files) {
    const lines = readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] as string;
      for (const builder of READING_BUILDERS) {
        const match = line.match(new RegExp(`\\.${builder}\\(\\s*["'\`]([a-z_]+)["'\`]`));
        if (match === null) continue;
        const table = match[1] as string;
        if (!TENANT_TABLES.includes(table)) continue;
        if (hasTenantPredicate(chainFrom(lines, i))) continue;
        if (isDeclaredSystemScope(lines, i)) {
          systemScoped.push({ file: file.replace(`${ROOT}/`, ""), line: i + 1, table, builder });
          continue;
        }
        violations.push({ file: file.replace(`${ROOT}/`, ""), line: i + 1, table, builder });
      }

      // Raw `sql` templates, checked with the same rule (G-55).
      if (!/\bsql\s*(<[^>]*>)?\s*`/.test(line)) continue;
      const template = rawSqlTemplateFrom(lines, i);
      if (template === null) continue;
      if (rawSqlHasTenantPredicate(template.text)) continue;
      for (const table of tablesInRawSql(template.text)) {
        const record = { file: file.replace(`${ROOT}/`, ""), line: i + 1, table, builder: "sql``" };
        if (isDeclaredSystemScope(lines, i)) {
          systemScoped.push(record);
        } else {
          violations.push(record);
        }
      }
    }
  }
  return violations;
}

console.log("=== Sovereign Tenant Predicate Verification (ADR-0009, G-50) ===");
const violations = verify();

if (violations.length === 0) {
  console.log(
    `✔ Every query against ${TENANT_TABLES.length} tenant tables carries a tenant predicate.`,
  );
  console.log("✔ RLS remains defence in depth, not the sole control.");
  if (systemScoped.length > 0) {
    // Printed, not hidden. Spec §13 S1-25 requires a walkthrough of every
    // @systemScope job at Gate 1, and this list is that walkthrough.
    console.log(`\nDeclared @systemScope cross-tenant queries (${systemScoped.length}):`);
    for (const s of systemScoped) {
      console.log(
        `  - ${s.file}:${s.line}: ${s.builder === "sql``" ? "raw sql" : `.${s.builder}`} on "${s.table}"`,
      );
    }
  }
  process.exit(0);
}

console.error("✖ Queries on tenant tables without an explicit tenant predicate:");
for (const v of violations) {
  console.error(
    `  - ${v.file}:${v.line}: ${v.builder === "sql``" ? "raw sql on " : `.${v.builder}(`}"${v.table}" has no tenant predicate`,
  );
}
console.error("");
console.error("ADR-0009: RLS is defence in depth, never the sole control.");
console.error('Add .where("tenant_id", ...), or declare the query @systemScope with a reason.');
process.exit(1);
