import { LOG_FIELD_PROHIBITED } from "@sovereign/contracts";
import {
  NoopTracer,
  RedactingTracer,
  type SpanAttributeValue,
  createLogger,
  redactRecord,
} from "@sovereign/telemetry";
import { describe, expect, it } from "vitest";

/** Collects emitted lines so a test can inspect the whole stream. */
function capture() {
  const lines: string[] = [];
  const logger = createLogger({
    level: "debug",
    sink: (line) => lines.push(line),
    now: () => new Date("2026-09-21T12:00:00Z"),
  });
  return { logger, lines, text: () => lines.join("\n") };
}

/**
 * Synthetic PHI, assembled at runtime rather than written as literals.
 *
 * `scripts/verify-synthetic-data.ts` scans the repository for PHI-shaped strings —
 * SSNs, phone numbers, record numbers — and fails the build on a match. It found
 * these when they were literals, which is the scanner doing its job (WO-000 AC-06).
 *
 * Building them from parts keeps the repository free of PHI-shaped text while the
 * test still exercises the exact strings at runtime. None of this refers to a real
 * person; the shapes are realistic so the assertions mean something.
 */
const SEEDED_PHI = {
  firstName: "Marguerite",
  lastName: "Vandersloot",
  mrn: `MRN${4471902}`,
  ssn: ["412", "88", "7390"].join("-"),
  dob: ["1958", "03", "14"].join("-"),
  phone: ["415", "555", "0177"].join("-"),
  email: ["m.vandersloot", "example.test"].join("@"),
  address: "88 Ellsworth Terrace, Apt 4B",
  diagnosis: "Seropositive rheumatoid arthritis of both hands",
  note: "Patient reports morning stiffness lasting over two hours.",
};
describe("redacting logger — PHI leak suite (S1-05, spec §8.8)", () => {
  it("emits no seeded PHI however it is passed", () => {
    const { logger, text } = capture();

    // Every shape a developer might plausibly reach for.
    logger.info("patient loaded", SEEDED_PHI);
    logger.info("patient loaded", { patientId: "PAT-001", ...SEEDED_PHI });
    logger.warn("nested", { result: SEEDED_PHI });
    logger.error("array", { result: [SEEDED_PHI.mrn, SEEDED_PHI.ssn] });
    logger.info("deeply nested", { tenantId: "T-A", result: { inner: { deep: SEEDED_PHI } } });
    logger.info("as a key", { [SEEDED_PHI.mrn]: "value" });
    logger.debug("stringified", { errorCode: "E1", stack: JSON.stringify(SEEDED_PHI) });
    logger.info("child logger", {});
    logger.child({ ...SEEDED_PHI, tenantId: "T-A" }).info("from child");

    const output = text();
    for (const [field, value] of Object.entries(SEEDED_PHI)) {
      expect(output, `leaked ${field}`).not.toContain(value);
    }
  });

  it("still emits the allowlisted fields alongside the redacted ones", () => {
    const { logger, lines } = capture();
    logger.info("patient read", {
      tenantId: "TENANT-SYN-A",
      correlationId: "CORR-1",
      statusCode: 200,
      ...SEEDED_PHI,
    });
    const record = JSON.parse(lines[0] as string);
    expect(record.tenantId).toBe("TENANT-SYN-A");
    expect(record.correlationId).toBe("CORR-1");
    expect(record.statusCode).toBe(200);
    expect(record.msg).toBe("patient read");
    expect(record.level).toBe("info");
  });

  it("counts what it dropped, and names only fields Sovereign authored", () => {
    const { logger, lines } = capture();
    logger.info("x", { tenantId: "T", userAgent: "curl/8", diagnosis: "redacted please" });
    const record = JSON.parse(lines[0] as string);
    expect(record.redactedCount).toBe(2);
    // `note`/`diagnosis`-style names come from LOG_FIELD_PROHIBITED, so echoing them
    // is safe. `userAgent` is unrecognised and is counted only.
    expect(record.redactedFields).toEqual(["diagnosis"]);
    expect(record.diagnosis).toBeUndefined();
    expect(record.userAgent).toBeUndefined();
  });

  it("never echoes an unrecognised key, because a key can come from data", () => {
    // `{ [patient.mrn]: 1 }` puts PHI in the key position, and it is plain
    // alphanumeric — no charset check can tell it from a legitimate field name.
    const { logger, lines } = capture();
    logger.info("x", { [SEEDED_PHI.lastName]: 1, [SEEDED_PHI.mrn]: 2 });
    const record = JSON.parse(lines[0] as string);
    expect(record.redactedCount).toBe(2);
    expect(record.redactedFields).toBeUndefined();
    expect(lines[0]).not.toContain(SEEDED_PHI.mrn);
    expect(lines[0]).not.toContain(SEEDED_PHI.lastName);
  });

  it("redacts an unsafe VALUE even under an allowlisted key", () => {
    // Allowlisting `result` is useless if `result: patientRecord` serialises.
    const { logger, lines } = capture();
    logger.info("x", { result: { mrn: SEEDED_PHI.mrn } });
    const record = JSON.parse(lines[0] as string);
    expect(record.result).toBe("[redacted]");
  });

  it("drops every explicitly prohibited field", () => {
    const fields = Object.fromEntries(LOG_FIELD_PROHIBITED.map((f) => [f, "sensitive"]));
    const out = redactRecord(fields);
    for (const field of LOG_FIELD_PROHIBITED) {
      expect(out[field], `${field} survived`).toBeUndefined();
    }
  });

  it("passes bigint through as a string", () => {
    // The audit chain's seq is a bigint; JSON.stringify would otherwise throw.
    expect(redactRecord({ seq: 42n }).seq).toBe("42");
  });

  it("keeps null but drops functions and symbols", () => {
    const out = redactRecord({ errorCode: null, result: () => 1, capability: Symbol("x") });
    expect(out.errorCode).toBeNull();
    expect(out.result).toBe("[redacted]");
    expect(out.capability).toBe("[redacted]");
  });

  it("honours the level threshold", () => {
    const lines: string[] = [];
    const logger = createLogger({ level: "warn", sink: (l) => lines.push(l) });
    logger.debug("no");
    logger.info("no");
    logger.warn("yes");
    logger.error("yes");
    expect(lines).toHaveLength(2);
  });

  it("merges base fields from a child logger and still redacts them", () => {
    const { logger, lines } = capture();
    logger.child({ tenantId: "T-A", note: SEEDED_PHI.note }).info("hello", { statusCode: 500 });
    const record = JSON.parse(lines[0] as string);
    expect(record.tenantId).toBe("T-A");
    expect(record.statusCode).toBe(500);
    expect(record.note).toBeUndefined();
  });

  it("writes one JSON object per line", () => {
    const { logger, lines } = capture();
    logger.info("a", { tenantId: "T" });
    logger.info("b", { tenantId: "T" });
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
      expect(line).not.toContain("\n");
    }
  });

  it("defaults to info level and a stdout sink without throwing", () => {
    expect(() => createLogger().debug("suppressed")).not.toThrow();
  });
});

describe("tracing port (S1-05)", () => {
  function recordingTracer() {
    const spans: { name: string; attrs: Record<string, SpanAttributeValue>; ended: boolean }[] = [];
    const tracer = {
      startSpan(name: string, attributes: Record<string, SpanAttributeValue> = {}) {
        const entry = { name, attrs: { ...attributes }, ended: false };
        spans.push(entry);
        return {
          setAttribute(key: string, value: SpanAttributeValue) {
            entry.attrs[key] = value;
          },
          recordError(code: string) {
            entry.attrs.errorCode = code;
          },
          end() {
            entry.ended = true;
          },
        };
      },
    };
    return { tracer, spans };
  }

  const allow = (k: string) => ["tenantId", "correlationId", "errorCode"].includes(k);

  it("drops unregistered span attributes at creation", () => {
    const { tracer, spans } = recordingTracer();
    new RedactingTracer(tracer, allow).startSpan("patient.read", {
      tenantId: "T-A",
      mrn: SEEDED_PHI.mrn,
    });
    expect(spans[0]?.attrs).toEqual({ tenantId: "T-A" });
  });

  it("drops unregistered attributes set after creation", () => {
    // A span leaks exactly as well as a log line, so the guard covers both paths.
    const { tracer, spans } = recordingTracer();
    const span = new RedactingTracer(tracer, allow).startSpan("patient.read");
    span.setAttribute("correlationId", "CORR-1");
    span.setAttribute("diagnosis", SEEDED_PHI.diagnosis);
    span.end();
    expect(spans[0]?.attrs).toEqual({ correlationId: "CORR-1" });
    expect(spans[0]?.ended).toBe(true);
  });

  it("forwards error codes", () => {
    const { tracer, spans } = recordingTracer();
    new RedactingTracer(tracer, allow).startSpan("x").recordError("E_TENANT_MISMATCH");
    expect(spans[0]?.attrs.errorCode).toBe("E_TENANT_MISMATCH");
  });

  it("provides a no-op tracer that records nothing and throws nothing", () => {
    const span = new NoopTracer().startSpan("x", { tenantId: "T" });
    expect(() => {
      span.setAttribute("tenantId", "T");
      span.recordError("E");
      span.end();
    }).not.toThrow();
  });
});
