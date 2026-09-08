/**
 * @file Human Clinical Authority Section Component
 * @description Codifies the core Sovereign doctrine:
 * Sovereign will never be the doctor. The clinician decides; Sovereign makes it executable.
 */

export function ClinicalAuthoritySection() {
  return (
    <section className="section" id="authority" aria-labelledby="authority-heading">
      <div className="container">
        <div className="authority-callout">
          <span className="badge badge-teal" style={{ marginBottom: "1.5rem" }}>
            Governing Clinical Doctrine
          </span>
          <h2
            id="authority-heading"
            style={{
              fontSize: "1.5rem",
              color: "var(--text-muted)",
              fontWeight: "600",
              marginBottom: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Built to support clinical judgment—not replace it.
          </h2>
          <div className="authority-quote">
            “The clinician decides. Sovereign makes the decision executable.”
          </div>
          <p className="authority-body">
            Sovereign will never be the doctor. We do not generate autonomous diagnoses, suggest
            off-protocol treatments, or pretend an algorithm can replace decades of clinical
            training. Our software is designed to relieve physician-led practices of the immense
            operational drag of specialty care by verifying evidence, orchestrating authorizations,
            and tracking execution—strictly under the direction of the responsible clinician.
          </p>
          <div
            style={{
              marginTop: "2rem",
              display: "flex",
              justifyContent: "center",
              gap: "2rem",
              flexWrap: "wrap",
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              fontWeight: "600",
            }}
          >
            <span>&bull; Zero Autonomous Prescribing</span>
            <span>&bull; Reversible Execution Graphs</span>
            <span>&bull; Complete Audit Provenance</span>
          </div>
        </div>
      </div>
    </section>
  );
}
