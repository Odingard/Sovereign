import {
  BILLABLE_EVENT_NAMES,
  type BillableUnit,
  type CanonicalEvent,
  LATE_EVENT_WINDOW_HOURS,
  collect,
  periodFor,
  projectBillableUnit,
  summarise,
} from "@sovereign/service-metering";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-09-22T12:00:00Z");

const event = (overrides: Partial<CanonicalEvent> = {}): CanonicalEvent => ({
  eventId: "EVT-1",
  tenantId: "TENANT-SYN-A",
  eventName: "patient.created",
  occurredAt: NOW,
  siteId: "SITE-1",
  ...overrides,
});

describe("billable unit projection (S1-18)", () => {
  it("projects a billable event", () => {
    const unit = projectBillableUnit(event());
    expect(unit?.unitType).toBe("patient_managed");
    expect(unit?.quantity).toBe(1);
    expect(unit?.period).toBe("2026-09");
  });

  it("returns null for a non-billable event rather than throwing", () => {
    // Most domain events are not billable. That is the normal case, not an error.
    expect(projectBillableUnit(event({ eventName: "session.revoked" }))).toBeNull();
    expect(projectBillableUnit(event({ eventName: "grant.created" }))).toBeNull();
  });

  it("uses an explicit map, so a new event cannot silently become billable", () => {
    // A tenant discovering an unannounced charge is a trust problem, not a billing
    // one. Prefix matching would make every future patient.* event billable.
    expect(projectBillableUnit(event({ eventName: "patient.viewed" }))).toBeNull();
    expect(projectBillableUnit(event({ eventName: "patient.merged" }))).toBeNull();
    expect(projectBillableUnit(event({ eventName: "artifact.read" }))).toBeNull();
  });

  it("names every billable event explicitly", () => {
    expect(BILLABLE_EVENT_NAMES).toEqual([
      "ai.candidate_generated",
      "artifact.ingested",
      "audit.export",
      "fact.corrected",
      "fact.recorded",
      "patient.created",
      "prior_auth.submitted",
    ]);
  });

  it("carries no price, rate or currency anywhere", () => {
    // Pricing is Phase 3 (PRD O-009). A price embedded in the metering layer is a
    // price nobody can change without a deploy.
    const unit = projectBillableUnit(event()) as BillableUnit;
    const keys = Object.keys(unit).join(" ").toLowerCase();
    for (const forbidden of ["price", "cost", "rate", "amount", "currency", "usd"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("billing period (S1-18)", () => {
  it("derives the period from when the event occurred", () => {
    expect(periodFor(new Date("2026-09-22T12:00:00Z"))).toBe("2026-09");
    expect(periodFor(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });

  it("assigns an event to the month it happened in, not the month it arrived", () => {
    // Queue latency must not move revenue between periods.
    const occurredInAugust = event({
      occurredAt: new Date("2026-08-31T23:59:00Z"),
      eventId: "EVT-LATE",
    });
    expect(projectBillableUnit(occurredInAugust)?.period).toBe("2026-08");
  });

  it("uses UTC so a period boundary does not depend on server locale", () => {
    expect(periodFor(new Date("2026-09-01T00:30:00Z"))).toBe("2026-09");
    expect(periodFor(new Date("2026-08-31T23:30:00Z"))).toBe("2026-08");
  });
});

describe("collection (S1-18)", () => {
  const unit = projectBillableUnit(event()) as BillableUnit;

  it("records a fresh unit", () => {
    expect(collect(unit, false, NOW)).toEqual({ kind: "recorded", unit });
  });

  it("treats a redelivery as a duplicate, not an error", () => {
    // Pub/Sub is at-least-once. The same event WILL arrive twice, and it must not
    // bill twice.
    expect(collect(unit, true, NOW)).toEqual({ kind: "duplicate", eventId: "EVT-1" });
  });

  it("keeps a late event separately rather than discarding it", () => {
    // Gate 2 asks whether metering reconciles to canonical events. An event silently
    // dropped for lateness is a reconciliation failure nobody can explain later.
    const old = { ...unit, occurredAt: new Date("2026-09-10T00:00:00Z") };
    const outcome = collect(old, false, NOW);
    expect(outcome.kind).toBe("late");
    if (outcome.kind === "late") {
      expect(outcome.latenessHours).toBeGreaterThan(LATE_EVENT_WINDOW_HOURS);
      expect(outcome.unit).toEqual(old);
    }
  });

  it("accepts an event inside the 72 hour window", () => {
    const recent = { ...unit, occurredAt: new Date(NOW.getTime() - 71 * 3_600_000) };
    expect(collect(recent, false, NOW).kind).toBe("recorded");
  });

  it("checks duplication before lateness", () => {
    // A late duplicate is still a duplicate. Recording it as late would double-count
    // it in the late ledger.
    const old = { ...unit, occurredAt: new Date("2026-01-01T00:00:00Z") };
    expect(collect(old, true, NOW).kind).toBe("duplicate");
  });
});

describe("summary (S1-18)", () => {
  it("totals quantities by unit type", () => {
    const units = [
      projectBillableUnit(event({ eventId: "E1" })),
      projectBillableUnit(event({ eventId: "E2" })),
      projectBillableUnit(event({ eventId: "E3", eventName: "artifact.ingested" })),
    ].filter((u): u is BillableUnit => u !== null);
    expect(summarise(units)).toEqual({ patient_managed: 2, artifact_ingested: 1 });
  });

  it("returns an empty summary for no units", () => {
    expect(summarise([])).toEqual({});
  });
});
