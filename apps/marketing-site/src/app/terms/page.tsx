/**
 * @file Terms of Service Page (/terms)
 * @description Draft terms of use for Sovereign Health AI LLC marketing website and early access program.
 * Marked as DRAFT — REQUIRES LEGAL REVIEW as instructed by repository governance rules.
 */

import { constructMetadata } from "@/lib/seo/site-metadata";
import Link from "next/link";

export const metadata = constructMetadata({
  title: "Terms of Service | Sovereign Health AI LLC",
  description:
    "Terms of service governing the use of Sovereign Health AI LLC public website and early-access program applications.",
  path: "/terms",
});

export default function TermsOfServicePage() {
  return (
    <div
      className="section section-subtle"
      style={{ minHeight: "80vh", paddingTop: "4.5rem", paddingBottom: "5rem" }}
    >
      <div className="container container-narrow">
        <div style={{ marginBottom: "2.5rem" }}>
          <span className="badge badge-teal" style={{ marginBottom: "1rem" }}>
            Legal Disclosures
          </span>
          <h1
            style={{
              fontSize: "2.75rem",
              fontWeight: "800",
              color: "var(--navy-primary)",
              marginBottom: "0.5rem",
            }}
          >
            Terms of Service
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Last updated: September 2026
          </p>
        </div>

        {/* Mandatory Draft Review Callout */}
        <div
          role="note"
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "var(--radius-md)",
            color: "#92400e",
            fontSize: "0.9rem",
            fontWeight: "600",
            marginBottom: "2rem",
          }}
        >
          NOTICE: DRAFT — REQUIRES LEGAL REVIEW. This document is a preliminary B2B marketing terms
          draft and does not constitute finalized legal counsel approval.
        </div>

        <div
          className="card"
          style={{ padding: "2.5rem", lineHeight: "1.7", color: "var(--text-secondary)" }}
        >
          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the website of <strong>Sovereign Health AI LLC</strong>{" "}
              (&ldquo;Sovereign&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) or
              submitting an inquiry through our early-access forms, you agree to be bound by these
              Terms of Service. If you do not agree to these terms, do not access or use this site.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              2. Clinical Disclaimers — Sovereign Will Never Be the Doctor
            </h2>
            <div
              style={{
                padding: "1.25rem",
                backgroundColor: "var(--teal-light)",
                border: "1px solid rgba(13, 148, 136, 0.2)",
                borderRadius: "var(--radius-sm)",
                color: "var(--navy-primary)",
                fontSize: "0.95rem",
                marginBottom: "1rem",
                fontWeight: "600",
              }}
            >
              The clinician decides. Sovereign makes the decision executable.
            </div>
            <p>
              <strong>Sovereign will never be the doctor.</strong> The materials on this website are
              provided for informational and business evaluation purposes only. Sovereign is
              building clinical intelligence and workflow execution software;{" "}
              <strong>
                Sovereign is not a healthcare provider and does not provide medical advice,
                diagnosis, or treatment decisions
              </strong>
              . All clinical judgment, diagnosis, and prescription authorities remain exclusively
              with licensed healthcare practitioners.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              We do not guarantee payer prior authorization approval, treatment coverage, specific
              financial reimbursement outcomes, or FDA clearance. Descriptions of capabilities
              reflect intended software features currently in development and early access.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              3. Strict Prohibition on Protected Health Information (PHI)
            </h2>
            <p>
              This website and its associated inquiry forms are public, unencrypted communication
              channels intended solely for business contact. You agree that you will not submit,
              transmit, or upload any Protected Health Information (as defined under HIPAA) or
              personal medical records to Sovereign through this website.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              4. Early-Access &amp; Design-Partner Program
            </h2>
            <p>
              Submission of an application for early access or design-partner participation does not
              guarantee acceptance or access to Sovereign software. Participation in design-partner
              or pilot programs is subject to separate definitive written agreements executed
              between Sovereign Health AI LLC and the participating healthcare organization.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              5. Intellectual Property
            </h2>
            <p>
              All content, brand trademarks, logos, visual diagrams, copy, software architectures,
              and interface designs displayed on this website are the proprietary property of
              Sovereign Health AI LLC and are protected by applicable copyright, trademark, and
              intellectual property laws.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              6. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, Sovereign Health AI LLC and its
              officers, directors, employees, and agents shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising out of or related to
              your use of, or inability to use, this marketing website.
            </p>
          </section>

          <section>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              7. Governing Law &amp; Contact
            </h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of the State
              of Delaware, without regard to its conflict of law provisions.
            </p>
            <p style={{ marginTop: "0.5rem" }}>
              For legal questions regarding these terms, contact:
              <br />
              <strong>Sovereign Health AI LLC</strong>
              <br />
              Email: legal@sovereignhealth.ai
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
