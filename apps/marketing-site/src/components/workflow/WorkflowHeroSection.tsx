"use client";

/**
 * @file Hero Workflow Component — Advanced Therapy Access & Continuity
 * @description Renders the 8-stage care execution pathway and operational metrics.
 */

import { trackEvent } from "@/lib/analytics/events";
import { useEffect } from "react";

export function WorkflowHeroSection() {
  useEffect(() => {
    trackEvent("advanced_therapy_section_view", {
      sectionName: "Advanced Therapy Access & Continuity",
    });
  }, []);

  const pathway = [
    {
      num: "01",
      title: "Clinical Decision",
      desc: "Physician establishes therapeutic intent for biologic or targeted DMARD.",
    },
    {
      num: "02",
      title: "Prerequisites",
      desc: "Verifying screening labs, vaccine history, and required baseline testing.",
    },
    {
      num: "03",
      title: "Documentation",
      desc: "Synthesizing prior DMARD failure dates, doses, and clinical rationale.",
    },
    {
      num: "04",
      title: "Authorization",
      desc: "Preparing and transmitting policy-compliant prior authorization dossiers.",
    },
    {
      num: "05",
      title: "Payer Follow-Up",
      desc: "Tracking review status, handling secondary requests, and managing appeals.",
    },
    {
      num: "06",
      title: "Pharmacy / Infusion",
      desc: "Coordinating specialty dispensing, foundation copay support, or suite scheduling.",
    },
    {
      num: "07",
      title: "Treatment Initiation",
      desc: "Confirming first dose delivery and patient injection training.",
    },
    {
      num: "08",
      title: "Care Continuity",
      desc: "Monitoring response, adherence, safety testing freshness, and refill timing.",
    },
  ];

  return (
    <section className="workflow-section" id="workflow" aria-labelledby="workflow-heading">
      <div className="container">
        <div className="workflow-header">
          <span className="badge badge-dark" style={{ marginBottom: "1rem" }}>
            Care Pathway Orchestration
          </span>
          <h2 id="workflow-heading" className="workflow-headline">
            Turn a therapy decision into a completed care pathway.
          </h2>
          <p className="workflow-subheadline">
            Sovereign Rheumatology is being designed to help practices coordinate the work between a
            clinician’s decision and actual treatment initiation and continuation.
          </p>
        </div>

        {/* 8-Step Interactive Grid */}
        <ol
          className="pathway-container"
          aria-label="Therapy Care Pathway Stages"
          style={{ listStyle: "none", padding: 0 }}
        >
          {pathway.map((step) => (
            <li key={step.num} className="pathway-step">
              <div className="pathway-step-num">STAGE {step.num}</div>
              <h3 className="pathway-step-title">{step.title}</h3>
              <p className="pathway-step-desc">{step.desc}</p>
            </li>
          ))}
        </ol>

        {/* Operational Context Panel */}
        <div className="workflow-callout-panel">
          <div className="workflow-callout-copy">
            <h3>Orchestration Without Guesswork</h3>
            <p>
              In current practice, handoffs between nursing, prior authorization coordinators,
              specialty pharmacies, and payers occur through sticky notes, spreadsheets, and manual
              phone calls. Sovereign transforms this into a trackable, state-driven execution graph.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <span className="badge badge-teal">&bull; Typed Execution States</span>
              <span className="badge badge-blue">&bull; Evidence Grounded</span>
              <span className="badge badge-dark">&bull; Human Controlled</span>
            </div>
          </div>

          <div className="workflow-metric-card">
            <div className="metric-title">The Sovereign Principle</div>
            <div className="metric-value">Attempted is not completed.</div>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--text-inverse-muted)",
                marginTop: "0.75rem",
                lineHeight: "1.5",
              }}
            >
              Sovereign distinguishes between what was ordered, what was transmitted, what was
              accepted, and what was clinically received by the patient.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
