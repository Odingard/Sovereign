import { EarlyAccessForm } from "@/components/forms/EarlyAccessForm";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Sovereign Rheumatology Early Access | Help Shape the Product",
  description:
    "Independent and physician-led rheumatology groups can request early access and help shape Sovereign Rheumatology.",
  path: "/early-access",
});

export default function EarlyAccessPage({ searchParams }: { searchParams?: { program?: string } }) {
  return (
    <>
      <section
        className="page-hero page-hero--intelligence"
        style={{ minHeight: "0", paddingBottom: "3rem" }}
      >
        <div className="container container-narrow" style={{ textAlign: "center" }}>
          <span className="eyebrow">Rheumatology early access</span>
          <h1 style={{ fontSize: "clamp(3rem, 7vw, 5rem)" }}>Help shape Sovereign Rheumatology.</h1>
          <p style={{ marginInline: "auto" }}>
            We want to learn from independent and physician-led rheumatology groups managing
            advanced therapies, complex access workflows, and treatment continuity.
          </p>
        </div>
      </section>
      <section className="story-section story-section--mist" style={{ paddingTop: "2rem" }}>
        <div className="container container-narrow">
          <div className="phi-warning-banner" role="alert">
            <span className="phi-warning-icon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Business information only.</strong> Please do not submit patient information
              or protected health information. No uploads are accepted.
            </div>
          </div>
          <EarlyAccessForm initialProgram={searchParams?.program} />
          <div className="story-points" style={{ marginTop: "3rem" }}>
            <div className="story-point">
              <span>01</span>
              <div>
                <strong>Who we want to hear from</strong>
                <p>
                  Rheumatologists, physician owners, practice leaders, access teams, and clinical
                  operations leaders.
                </p>
              </div>
            </div>
            <div className="story-point">
              <span>02</span>
              <div>
                <strong>What participation means</strong>
                <p>
                  Workflow discovery, product feedback, and a structured evaluation conversation.
                  Commercial or pilot access requires a separate agreement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
