/**
 * @file Tracing port (WO-002C S1-05)
 * @description The boundary between Sovereign and any tracing vendor.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §8.8, S1-D12 (OpenTelemetry → Cloud Trace).
 *
 * DELIBERATE CHOICE: this package declares its own minimal tracing interface rather
 * than importing `@opentelemetry/api`.
 *
 * ADR-0011 §Decision 2 restricts `packages/kernel|crypto|telemetry` to depending only
 * on `contracts` and `domain`, and `scripts/verify-architecture.ts` enforces it. OTel
 * is a good standard and its `api` package is intentionally dependency-free, so
 * importing it would be defensible — but it is still an external dependency in a tier
 * that has none, and the same argument was made for Cloud KMS in `packages/crypto`
 * before the port won there.
 *
 * The OTel SDK binding is an adapter, delivered with the rest of the observability
 * wiring. Swapping it costs one implementation of this interface.
 *
 * Span attributes are subject to the SAME allowlist as logs: a span carrying
 * `patientId` leaks exactly as effectively as a log line carrying it.
 */

/** Attribute values a span may carry. Primitives only, for the same reason logs are. */
export type SpanAttributeValue = string | number | boolean;

export interface Span {
  /** Set an attribute. Unregistered names are dropped by the implementation. */
  setAttribute(key: string, value: SpanAttributeValue): void;
  /** Mark the span failed. `errorCode` is a taxonomy code, never an exception message. */
  recordError(errorCode: string): void;
  end(): void;
}

export interface Tracer {
  /**
   * Start a span. `name` must be a static, low-cardinality operation name —
   * "patient.read", not "patient.read.PAT-123". High-cardinality span names are both
   * a cost problem and a leak vector.
   */
  startSpan(name: string, attributes?: Record<string, SpanAttributeValue>): Span;
}

/** A span that records nothing. Used in unit tests and wherever tracing is disabled. */
export class NoopSpan implements Span {
  setAttribute(_key: string, _value: SpanAttributeValue): void {}
  recordError(_errorCode: string): void {}
  end(): void {}
}

export class NoopTracer implements Tracer {
  startSpan(_name: string, _attributes?: Record<string, SpanAttributeValue>): Span {
    return new NoopSpan();
  }
}

/**
 * A tracer that applies the log-field allowlist to span attributes.
 *
 * Wraps any underlying Tracer, so the redaction guarantee does not depend on the
 * vendor adapter remembering to implement it.
 */
export class RedactingTracer implements Tracer {
  constructor(
    private readonly inner: Tracer,
    private readonly isAllowed: (key: string) => boolean,
  ) {}

  startSpan(name: string, attributes: Record<string, SpanAttributeValue> = {}): Span {
    const permitted: Record<string, SpanAttributeValue> = {};
    for (const [key, value] of Object.entries(attributes)) {
      if (this.isAllowed(key)) {
        permitted[key] = value;
      }
    }
    const span = this.inner.startSpan(name, permitted);
    const guard = this.isAllowed;
    return {
      setAttribute(key, value) {
        if (guard(key)) {
          span.setAttribute(key, value);
        }
      },
      recordError: (errorCode) => span.recordError(errorCode),
      end: () => span.end(),
    };
  }
}
