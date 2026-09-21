/**
 * @file Structured Log Field Allowlist (WO-002C S1-04)
 * @description The complete set of field names permitted in operational log output.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.8, S1-D12, ADR-0007 §5.
 *
 * DENY BY DEFAULT. This is an allowlist, not a scrubber. A scrubber tries to
 * recognise sensitive values and remove them, and fails on anything it has not seen
 * before. An allowlist emits only what is registered here and replaces everything
 * else with `[redacted]` — an unregistered field is dropped whether or not it looks
 * dangerous. The failure mode of a scrubber is a leak; the failure mode of an
 * allowlist is a missing log line. Only one of those is acceptable for PHI.
 *
 * ADR-0007 §5 classifies operational logs as NON-PHI infrastructure data. That
 * classification is only true if this list keeps it true.
 *
 * Adding a field here is a security-reviewed change. The question to answer is not
 * "is this field useful?" but "can this field ever carry patient-identifying data,
 * free text, or a credential, under any code path, including error paths?"
 */

/**
 * Permitted log fields.
 *
 * Every entry is a Sovereign-internal identifier, a protocol-level fact, or a
 * bounded enum. None can carry clinical content.
 */
export const LOG_FIELD_ALLOWLIST = [
  // --- correlation ---
  "correlationId",
  "causationId",
  "requestId",
  "sessionId",

  // --- tenancy and actor (internal identifiers, never names) ---
  "tenantId",
  "actorId",
  "actorKind",
  "siteId",

  // --- transport ---
  "httpMethod",
  "route", // the registered route PATTERN, e.g. /v1/patients/:id — never the resolved URL
  "statusCode",
  "durationMs",

  // --- outcome ---
  "errorCode", // taxonomy code only; never an exception message (§8.7)
  "result",
  "capability",
  "decision",
  "reasonCode",

  // --- audit and eventing ---
  "eventId",
  "seq",
  "topic",
  "subscription",
  "deliveryAttempt",

  // --- service identity ---
  "service",
  "env",
  "version",
  "region",

  // --- log envelope ---
  "level",
  "timestamp",
  "msg", // MUST be a static literal. See the note below.
] as const;

export type LogField = (typeof LOG_FIELD_ALLOWLIST)[number];

const ALLOWED = new Set<string>(LOG_FIELD_ALLOWLIST);

/** True when `name` may be emitted verbatim. */
export function isAllowedLogField(name: string): name is LogField {
  return ALLOWED.has(name);
}

/** The value substituted for every unregistered field. */
export const REDACTED = "[redacted]" as const;

/**
 * Field names that are explicitly and permanently PROHIBITED, listed so that a
 * future reader sees the reasoning rather than an absence.
 *
 * These are not merely "not allowlisted" — they must never be added. A unit test in
 * `packages/telemetry` (S1-05) asserts the two lists never intersect.
 *
 * `patientId` deserves its own note. It is a Sovereign-internal identifier, not a
 * direct identifier, so it is tempting to allow. It is prohibited because a log
 * stream keyed by patient reconstructs who was treated, when, and how often — which
 * is PHI regardless of whether a name appears. Patient linkage belongs in the audit
 * chain (§7.3), which is access-controlled, hash-chained and queryable only with the
 * `audit:query` capability. Operational logs have none of those protections.
 */
export const LOG_FIELD_PROHIBITED = [
  "patientId",
  "patient",
  "mrn",
  "identifierValue",
  "demographics",
  "firstName",
  "lastName",
  "name",
  "dob",
  "dateOfBirth",
  "ssn",
  "email",
  "phone",
  "address",
  "note",
  "narrative",
  "text",
  "body",
  "requestBody",
  "responseBody",
  "payload",
  "sql",
  "query",
  "params",
  "headers",
  "authorization",
  "token",
  "password",
  "secret",
  "apiKey",
  "stack",
  "stackTrace",
] as const;

export type ProhibitedLogField = (typeof LOG_FIELD_PROHIBITED)[number];

const PROHIBITED = new Set<string>(LOG_FIELD_PROHIBITED);

/** True when `name` is explicitly prohibited (a stronger statement than "not allowed"). */
export function isProhibitedLogField(name: string): boolean {
  return PROHIBITED.has(name);
}

/**
 * On `msg`:
 *
 * A message field is unavoidable in practice, and it is also the single easiest way
 * to leak PHI — `log.info(\`patient \${p.name} updated\`)` defeats every other control
 * in this file. The rule is that `msg` carries a STATIC string literal and all
 * variable data travels in allowlisted fields beside it.
 *
 * This cannot be enforced by a type. It is enforced by:
 *   1. a Semgrep rule flagging template literals passed as `msg` (S1-20), and
 *   2. the PHI-leak test in S1-05, which runs the suite with seeded synthetic PHI and
 *      greps the entire log stream for it — asserting zero hits.
 *
 * If either control is removed, this field must be removed with it.
 */
export const LOG_MSG_MUST_BE_STATIC = true as const;
