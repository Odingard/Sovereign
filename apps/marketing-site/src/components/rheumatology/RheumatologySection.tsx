"use client";

/**
 * @file Sovereign Rheumatology Product Section Component
 * @description Highlights the launch specialty product, designed specifically
 * for independent and physician-led rheumatology practices.
 */

import { trackCtaClick } from "@/lib/analytics/events";
import Link from "next/link";

export function RheumatologySection() {
  const capabilities = [
    {
      title: "Longitudinal Treatment History",
      desc: "Detailed five-part therapy modeling capturing exact medication exposures, intolerance reasons, and failure definitions across conventional, biologic, and targeted synthetic DMARDs.",
    },
    {
      title: "Disease-State Context",
      desc: "Structured representation of articular findings, extra-articular manifestations, serology phenotypes, and longitudinal joint assessments without document loss.",
    },
    {
      title: "Therapy History Reconciliation",
      desc: "Disentangles complex patient histories across multiple EHR encounters, recognizing that an inactive therapy does not automatically equal therapeutic failure.",
    },
    {
      title: "Evidence-Linked State",
      desc: "Every clinical assertion points to verifiable supporting evidence, allowing clinicians and practice staff to trace any historical data point in seconds.",
    },
    {
      title: "Advanced Therapy Workflow",
      desc: "Coordinating multi-step initiation protocols for biologics and JAK inhibitors from physician order to confirmed medication administration.",
    },
    {
      title: "Prior Authorization Preparation",
      desc: "Automating the assembly of complete clinical dossiers, including historical step-therapy duration and failure documentation, aligned with payer rules.",
    },
    {
      title: "Prerequisite & Lab Tracking",
      desc: "Monitoring essential pre-initiation testing (QuantiFERON TB, hepatitis panels, CBC, liver function) so administrative gaps do not stall care.",
    },
    {
      title: "Pharmacy & Infusion Logistics",
      desc: "Tracking specialty pharmacy approvals, copay foundation assistance, bridge orders, and infusion chair scheduling in a single operational view.",
    },
    {
      title: "Continuity & Adherence Monitoring",
      desc: "Closed-loop alerting for treatment interruptions, hold orders during acute infections or surgery, and required monitoring test freshness.",
    },
  ];

  return (
    <section
      className="section section-subtle"
      id="rheumatology"
      aria-labelledby="rheumatology-heading"
    >
      <div className="container">
        <div className="section-header">
          <span className="badge badge-teal" style={{ marginBottom: "1rem" }}>
            Launch Specialty Product
          </span>
          <h2 id="rheumatology-heading" className="section-title">
            Built first for rheumatology.
          </h2>
          <p className="section-desc">
            Rheumatology is one of medicine’s most complex cognitive and operational specialties.
            Sovereign Rheumatology is being built from the ground up for independent and
            physician-led rheumatology practices navigating the realities of biologic therapy and
            chronic disease management.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: "3.5rem" }}>
          {capabilities.map((cap) => (
            <div key={cap.title} className="card card-highlight">
              <h3
                style={{
                  fontSize: "1.15rem",
                  color: "var(--navy-primary)",
                  marginBottom: "0.6rem",
                }}
              >
                {cap.title}
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                {cap.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <Link
            href="/early-access?program=rheumatology"
            className="btn btn-primary btn-lg"
            id="rheumatology-section-early-access-cta"
            onClick={() =>
              trackCtaClick(
                "rheumatology_cta_click",
                "rheumatology_section",
                "Join the Rheumatology Early Access Program",
              )
            }
          >
            Join the Rheumatology Early Access Program
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
        </div>
      </div>
    </section>
  );
}
