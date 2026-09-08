"use client";

/**
 * @file Hero Section Component
 * @description Renders the primary homepage headline, positioning copy, CTAs,
 * and high-fidelity clinical execution architecture diagram.
 */

import { trackCtaClick } from "@/lib/analytics/events";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="hero-section" aria-labelledby="hero-heading">
      <div className="container">
        <div className="hero-content">
          <div className="hero-badge-wrapper">
            <span className="badge badge-teal">
              Specialty Clinical Intelligence &amp; Execution Platform
            </span>
          </div>

          <h1 id="hero-heading" className="hero-headline">
            From clinical decision to completed care.
          </h1>

          <p className="hero-subheadline">
            Sovereign is building a specialty clinical intelligence and execution platform that
            helps practices turn longitudinal clinical information, physician decisions, and complex
            administrative workflows into coordinated, trackable care execution.
          </p>

          <div className="hero-cta-group">
            <Link
              href="/early-access"
              className="btn btn-primary btn-lg"
              id="hero-request-early-access-cta"
              onClick={() => trackCtaClick("hero_cta_click", "hero", "Request Early Access")}
            >
              Request Early Access
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/rheumatology"
              className="btn btn-secondary btn-lg"
              id="hero-explore-rheumatology-cta"
              onClick={() =>
                trackCtaClick("rheumatology_cta_click", "hero", "Explore Sovereign Rheumatology")
              }
            >
              Explore Sovereign Rheumatology
            </Link>
          </div>

          <div className="hero-trust-bar">
            <div className="trust-item">
              <span className="trust-item-icon" aria-hidden="true">
                &check;
              </span>
              <span>Human Clinician Decides</span>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon" aria-hidden="true">
                &check;
              </span>
              <span>Evidence-Linked State</span>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon" aria-hidden="true">
                &check;
              </span>
              <span>Built First for Rheumatology</span>
            </div>
            <div className="trust-item">
              <span className="trust-item-icon" aria-hidden="true">
                &check;
              </span>
              <span>Enterprise Tenancy Isolation</span>
            </div>
          </div>

          {/* High-Fidelity Architecture & Execution Visual Card */}
          <div className="hero-diagram-card" aria-label="Care Execution Pipeline Preview">
            <div className="hero-diagram-header">
              <div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--teal-primary)",
                    fontWeight: "700",
                  }}
                >
                  Sovereign Core Loop
                </span>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    color: "var(--navy-primary)",
                    marginTop: "0.25rem",
                  }}
                >
                  Longitudinal Care Execution Architecture
                </h3>
              </div>
              <span className="diagram-status-pill">&bull; Active Care State</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              <div
                style={{
                  background: "var(--bg-subtle)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  Stage 01
                </span>
                <h4 style={{ fontSize: "1rem", color: "var(--navy-primary)", margin: "0.4rem 0" }}>
                  Longitudinal Profile
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Synthesizes multi-year DMARD exposure and disease metrics.
                </p>
              </div>

              <div
                style={{
                  background: "var(--bg-subtle)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  Stage 02
                </span>
                <h4 style={{ fontSize: "1rem", color: "var(--navy-primary)", margin: "0.4rem 0" }}>
                  Evidence Anchor
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Every clinical assertion verified with immutable provenance.
                </p>
              </div>

              <div
                style={{
                  background: "var(--teal-subtle)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--teal-border)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--teal-hover)",
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  Stage 03
                </span>
                <h4 style={{ fontSize: "1rem", color: "var(--teal-hover)", margin: "0.4rem 0" }}>
                  Clinician Decision
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--teal-hover)" }}>
                  Physician establishes clinical intent under human authority.
                </p>
              </div>

              <div
                style={{
                  background: "var(--bg-subtle)",
                  padding: "1.25rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-light)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    fontWeight: "700",
                    textTransform: "uppercase",
                  }}
                >
                  Stage 04
                </span>
                <h4 style={{ fontSize: "1rem", color: "var(--navy-primary)", margin: "0.4rem 0" }}>
                  Execution Graph
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Orchestrates prior auth, pharmacy, and infusion tracking.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
