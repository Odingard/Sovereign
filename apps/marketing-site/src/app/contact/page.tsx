import { constructMetadata } from "@/lib/seo/site-metadata";
import Link from "next/link";

export const metadata = constructMetadata({
  title: "Contact Sovereign | Product, Partnership & Investor Inquiries",
  description:
    "Contact Sovereign Health AI LLC about a design partnership, practice inquiry, strategic partnership, security architecture, or investment.",
  path: "/contact",
});

const reasons = [
  ["Design partnership", "Help shape Sovereign Rheumatology around real specialty workflows."],
  [
    "Product / practice inquiry",
    "Discuss your practice, advanced-therapy access, and clinical operations.",
  ],
  [
    "Strategic partnership",
    "Explore aligned healthcare, integration, or commercial relationships.",
  ],
  [
    "Investor inquiry",
    "Discuss the specialty clinical intelligence and execution platform thesis.",
  ],
];

export default function ContactPage() {
  return (
    <>
      <section className="page-hero" style={{ minHeight: 0 }}>
        <div className="container split-story">
          <div className="split-story__copy">
            <span className="eyebrow">Contact Sovereign</span>
            <h1 style={{ fontSize: "clamp(3.2rem, 7vw, 5.5rem)" }}>
              Start the right conversation.
            </h1>
            <p>
              Tell us why you are reaching out. We will route every business inquiry through one
              provider-neutral contact path while the platform is in early access.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg" href="/early-access">
                Request Early Access
              </Link>
              <a className="text-link" href="mailto:contact@sovereignhealth.ai">
                contact@sovereignhealth.ai <span>↗</span>
              </a>
            </div>
          </div>
          <div className="inquiry-grid">
            {reasons.map(([title, body], index) => (
              <article className="inquiry-card" key={title}>
                <span>0{index + 1}</span>
                <h2>{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="story-section story-section--dark">
        <div className="container container-narrow">
          <div className="phi-warning-banner" role="alert">
            <span className="phi-warning-icon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Do not send patient information.</strong> This public contact path is for
              business inquiries only. Please do not submit patient information, clinical documents,
              or protected health information.
            </div>
          </div>
          <p style={{ textAlign: "center" }}>
            Sovereign Health AI LLC · Security and architecture:{" "}
            <a href="mailto:security@sovereignhealth.ai">security@sovereignhealth.ai</a>
          </p>
        </div>
      </section>
    </>
  );
}
