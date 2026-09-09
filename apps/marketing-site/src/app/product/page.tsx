import { ChapterCta, PageHero } from "@/components/story/PageHero";
import { CommandCenter } from "@/components/visuals/CommandCenter";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Sovereign Product | Clinical Intelligence & Execution",
  description:
    "See how Sovereign connects longitudinal Clinical State, evidence, Clinical Intent, governed execution, and monitoring to completion.",
  path: "/product",
});

const operatingModel = [
  [
    "Longitudinal Clinical State",
    "A durable patient model that survives individual documents, encounters, and model sessions.",
  ],
  [
    "Evidence & provenance",
    "Important assertions remain connected to where they came from and what remains unknown.",
  ],
  [
    "Clinical Intent",
    "The clinician’s decided direction is represented distinctly from discussion, authorization, and receipt.",
  ],
  ["Verification", "Prerequisites and evidence are checked before downstream work can progress."],
  [
    "Execution Graph",
    "Authorized work becomes a durable pathway with explicit states, owners, and dependencies.",
  ],
  [
    "Monitoring to completion",
    "Attempted, transmitted, received, accepted, and completed remain different states.",
  ],
];

export default function ProductPage() {
  return (
    <>
      <PageHero
        eyebrow="Sovereign product"
        title="One operating environment from clinical understanding to care execution."
        body="The product centers a verified longitudinal picture of the patient, preserves the clinician’s intent, and coordinates the work required to move that decision forward."
        primary={{ href: "/platform", label: "Explore the Platform" }}
        secondary={{ href: "/early-access", label: "Request Early Access" }}
        visual={<CommandCenter compact />}
        mode="execution"
      />
      <section className="story-section">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">A connected operating model</span>
            <h2>Six relationships—not six disconnected features.</h2>
            <p>
              Sovereign is not an ambient scribe and not a chatbot. The product is being built
              around persistent clinical and execution objects that remain controlled outside any
              model session.
            </p>
          </div>
          <div className="thesis-grid">
            {operatingModel.map(([title, body], index) => (
              <article className="thesis-card" key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="story-section story-section--dark">
        <div className="container doctrine-display">
          <span className="eyebrow">State discipline</span>
          <blockquote>
            Discussion is not decision.
            <br />
            Decision is not execution.
            <br />
            Execution is not completion.
          </blockquote>
          <p>Each transition remains explicit, governed, and auditable.</p>
        </div>
      </section>
      <section className="story-section story-section--mist">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">The Command Center</span>
            <h2>See what is known, what is intended, and what must happen next.</h2>
            <p>
              Role-aware views organize Clinical State, source evidence, therapy history, current
              intent, access work, monitoring, and recent activity without inventing patient facts
              or completion.
            </p>
          </div>
          <CommandCenter />
        </div>
      </section>
      <ChapterCta
        eyebrow="Next chapter · Platform"
        title="See the controlled architecture beneath the product."
        body="The reusable platform separates patient state, evidence, authority, execution, and integration."
        href="/platform"
        label="Explore the Platform"
      />
    </>
  );
}
