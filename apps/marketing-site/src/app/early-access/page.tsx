/**
 * @file Early Access & Design Partner Program Page (/early-access)
 * @description Dedicated lead capture landing page for paid campaigns and partner outreach.
 */

import { EarlyAccessForm } from "@/components/forms/EarlyAccessForm";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Request Early Access | Sovereign Rheumatology",
  description:
    "Join select independent and physician-led rheumatology practices participating in Sovereign’s design-partner evaluation and early product access program.",
  path: "/early-access",
});

export default function EarlyAccessPage({
  searchParams,
}: {
  searchParams?: { program?: string };
}) {
  const program = searchParams?.program;

  return (
    <div className="section section-subtle" style={{ minHeight: "80vh", paddingTop: "4rem" }}>
      <div className="container container-narrow">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <span className="badge badge-teal" style={{ marginBottom: "1rem" }}>
            Design Partner Program
          </span>
          <h1
            style={{
              fontSize: "2.75rem",
              fontWeight: "800",
              color: "var(--navy-primary)",
              marginBottom: "1rem",
            }}
          >
            Partner With Sovereign
          </h1>
          <p
            style={{
              fontSize: "1.15rem",
              color: "var(--text-secondary)",
              maxWidth: "680px",
              margin: "0 auto",
            }}
          >
            We are collaborating with a select cohort of independent rheumatology practices to
            eliminate administrative friction between therapy decisions and completed treatment.
          </p>
        </div>

        {/* Embedded Production Lead Form */}
        <EarlyAccessForm initialProgram={program} />

        {/* What to Expect as a Design Partner */}
        <div
          style={{
            marginTop: "4rem",
            padding: "2.5rem",
            background: "#ffffff",
            borderRadius: "var(--radius-xl)",
            border: "1px solid var(--border-light)",
          }}
        >
          <h3
            style={{
              fontSize: "1.35rem",
              color: "var(--navy-primary)",
              marginBottom: "1.25rem",
              textAlign: "center",
            }}
          >
            What Design Partners Receive
          </h3>
          <div className="grid-3" style={{ gap: "1.5rem" }}>
            <div>
              <h4 style={{ fontSize: "1rem", color: "var(--teal-hover)", marginBottom: "0.5rem" }}>
                1. Dedicated Workflow Analysis
              </h4>
              <p
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.55" }}
              >
                Our team maps your practice’s specific biologic access pathways, identifying where
                prior authorization denials, delays, and staff hours accumulate.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: "1rem", color: "var(--teal-hover)", marginBottom: "0.5rem" }}>
                2. Direct Roadmap Influence
              </h4>
              <p
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.55" }}
              >
                Meet regularly with our clinical and product founders to shape feature development
                around your real-world clinic operations.
              </p>
            </div>
            <div>
              <h4 style={{ fontSize: "1rem", color: "var(--teal-hover)", marginBottom: "0.5rem" }}>
                3. Priority Onboarding
              </h4>
              <p
                style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.55" }}
              >
                Receive white-glove onboarding and preferred commercial access when Sovereign
                Rheumatology launches general availability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
