/**
 * @file PHI-redacting structured logger (WO-002C S1-05)
 * @description Deny-by-default log serializer over the contracts allowlist.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.8, S1-D12, ADR-0007 §5.
 *
 * ADR-0007 §5 classifies operational logs as non-PHI infrastructure data. This file
 * is what makes that classification true rather than aspirational.
 *
 * Two rules, both enforced here:
 *
 *   1. The KEY must be registered in LOG_FIELD_ALLOWLIST (@sovereign/contracts).
 *   2. The VALUE must be a primitive.
 *
 * The second rule matters as much as the first. Allowlisting `result` does no good if
 * a caller passes `result: patientRecord` — the key is fine and the whole record ends
 * up in the log. Objects, arrays, functions and symbols are never serialised, whatever
 * their key.
 */

import {
  LOG_FIELD_ALLOWLIST,
  REDACTED,
  isAllowedLogField,
  isProhibitedLogField,
} from "@sovereign/contracts";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogRecord {
  readonly level: LogLevel;
  readonly msg: string;
  readonly [field: string]: unknown;
}

export interface LoggerOptions {
  /** Minimum level to emit. Defaults to "info". */
  readonly level?: LogLevel;
  /** Where a serialised record goes. Defaults to process.stdout. */
  readonly sink?: (line: string) => void;
  /** Fields merged into every record. Subject to the same allowlist. */
  readonly base?: Record<string, unknown>;
  /** Clock, injectable for tests. */
  readonly now?: () => Date;
}

/**
 * A primitive is safe to serialise. Anything else is a container that could hold a
 * clinical record, so it never reaches the sink.
 *
 * `bigint` is included and rendered as a decimal string — the audit chain's `seq` is
 * a bigint and JSON.stringify would otherwise throw.
 */
function isPrimitive(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean" || t === "bigint";
}

/**
 * Whether a dropped field's NAME may itself be echoed.
 *
 * Only names Sovereign authored are echoed — those on the prohibited list in
 * @sovereign/contracts. Everything else is counted, never named.
 *
 * An earlier version of this function allowed any `[A-Za-z0-9_]{1,40}` key through on
 * the theory that field names are developer-chosen. The PHI-leak test disproved it:
 * `log.info("x", { [patient.mrn]: 1 })` puts a record number in the key position, and
 * a plain alphanumeric identifier passes that charset check cleanly. A key can come
 * from data, so an unrecognised key is data until proven otherwise.
 *
 * The cost is that a legitimate-but-unregistered field like `userAgent` shows up only
 * in `redactedCount`. That is the right side to err on: the developer still sees that
 * something was dropped and can check the call site.
 */
function isEchoableKeyName(key: string): boolean {
  return isProhibitedLogField(key);
}

function serializeValue(value: unknown): string | number | boolean | null {
  if (typeof value === "bigint") {
    return value.toString();
  }
  return value as string | number | boolean | null;
}

/**
 * Apply the allowlist to one record.
 *
 * Exported for direct testing: the PHI-leak assertion in this package's suite calls
 * it with seeded synthetic PHI and checks the output.
 */
export function redactRecord(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const named: string[] = [];
  let droppedCount = 0;

  for (const [key, value] of Object.entries(fields)) {
    if (!isAllowedLogField(key)) {
      droppedCount += 1;
      if (isEchoableKeyName(key)) {
        named.push(key);
      }
      continue;
    }
    if (!isPrimitive(value)) {
      // Registered key, unsafe value. Keep the key so the shape of the log is
      // stable, but never the contents.
      out[key] = REDACTED;
      continue;
    }
    out[key] = serializeValue(value);
  }

  if (droppedCount > 0) {
    out.redactedCount = droppedCount;
    if (named.length > 0) {
      out.redactedFields = [...new Set(named)].sort();
    }
  }
  return out;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Derive a logger carrying additional (still allowlisted) base fields. */
  child(base: Record<string, unknown>): Logger;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const minimum = LEVEL_ORDER[options.level ?? "info"];
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));
  const base = options.base ?? {};
  const now = options.now ?? (() => new Date());

  function emit(level: LogLevel, msg: string, fields: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < minimum) {
      return;
    }
    // `msg` is expected to be a static literal (see LOG_MSG_MUST_BE_STATIC in
    // @sovereign/contracts). It is passed through rather than redacted, which is
    // exactly why the PHI-leak test greps the whole output stream.
    const record = {
      ...redactRecord({ ...base, ...fields }),
      level,
      msg,
      timestamp: now().toISOString(),
    };
    sink(JSON.stringify(record));
  }

  const logger: Logger = {
    debug: (msg, fields = {}) => emit("debug", msg, fields),
    info: (msg, fields = {}) => emit("info", msg, fields),
    warn: (msg, fields = {}) => emit("warn", msg, fields),
    error: (msg, fields = {}) => emit("error", msg, fields),
    child: (extra) => createLogger({ ...options, base: { ...base, ...extra } }),
  };
  return logger;
}

/** The allowlist, re-exported so consumers need not reach into contracts for it. */
export { LOG_FIELD_ALLOWLIST };
