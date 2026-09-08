/**
 * @file Sovereign Rheumatology Specialty Page (/rheumatology)
 * @description In-depth product overview for independent rheumatologists, practice administrators,
 * and biologic access teams.
 */

import { EarlyAccessBanner } from "@/components/cta/EarlyAccessBanner";
import { constructMetadata } from "@/lib/seo/site-metadata";
import Link from "next/link";

export const metadata = constructMetadata({
  title: "Sovereign Rheumatology | Specialty Clinical Intelligence & Execution",
  description:
    "Built specifically for independent and physician-led rheumatology practices. Longitudinal DMARD trial tracking, evidence-linked clinical state, and advanced therapy coordination.",
  path: "/rheumatology",
});

export default function RheumatologyPage() {
  const challenges = [
    {
      title: "Step-Therapy History Reconstruction",
      problem:
        "Payers demand exact historical dates, dosages, and discontinuation reasons for conventional DMARDs before approving targeted therapies.",
      solution:
        "Sovereign reconstructs a five-part decoupled therapy model (exposures, trials, adverse events, hold events, and discontinuation reasons) anchored to primary chart evidence.",
    },
    {
      title: "Prerequisite Safety Monitoring",
      problem:
        "Biologic starts stall when screening tests (QuantiFERON TB, hepatitis serology, liver enzymes) are missing or outdated.",
      solution:
        "Factual monitoring tracking with clear visibility into lab freshness, preventing last-minute prior auth rejections or day-of-infusion cancellations.",
    },
    {
      title: "Disease Activity Derivation Provenance",
      problem:
        "Composite scores (CDAI, SDAI, DAS28) are frequently reported without underlying joint counts or unassessed components, risking clinical misclassification.",
      solution:
        "Strict four-stage derivation architecture separating joint observations, mathematical calculations, and clinician-approved interpretations. Missing components yield explicit NOT_CALCULABLE states rather than silent default values.",
    },
    {
      title: "Specialty Pharmacy & Infusion Handoffs",
      problem:
        "After authorization, orders bounce between specialty pharmacies, foundation assistance programs, and infusion coordinators with zero centralized tracking.",
      solution:
        "Durable care execution graphs that track state from clinical order to confirmed dispensing, chair scheduling, and patient administration.",
    },
  ];

  return (
    <>
      <section className="hero-section" style={{ paddingBottom: "4rem" }}>
        <div className="container">
          <div className="hero-content">
            <span className="badge badge-teal" style={{ marginBottom: "1.25rem" }}>
              Specialty Care Product
            </span>
            <h1 className="hero-headline" style={{ fontSize: "3rem" }}>
              Sovereign Rheumatology
            </h1>
            <p className="hero-subheadline">
              The first specialty product from Sovereign, designed specifically for independent and
              physician-led rheumatology practices managing complex autoimmune diseases, multi-line
              biologic therapies, and intensive administrative hurdles.
            </p>
            <div
              style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}
            >
              <Link href="/early-access?program=rheumatology" className="btn btn-primary btn-lg">
                Join Rheumatology Design Partner Program
              </Link>
              <Link href="/#workflow" className="btn btn-secondary btn-lg">
                View Therapy Access Flow
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-tag">Clinical &amp; Operational Challenges</span>
            <h2 className="section-title">Why Rheumatology Requires Dedicated Architecture</h2>
            <p className="section-desc">
              Generic EHR templates and horizontal AI chatbots fail in rheumatology because they
              treat therapy decisions as text rather than multi-year clinical commitments.
            </p>
          </div>

          <div className="grid-2">
            {challenges.map((c) => (
              <div key={c.title} className="card card-highlight">
                <h3
                  style={{
                    fontSize: "1.3rem",
                    color: "var(--navy-primary)",
                    marginBottom: "0.75rem",
                  }}
                >
                  {c.title}
                </h3>
                <div style={{ marginBottom: "1rem" }}>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      color: "#b91c1c",
                    }}
                  >
                    Practice Pain Point:
                  </span>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--text-secondary)",
                      marginTop: "0.25rem",
                    }}
                  >
                    {c.problem}
                  </p>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      color: "var(--teal-hover)",
                    }}
                  >
                    Sovereign Execution:
                  </span>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      color: "var(--text-primary)",
                      fontWeight: "500",
                      marginTop: "0.25rem",
                    }}
                  >
                    {c.solution}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Disease State Scope Note */}
      <section className="section section-subtle">
        <div className="container container-narrow" style={{ textAlign: "center" }}>
          <span className="badge badge-blue" style={{ marginBottom: "1rem" }}>
            Launch Indication Scope
          </span>
          <h2 style={{ fontSize: "2rem", color: "var(--navy-primary)", marginBottom: "1rem" }}>
            Adult Rheumatoid Arthritis (RA) First
          </h2>
          <p
            style={{
              fontSize: "1.1rem",
              color: "var(--text-secondary)",
              lineHeight: "1.7",
              marginBottom: "2rem",
            }}
          >
            Sovereign is focusing its initial specialty depth on Adult Rheumatoid Arthritis—the most
            common autoimmune inflammatory arthritis with the highest administrative burden for
            targeted therapy access—before expanding to Psoriatic Arthritis, Ankylosing Spondylitis,
            and Lupus.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "1.5rem",
              flexWrap: "wrap",
              fontSize: "0.95rem",
              fontWeight: "600",
              color: "var(--navy-primary)",
            }}
          >
            <span>&bull; 28-Joint Homunculus Modeling</span>
            <span>&bull; Serology Phenotype History</span>
            <span>&bull; Strict Epistemic Unknown-Safety</span>
          </div>
        </div>
      </section>

      <EarlyAccessBanner />
    </>
  );
}
