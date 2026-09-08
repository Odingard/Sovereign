import { ChapterCta, PageHero } from "@/components/story/PageHero";
import { ClinicalIntelligenceCore } from "@/components/visuals/ClinicalIntelligenceCore";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Sovereign Security | Controlled Clinical Intelligence",
  description:
    "Sovereign is being architected to keep clinical intent, authority, evidence, execution, identity, and completion explicit and controlled.",
  path: "/security",
});

const controls = [
  [
    "Human clinical authority",
    "Clinical judgment remains with licensed human clinicians. A model may assist; it does not become the clinician.",
  ],
  [
    "Tenant isolation",
    "Trusted server-resolved tenancy and deny-by-default access are being designed to prevent cross-organization authority paths.",
  ],
  [
    "Evidence & provenance",
    "Important assertions retain source-forward connections, reconciliation status, and explicit uncertainty.",
  ],
  [
    "Auditable decisions",
    "Intent, authority, policy checks, execution attempts, confirmations, and completion evidence remain distinguishable.",
  ],
  [
    "Controlled execution",
    "AI candidates must pass validation, evidence, policy, authority, and authorized domain-service boundaries.",
  ],
  [
    "Fail-closed architecture",
    "Ambiguous identity, patient scope, authority, evidence, policy, or state blocks progression rather than being guessed.",
  ],
  [
    "Model/provider independence",
    "Authoritative state survives model, provider, prompt, and session changes.",
  ],
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security & authority"
        title="Clinical intelligence requires controlled authority."
        body="Sovereign is being architected so identity, evidence, clinical intent, authority, execution, and completion remain distinct."
        primary={{ href: "/contact?reason=security", label: "Discuss Security & Architecture" }}
        secondary={{ href: "/about", label: "Read Our Thesis" }}
        visual={<ClinicalIntelligenceCore mode="security" />}
        mode="authority"
      />
      <section className="story-section story-section--dark">
        <div className="container doctrine-display">
          <span className="eyebrow">Permanent discipline</span>
          <blockquote>
            Intent is not authority.
            <br />
            Authority is not evidence.
            <br />
            Evidence is not execution.
            <br />
            Execution is not completion.
          </blockquote>
        </div>
      </section>
      <section className="story-section">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">Designed for trust</span>
            <h2>Control boundaries that keep the system honest.</h2>
            <p>
              This is the current architectural direction—not a claim of certifications or
              production approvals not yet earned.
            </p>
          </div>
          <div className="thesis-grid">
            {controls.map(([title, body], index) => (
              <article className="thesis-card" key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <ChapterCta
        eyebrow="Next chapter · Company"
        title="Specialty medicine should not stop at the clinical decision."
        body="Read the company thesis behind completed-care infrastructure."
        href="/about"
        label="About Sovereign"
      />
    </>
  );
}
