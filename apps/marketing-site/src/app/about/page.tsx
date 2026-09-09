import { ChapterCta, PageHero } from "@/components/story/PageHero";
import { WorkflowPath } from "@/components/story/WorkflowPath";
import { ClinicalIntelligenceCore } from "@/components/visuals/ClinicalIntelligenceCore";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "About Sovereign | Building the Execution Layer for Specialty Care",
  description:
    "Sovereign Health AI LLC is building completed-care infrastructure for the gap between a specialty clinician’s decision and care execution.",
  path: "/about",
});

const thesis = [
  ["Clinical intelligence", "Build a longitudinal understanding from fragmented evidence."],
  ["Human authority", "Preserve the clinician’s decision and the boundaries around who may act."],
  ["Execution", "Coordinate downstream work through explicit, durable states."],
  ["Verification", "Confirm whether intended care actually reaches completion."],
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Sovereign Health AI LLC"
        title="Specialty medicine should not stop at the clinical decision."
        body="Healthcare has invested heavily in systems that document, record, and communicate. Significant work still remains between a clinician’s decision and completed care. Sovereign exists to address that gap."
        primary={{ href: "/contact", label: "Talk With Sovereign" }}
        secondary={{ href: "/rheumatology", label: "Why Rheumatology First" }}
        visual={<ClinicalIntelligenceCore mode="home" />}
      />
      <section className="story-section story-section--mist">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">The company thesis</span>
            <h2>Clinical decision ≠ completed care.</h2>
            <p>
              The problem is not simply missing information. It is the discontinuity between
              understanding, human judgment, authorized action, and verified completion.
            </p>
          </div>
          <WorkflowPath
            steps={[
              "Clinical context",
              "Evidence",
              "Clinical decision",
              "Human authority",
              "Execution",
              "External response",
              "Confirmation",
              "Completed care",
            ]}
          />
        </div>
      </section>
      <section className="story-section">
        <div className="container">
          <div className="thesis-grid">
            {thesis.map(([title, body], index) => (
              <article className="thesis-card" key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className="story-section__header" style={{ marginTop: "5rem" }}>
            <span className="eyebrow">Where we begin</span>
            <h2>Built first for rheumatology. Designed for specialty care.</h2>
            <p>
              Rheumatology combines longitudinal complexity, high-cost advanced therapies, extensive
              evidence requirements, and operational work that continues long after the clinical
              visit. It is the right place to build the first complete specialty implementation.
            </p>
          </div>
        </div>
      </section>
      <section className="story-section story-section--dark">
        <div className="container doctrine-display">
          <span className="eyebrow">Permanent founder doctrine</span>
          <blockquote>Sovereign will never be the doctor.</blockquote>
          <p>The clinician decides. Sovereign makes the decision executable.</p>
        </div>
      </section>
      <ChapterCta
        eyebrow="Help shape the platform"
        title="Build the completed-care infrastructure with us."
        body="Join the rheumatology early-access program or begin a strategic conversation with Sovereign."
        href="/early-access"
        label="Request Early Access"
      />
    </>
  );
}
