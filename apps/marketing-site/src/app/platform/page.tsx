import { ChapterCta, PageHero } from "@/components/story/PageHero";
import { ClinicalIntelligenceCore } from "@/components/visuals/ClinicalIntelligenceCore";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Sovereign Platform | Specialty Clinical Intelligence & Execution",
  description:
    "The reusable Sovereign platform connects patient state, provenance, governed workflow execution, authority, and healthcare integrations.",
  path: "/platform",
});

const modules = [
  [
    "Sovereign State",
    "Patient model",
    "A longitudinal, specialty-aware representation that remains independent of any document or model session.",
  ],
  [
    "Sovereign Verify",
    "Provenance & reconciliation",
    "Evidence connections, source-forward traceability, contradiction handling, and explicit unknowns.",
  ],
  [
    "Sovereign Execute",
    "Durable workflow",
    "Authorized intent becomes a stateful execution pathway with confirmation and monitoring.",
  ],
  [
    "Sovereign Control",
    "Policy, identity & authority",
    "Identity, role, authority, patient scope, purpose, and policy stay distinct and fail closed.",
  ],
  [
    "Sovereign Connect",
    "Integration fabric",
    "Provider-neutral boundaries connect external systems without making them the source of Sovereign authority.",
  ],
];

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="The Sovereign platform"
        title="A clinical intelligence and execution layer for specialty care."
        body="Rheumatology is the first specialty implementation. Beneath it, five reusable capabilities connect longitudinal understanding with controlled care execution."
        visual={<ClinicalIntelligenceCore mode="platform" />}
        primary={{ href: "/security", label: "Explore Security" }}
        secondary={{ href: "/rheumatology", label: "See Rheumatology" }}
      />
      <section className="story-section">
        <div className="container">
          <div className="module-grid">
            {modules.map(([name, short, body], index) => (
              <article className="module-card" key={name}>
                <span>
                  0{index + 1} · {short}
                </span>
                <h3>{name}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="story-section story-section--mist">
        <div className="container split-story">
          <div className="split-story__copy">
            <span className="eyebrow">Systems relationship</span>
            <h2>Connected to healthcare systems. Governed by Sovereign.</h2>
            <p>
              External systems exchange data through Sovereign Connect. State, Verify, Control, and
              Execute remain the controlled layer that preserves truth, authority, and workflow
              status.
            </p>
            <p>
              <strong>
                The model is a reasoning component inside a controlled system—not the system of
                record.
              </strong>
            </p>
          </div>
          <div className="architecture-map">
            <div className="architecture-systems">
              <span>EHR</span>
              <span>Payer</span>
              <span>Pharmacy / infusion</span>
              <span>Labs & external systems</span>
            </div>
            <div className="architecture-arrow">↔</div>
            <div className="architecture-connect">Sovereign Connect</div>
            <div className="architecture-arrow">↔</div>
            <div className="architecture-core">
              <strong>State</strong>
              <strong>Verify</strong>
              <strong>Control</strong>
              <strong>Execute</strong>
            </div>
          </div>
        </div>
      </section>
      <section className="story-section story-section--dark">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">Wedge to platform</span>
            <h2>Built first for rheumatology. Designed as a specialty platform.</h2>
            <p>
              The architecture separates reusable infrastructure from specialty-specific clinical
              intelligence. It does not claim that other specialty products are commercially
              available today.
            </p>
          </div>
        </div>
      </section>
      <ChapterCta
        eyebrow="Next chapter · Trust"
        title="Controlled clinical intelligence requires controlled authority."
        body="See the high-level security, governance, evidence, and human-authority design principles."
        href="/security"
        label="Explore Security"
      />
    </>
  );
}
