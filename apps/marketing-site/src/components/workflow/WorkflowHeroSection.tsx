import { WorkflowPath } from "@/components/story/WorkflowPath";

export function WorkflowHeroSection() {
  return (
    <section className="story-section story-section--dark" id="workflow">
      <div className="container">
        <div className="story-section__header">
          <span className="eyebrow">Advanced therapy access & continuity</span>
          <h2>Turn a therapy decision into a completed care pathway.</h2>
          <p>
            Sovereign Rheumatology is being designed to preserve clinician intent, coordinate
            prerequisites and documentation, and monitor the path through authorization, pharmacy or
            infusion, treatment initiation, and continuity.
          </p>
        </div>
        <WorkflowPath
          dark
          steps={[
            "Clinical Decision",
            "Prerequisites",
            "Evidence",
            "Documentation",
            "Authorization / Payer Follow-Up",
            "Pharmacy / Infusion",
            "Treatment Initiation",
            "Care Continuity",
          ]}
        />
      </div>
    </section>
  );
}
