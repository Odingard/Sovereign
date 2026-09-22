/**
 * @file Billable unit projection (WO-002C S1-18)
 * @description Projects canonical domain events into billable units.
 *
 * Source: docs/ENTERPRISE_BUILD_PLAN.md Phase 3, ADR-0011 Decision 6.
 *
 * PRICING IS NOT DECIDED HERE, and deliberately cannot be. This module emits UNITS —
 * countable facts about what happened. What a unit costs, whether it is bundled, and
 * how it is invoiced are Phase 3 decisions that follow pilot economics (PRD O-009).
 * There is no money anywhere in this file, and there should not be: a price embedded
 * in the metering layer is a price nobody can change without a deploy.
 *
 * The reason to build it now, before pricing exists: a unit that was not recorded when
 * it happened cannot be reconstructed afterwards. Gate 2 asks whether metering
 * reconciles 100% to canonical events on sampled periods, and that question can only
 * be answered by a system that was counting all along.
 */

export type BillableUnitType =
  | "patient_managed"
  | "artifact_ingested"
  | "clinical_fact_recorded"
  | "prior_auth_submitted"
  | "ai_candidate_generated"
  | "audit_export";

export interface CanonicalEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly eventName: string;
  readonly occurredAt: Date;
  readonly siteId: string | null;
}

export interface BillableUnit {
  readonly tenantId: string;
  readonly period: string;
  readonly eventId: string;
  readonly unitType: BillableUnitType;
  readonly quantity: number;
  readonly occurredAt: Date;
  readonly sourceEventName: string;
  readonly siteId: string | null;
}

/**
 * Which canonical events produce a billable unit.
 *
 * An explicit map, not a pattern match. Every entry is a deliberate statement that
 * this event is worth counting; a new domain event does not silently become billable
 * because its name happened to match a prefix. A tenant discovering an unannounced
 * charge is a trust problem, not a billing one.
 */
const UNIT_FOR_EVENT: Readonly<Record<string, BillableUnitType>> = {
  "patient.created": "patient_managed",
  "artifact.ingested": "artifact_ingested",
  "fact.recorded": "clinical_fact_recorded",
  "fact.corrected": "clinical_fact_recorded",
  "prior_auth.submitted": "prior_auth_submitted",
  "ai.candidate_generated": "ai_candidate_generated",
  "audit.export": "audit_export",
} as const;

/**
 * The billing period an event belongs to: YYYY-MM in UTC, derived from when the event
 * OCCURRED, never from when it arrived.
 *
 * A message delayed across a month boundary belongs to the month the work happened in.
 * Using arrival time would let queue latency move revenue between periods, which is
 * both wrong and the kind of wrong an auditor notices.
 */
export function periodFor(occurredAt: Date): string {
  return occurredAt.toISOString().slice(0, 7);
}

/**
 * Project an event, or return null when it is not billable.
 *
 * Returning null rather than throwing: most domain events are not billable, and that
 * is the normal case rather than an error.
 */
export function projectBillableUnit(event: CanonicalEvent): BillableUnit | null {
  const unitType = UNIT_FOR_EVENT[event.eventName];
  if (unitType === undefined) {
    return null;
  }
  return {
    tenantId: event.tenantId,
    period: periodFor(event.occurredAt),
    eventId: event.eventId,
    unitType,
    quantity: 1,
    occurredAt: event.occurredAt,
    sourceEventName: event.eventName,
    siteId: event.siteId,
  };
}

/** Events that produce a billable unit. Exported so the set is inspectable and testable. */
export const BILLABLE_EVENT_NAMES = Object.keys(UNIT_FOR_EVENT).sort();

/** Late-event window (ENTERPRISE_BUILD_PLAN Phase 3). */
export const LATE_EVENT_WINDOW_HOURS = 72;

export type CollectionOutcome =
  | { readonly kind: "recorded"; readonly unit: BillableUnit }
  | { readonly kind: "duplicate"; readonly eventId: string }
  | {
      readonly kind: "late";
      readonly unit: BillableUnit;
      readonly latenessHours: number;
    };

/**
 * Decide how to collect a unit.
 *
 * Three outcomes, and the distinction between them is the whole design:
 *
 *   recorded   counted in its period
 *   duplicate  already counted; Pub/Sub is at-least-once so this is expected, not an error
 *   late       arrived after the 72h window; RECORDED SEPARATELY, never discarded
 *
 * A late event is kept rather than dropped. Gate 2 asks whether metering reconciles to
 * canonical events; an event silently discarded for lateness is a reconciliation
 * failure that nobody can explain months later, and the honest answer — "it arrived
 * late and here is when" — is only available if it was written down.
 */
export function collect(
  unit: BillableUnit,
  alreadyCollected: boolean,
  now: Date,
): CollectionOutcome {
  if (alreadyCollected) {
    return { kind: "duplicate", eventId: unit.eventId };
  }
  const latenessHours = Math.floor((now.getTime() - unit.occurredAt.getTime()) / 3_600_000);
  if (latenessHours > LATE_EVENT_WINDOW_HOURS) {
    return { kind: "late", unit, latenessHours };
  }
  return { kind: "recorded", unit };
}

/** Total quantity by unit type for a period. Counting only; no rating, no money. */
export function summarise(units: readonly BillableUnit[]): Readonly<Record<string, number>> {
  const totals: Record<string, number> = {};
  for (const unit of units) {
    totals[unit.unitType] = (totals[unit.unitType] ?? 0) + unit.quantity;
  }
  return totals;
}
