/**
 * @file Privacy Policy Page (/privacy)
 * @description Draft privacy disclosures for Sovereign Health AI LLC marketing website.
 * Marked as DRAFT — REQUIRES LEGAL REVIEW as instructed by the repository governance rules.
 */

import { constructMetadata } from "@/lib/seo/site-metadata";
import Link from "next/link";

export const metadata = constructMetadata({
  title: "Privacy Policy | Sovereign Health AI LLC",
  description:
    "Privacy policy for Sovereign Health AI LLC public marketing website and early access inquiries.",
  path: "/privacy",
});

export default function PrivacyPolicyPage() {
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
            Privacy Policy
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
          NOTICE: DRAFT — REQUIRES LEGAL REVIEW. This document is a preliminary B2B marketing policy
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
              1. Overview &amp; Scope
            </h2>
            <p>
              This Privacy Policy describes how <strong>Sovereign Health AI LLC</strong>{" "}
              (&ldquo;Sovereign&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
              collects, uses, and protects business information collected through our public
              marketing website (located at sovereignhealth.ai) and early-access inquiry forms.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              This policy applies solely to our public website and commercial B2B early-access
              requests. It does not apply to clinical services or patient medical management.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              2. Strict Non-Collection of Patient Information (No PHI)
            </h2>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "var(--amber-bg)",
                border: "1px solid var(--amber-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--amber-text)",
                fontSize: "0.9rem",
                marginBottom: "0.75rem",
                fontWeight: "500",
              }}
            >
              The Sovereign marketing website does not collect, request, process, or store Protected
              Health Information (PHI) or personal patient records.
            </div>
            <p>
              Our lead capture forms are intended strictly for business representatives (such as
              rheumatologists, practice administrators, and healthcare staff). Visitors must never
              submit patient names, dates of birth, medical record numbers, diagnoses, clinical
              notes, insurance identifiers, or medical files through this website.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              3. Business Information We Collect
            </h2>
            <p>
              When you submit a request for early access, product demonstrations, or general
              inquiries, we collect professional business demographic information, including:
            </p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem", marginBottom: "0.75rem" }}>
              <li>
                Contact details: first name, last name, work email address, and
                organization/practice name.
              </li>
              <li>
                Practice demographics: role or clinical title, practice size (number of physicians),
                and location count.
              </li>
              <li>Technical context: current electronic health record (EHR) vendor (optional).</li>
              <li>General business messages or questions submitted in inquiry forms.</li>
            </ul>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              4. How We Use Business Information
            </h2>
            <p>We use business contact information solely for:</p>
            <ul style={{ paddingLeft: "1.5rem", marginTop: "0.5rem", marginBottom: "0.75rem" }}>
              <li>Responding to your requests for demonstrations or early-access qualification.</li>
              <li>Evaluating fit for our specialty rheumatology design-partner program.</li>
              <li>Providing product announcements and operational updates regarding Sovereign.</li>
              <li>Preventing automated abuse and securing our digital services.</li>
            </ul>
            <p style={{ marginTop: "0.75rem" }}>
              We do not sell, rent, or trade business contact information to third-party data
              brokers or advertisers.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              5. Analytics and Technical Data
            </h2>
            <p>
              Our public website uses minimal, provider-neutral telemetry to understand site
              engagement, traffic attribution (such as campaign UTM parameters), and user
              interactions with primary product sections. This information is processed in aggregate
              to improve website navigation, responsiveness, and performance.
            </p>
          </section>

          <section style={{ marginBottom: "2rem" }}>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              6. Data Security and Retention
            </h2>
            <p>
              We implement appropriate technical and organizational measures to safeguard business
              inquiries against unauthorized access, disclosure, or misuse. Inquiry submissions are
              retained only as long as necessary to fulfill the business purposes outlined in this
              policy or to comply with statutory legal requirements.
            </p>
          </section>

          <section>
            <h2
              style={{ fontSize: "1.35rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              7. Contact Information
            </h2>
            <p>
              If you have questions regarding this Privacy Policy or wish to update your business
              contact details, please contact us at:
            </p>
            <p style={{ marginTop: "0.5rem" }}>
              <strong>Sovereign Health AI LLC</strong>
              <br />
              Email: privacy@sovereignhealth.ai
              <br />
              Website:{" "}
              <Link href="/" style={{ color: "var(--teal-primary)" }}>
                sovereignhealth.ai
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
