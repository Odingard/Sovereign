/**
 * @file About Sovereign Page (/about)
 * @description Corporate background, clinical philosophy, governing doctrine,
 * and security architecture for Sovereign Health AI LLC.
 */

import { EarlyAccessBanner } from "@/components/cta/EarlyAccessBanner";
import { constructMetadata } from "@/lib/seo/site-metadata";
import Link from "next/link";

export const metadata = constructMetadata({
  title: "About Sovereign | Sovereign Health AI LLC",
  description:
    "Sovereign Health AI LLC is building specialty clinical intelligence and execution software so that when a physician decides on care, that care actually gets completed.",
  path: "/about",
});

export default function AboutPage() {
  const tenets = [
    {
      num: "01",
      title: "Sovereign will never be the doctor.",
      desc: "Clinical judgment belongs exclusively to licensed human physicians. Sovereign does not replace or mimic clinical decision-making; we provide the computational infrastructure to see those decisions executed.",
    },
    {
      num: "02",
      title: "The clinician decides; Sovereign makes the decision executable.",
      desc: "Software should transform complex intentions into coordinated, deterministic action across payers, pharmacies, and clinics under explicit clinician authority.",
    },
    {
      num: "03",
      title: "The model is not the system of record.",
      desc: "Probabilistic AI models can assist with information synthesis, but they may never be the authoritative store of clinical truth. Clinical state, evidence, and execution graphs exist independently as verifiable objects.",
    },
    {
      num: "04",
      title: "Unknown is not negative.",
      desc: "Epistemic honesty is a patient safety imperative. If a past laboratory test or clinical symptom was not assessed, software must never silently assume it was negative or absent.",
    },
  ];

  return (
    <>
      <section className="hero-section" style={{ paddingBottom: "4rem" }}>
        <div className="container container-narrow" style={{ textAlign: "center" }}>
          <span className="badge badge-teal" style={{ marginBottom: "1rem" }}>
            Company &amp; Mission
          </span>
          <h1 className="hero-headline" style={{ fontSize: "3rem" }}>
            From clinical decision to completed care.
          </h1>
          <p className="hero-subheadline">
            Sovereign Health AI LLC was founded on a simple observation: modern healthcare has
            exceptional clinical science, but deeply broken execution machinery. We exist to fix the
            space between the prescription and the treatment.
          </p>
        </div>
      </section>

      {/* Governing Doctrine */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Constitutional Principles</span>
            <h2 className="section-title">Governing Clinical Doctrine</h2>
            <p className="section-desc">
              Every architectural decision in Sovereign is bound by non-negotiable safety rules that
              put human clinicians firmly in control.
            </p>
          </div>

          <div className="grid-2">
            {tenets.map((t) => (
              <div key={t.num} className="card">
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    fontWeight: "700",
                    color: "var(--teal-primary)",
                  }}
                >
                  TENET {t.num}
                </span>
                <h3
                  style={{ fontSize: "1.25rem", color: "var(--navy-primary)", margin: "0.5rem 0" }}
                >
                  {t.title}
                </h3>
                <p
                  style={{ fontSize: "0.95rem", color: "var(--text-secondary)", lineHeight: "1.6" }}
                >
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security & Architecture Section */}
      <section className="section section-subtle" id="security">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Enterprise Foundation</span>
            <h2 className="section-title">Security, Tenancy &amp; Data Governance</h2>
            <p className="section-desc">
              Built with rigorous multi-tenant boundaries and auditability designed for independent
              healthcare practices.
            </p>
          </div>

          <div className="grid-3">
            <div className="card">
              <h3
                style={{
                  fontSize: "1.15rem",
                  color: "var(--navy-primary)",
                  marginBottom: "0.75rem",
                }}
              >
                Strict Multi-Tenant Isolation
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Practice data is cryptographically isolated using PostgreSQL Row-Level Security
                (RLS). Cross-tenant access is architecturally impossible at the database layer.
              </p>
            </div>

            <div className="card">
              <h3
                style={{
                  fontSize: "1.15rem",
                  color: "var(--navy-primary)",
                  marginBottom: "0.75rem",
                }}
              >
                Immutable Evidence Linking
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Every asserted clinical trial, lab finding, or joint score is linked to immutable
                source provenance. The lineage of every data point is 100% auditable.
              </p>
            </div>

            <div className="card">
              <h3
                style={{
                  fontSize: "1.15rem",
                  color: "var(--navy-primary)",
                  marginBottom: "0.75rem",
                }}
              >
                Explicit Authority Engine
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                Actions are gated by typed authority classes. Administrative tasks are reversible,
                while clinical transactions require verified human clinician credentials.
              </p>
            </div>
          </div>
        </div>
      </section>

      <EarlyAccessBanner />
    </>
  );
}
