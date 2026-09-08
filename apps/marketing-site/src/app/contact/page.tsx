/**
 * @file Contact Page (/contact)
 * @description General business inquiries, design partner discussions, and security contact details
 * for Sovereign Health AI LLC.
 */

import { constructMetadata } from "@/lib/seo/site-metadata";
import Link from "next/link";

export const metadata = constructMetadata({
  title: "Contact Us | Sovereign Health AI LLC",
  description:
    "Get in touch with Sovereign Health AI LLC for design partner inquiries, clinical workflow evaluation, and commercial partnerships.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="section section-subtle" style={{ minHeight: "80vh", paddingTop: "4.5rem" }}>
      <div className="container container-narrow">
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <span className="badge badge-teal" style={{ marginBottom: "1rem" }}>
            Get in Touch
          </span>
          <h1
            style={{
              fontSize: "2.75rem",
              fontWeight: "800",
              color: "var(--navy-primary)",
              marginBottom: "1rem",
            }}
          >
            Contact Sovereign
          </h1>
          <p
            style={{
              fontSize: "1.15rem",
              color: "var(--text-secondary)",
              maxWidth: "620px",
              margin: "0 auto",
            }}
          >
            Whether you are an independent rheumatology practice interested in our design-partner
            program or exploring clinical partnerships, we look forward to speaking with you.
          </p>
        </div>

        {/* Mandatory Anti-PHI Notice */}
        <div className="phi-warning-banner" role="alert" style={{ marginBottom: "2.5rem" }}>
          <span className="phi-warning-icon" aria-hidden="true">
            &#9888;
          </span>
          <div>
            <strong>Important Notice:</strong> Sovereign provides B2B software for healthcare
            practices. We do not provide clinical advice or patient medical services. Please do not
            submit patient health records, names, or clinical documents through any contact channel.
          </div>
        </div>

        <div className="grid-2">
          <div className="card" style={{ padding: "2.5rem" }}>
            <h3
              style={{ fontSize: "1.3rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              Practice &amp; Design Partner Inquiries
            </h3>
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
                lineHeight: "1.6",
                marginBottom: "1.5rem",
              }}
            >
              Interested in seeing a demonstration of Sovereign Rheumatology or joining our
              early-access evaluation cohort?
            </p>
            <Link href="/early-access" className="btn btn-primary" style={{ width: "100%" }}>
              Request Early Access Form
            </Link>
          </div>

          <div className="card" style={{ padding: "2.5rem" }}>
            <h3
              style={{ fontSize: "1.3rem", color: "var(--navy-primary)", marginBottom: "0.75rem" }}
            >
              Corporate &amp; General Inquiries
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                fontSize: "0.95rem",
                color: "var(--text-secondary)",
              }}
            >
              <div>
                <strong>Entity:</strong> Sovereign Health AI LLC
              </div>
              <div>
                <strong>General Inquiries:</strong> contact@sovereignhealth.ai
              </div>
              <div>
                <strong>Security &amp; Privacy:</strong> security@sovereignhealth.ai
              </div>
              <div>
                <strong>Press &amp; Partnerships:</strong> partnerships@sovereignhealth.ai
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
