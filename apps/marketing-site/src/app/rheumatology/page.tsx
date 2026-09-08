import { ChapterCta, PageHero } from "@/components/story/PageHero";
import { WorkflowPath } from "@/components/story/WorkflowPath";
import { ClinicalIntelligenceCore } from "@/components/visuals/ClinicalIntelligenceCore";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Sovereign Rheumatology | From Decision to Completed Care",
  description:
    "Sovereign Rheumatology is being built to connect complex longitudinal disease, therapy history, evidence, clinical intent, and advanced-therapy access workflows.",
  path: "/rheumatology",
});

const history = [
  [
    "Years prior",
    "Conventional therapies",
    "Trials, holds, responses, and reasons remain distinct",
  ],
  ["Prior line", "Advanced therapy", "Evidence and response connected"],
  [
    "Current state",
    "Disease and treatment context",
    "Known, unknown, and conflicting facts remain visible",
  ],
  ["Clinician decision", "Clinical Intent", "Decided direction represented distinctly"],
  ["Next", "Access & continuity", "Authorized work monitored to confirmation"],
];

export default function RheumatologyPage() {
  return (
    <>
      <PageHero
        eyebrow="Sovereign Rheumatology"
        title="Built first for rheumatology."
        body="Complex longitudinal disease. Complex therapy history. Complex access workflows. One connected clinical picture."
        primary={{
          href: "/early-access?program=rheumatology",
          label: "Join Rheumatology Early Access",
        }}
        secondary={{ href: "/product", label: "Explore the Product" }}
        visual={<ClinicalIntelligenceCore mode="rheumatology" />}
      />
      <section className="story-section">
        <div className="container split-story">
          <div className="split-story__copy">
            <span className="eyebrow">Story 01 · Longitudinal understanding</span>
            <h2>Model the patient, not the document.</h2>
            <p>
              Rheumatology unfolds across years of visits, therapies, symptoms, monitoring, outside
              records, and interruptions. Sovereign is being built to create a usable longitudinal
              picture while retaining evidence and uncertainty.
            </p>
          </div>
          <div className="history-visual">
            <div className="history-visual__top">
              <span>Treatment history</span>
              <span>Illustrative · synthetic data</span>
            </div>
            <div className="history-line">
              {history.map(([date, title, state]) => (
                <div className="history-item" key={date}>
                  <small>{date}</small>
                  <strong>{title}</strong>
                  <span>{state}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="story-section story-section--mist">
        <div className="container split-story split-story--reverse">
          <div className="split-story__copy">
            <span className="eyebrow">Story 02 · The clinical decision</span>
            <h2>Clinical Intent is not a status shortcut.</h2>
            <p>
              What was discussed, what was considered, what the clinician decided, what was
              authorized, and what the patient ultimately received must not collapse into a single
              field.
            </p>
            <div className="story-points">
              <div className="story-point">
                <span>01</span>
                <div>
                  <strong>considered != decided</strong>
                  <p>Possibilities remain distinct from an explicit clinical decision.</p>
                </div>
              </div>
              <div className="story-point">
                <span>02</span>
                <div>
                  <strong>decided != treatment received</strong>
                  <p>
                    Clinical Intent remains distinct from access progress and confirmed
                    administration.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <ClinicalIntelligenceCore mode="rheumatology" />
        </div>
      </section>
      <section className="story-section story-section--dark">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">Story 03 · Advanced therapy access & continuity</span>
            <h2>Turn a therapy decision into a completed care pathway.</h2>
            <p>
              Sovereign Rheumatology is being designed to coordinate the work between a clinical
              decision and confirmed treatment initiation—while preserving human authority at every
              required point.
            </p>
          </div>
          <WorkflowPath dark />
        </div>
      </section>
      <ChapterCta
        eyebrow="Rheumatology early access"
        title="Help shape Sovereign Rheumatology."
        body="We are seeking independent and physician-led rheumatology groups managing advanced therapies and complex access workflows."
        href="/early-access?program=rheumatology"
        label="Join Early Access"
      />
    </>
  );
}
