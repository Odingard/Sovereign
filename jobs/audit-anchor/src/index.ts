/**
 * @file Audit anchor job (WO-002C S1-15)
 * @description Nightly per-tenant chain anchor to retention-locked storage.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.3, S1-D11.
 *
 * The hash chain proves nobody altered an event without altering every hash after it.
 * It does NOT protect against someone with full database access rebuilding the whole
 * chain so that it verifies internally. The anchor is what closes that: a daily
 * `{tenant_id, last_seq, last_hash}` written to a bucket with a locked retention
 * policy, which the same person cannot modify.
 *
 * That is the entire value of this job, and it is why the write target matters more
 * than the write.
 */

import { type VerificationResult, verifyChain, writeAnchor } from "@sovereign/service-audit";
import type { Kysely } from "kysely";
import { sql } from "kysely";

// biome-ignore lint/suspicious/noExplicitAny: works against any Kysely schema
type Db = Kysely<any>;

export interface AnchorStorage {
  /**
   * Writes the anchor to retention-locked object storage and returns its reference.
   *
   * The implementation MUST target a bucket whose retention policy is locked
   * (Conftest rule NEW-12 proves it in the plan). An anchor an operator can delete
   * or overwrite protects nothing — it would confirm whatever the database currently
   * says, which is precisely the thing under suspicion.
   */
  put(tenantId: string, anchorDate: string, body: string): Promise<string>;
}

export interface AnchorJobResult {
  readonly anchorDate: string;
  readonly tenantsAnchored: number;
  /** Tenants whose chain did not verify. Anchoring is REFUSED for these. */
  readonly tenantsFailingVerification: readonly string[];
  readonly tenantsWithNoEvents: readonly string[];
}

/**
 * Every tenant in the registry, whatever its status.
 *
 * @systemScope Audit anchor — reads the tenant registry, which is RLS-exempt because
 * its primary key IS the tenant id. No event content is read here.
 *
 * Deliberately NOT `SELECT DISTINCT tenant_id FROM clinical_audit_event`. Driving off
 * the audit table would make a tenant whose events all vanished indistinguishable from
 * a tenant that never had any: both produce no rows, so neither gets anchored and
 * neither is reported. Driving off the registry means a tenant with an empty chain is
 * named in `tenantsWithNoEvents` and someone can ask why.
 *
 * Suspended and offboarding tenants are included for the same reason. An offboarding
 * tenant's chain is the one with the most reason to be quietly rewritten and the least
 * chance of anyone noticing.
 */
async function allRegisteredTenants(db: Db): Promise<string[]> {
  const rows = await sql<{ id: string }>`SELECT id FROM tenant ORDER BY id`.execute(db);
  return rows.rows.map((r) => r.id);
}

/**
 * Run the nightly anchor.
 *
 * A tenant whose chain fails verification is NOT anchored, and the failure is
 * returned rather than thrown. Two reasons, both deliberate:
 *
 *   - Anchoring an unverified chain would certify the corruption. The anchor's whole
 *     purpose is to be a trustworthy record of where the chain stood; one written over
 *     a broken chain is worse than no anchor, because it launders the break.
 *   - One tenant's broken chain must not stop every other tenant being anchored. A
 *     night without anchors across the platform is a night in which any rewrite goes
 *     undetected.
 *
 * A verification failure is an alert, not a crash (§7.3).
 */
export async function runAnchorJob(
  db: Db,
  storage: AnchorStorage,
  anchorDate: string,
): Promise<AnchorJobResult> {
  const tenants = await allRegisteredTenants(db);
  const failing: string[] = [];
  const empty: string[] = [];
  let anchored = 0;

  for (const tenantId of tenants) {
    const verification: VerificationResult = await verifyChain(db, tenantId);
    if (!verification.verified) {
      failing.push(tenantId);
      continue;
    }
    if (verification.lastSeq === null || verification.lastHash === null) {
      empty.push(tenantId);
      continue;
    }

    // Storage first, then the database row. If the object write fails the row is not
    // written, and the next run retries. Writing the row first would claim an anchor
    // exists in storage when it does not — and the row lives where the operator can
    // reach it, so it is the weaker of the two records.
    const body = JSON.stringify({
      tenantId,
      anchorDate,
      lastSeq: verification.lastSeq.toString(),
      lastHash: verification.lastHash,
      eventsChecked: verification.eventsChecked,
    });
    const reference = await storage.put(tenantId, anchorDate, body);
    // writeAnchor re-verifies before inserting. That is one redundant chain walk per
    // tenant per night, and it stays: the refusal to anchor a broken chain belongs to
    // the library, not to whichever caller remembered to check first.
    await writeAnchor(db, tenantId, anchorDate, reference);
    anchored += 1;
  }

  return {
    anchorDate,
    tenantsAnchored: anchored,
    tenantsFailingVerification: failing,
    tenantsWithNoEvents: empty,
  };
}
