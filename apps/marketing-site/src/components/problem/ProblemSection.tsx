/**
 * @file Problem Section Component
 * @description Explains the structural gap between a clinical decision and completed care,
 * illustrating the 9 fragmented administrative touchpoints.
 */

export function ProblemSection() {
  const touchpoints = [
    {
      title: "Documentation",
      desc: "Extracting historical trials, dates, and failure reasons from unstructured notes.",
    },
    {
      title: "Clinical Orders",
      desc: "Translating physician therapeutic choice into pharmacy and infusion directives.",
    },
    {
      title: "Prerequisite Labs",
      desc: "Verifying TB, hepatitis, liver enzymes, and CBC before biologic initiation.",
    },
    {
      title: "Prior Authorization",
      desc: "Navigating complex payer criteria, step-therapy rules, and criteria forms.",
    },
    {
      title: "Payer Follow-Up",
      desc: "Checking status, tracking appeal windows, and resolving arbitrary denials.",
    },
    {
      title: "Specialty Pharmacy",
      desc: "Coordinating drug supply, copay cards, bridge programs, and delivery.",
    },
    {
      title: "Infusion Suite",
      desc: "Scheduling chair time, pre-medications, and nurse administration protocols.",
    },
    {
      title: "Patient Coordination",
      desc: "Communicating schedules, injection training, and medication access steps.",
    },
    {
      title: "Safety Monitoring",
      desc: "Tracking ongoing lab freshness, adverse events, and disease response.",
    },
  ];

  return (
    <section className="section section-subtle" id="problem" aria-labelledby="problem-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">The Structural Reality</span>
          <h2 id="problem-heading" className="section-title">
            A clinical decision is not the same as completed care.
          </h2>
          <p className="section-desc">
            In complex medical specialties, establishing the right therapeutic plan is only the
            first step. Between the physician’s decision and the patient’s completed therapy lies a
            fragmented operational burden scattered across disparate systems, phone calls, portals,
            and paperwork.
          </p>
        </div>

        {/* Visual Breakage Pathway */}
        <div className="problem-flow-banner" aria-label="Current Healthcare Fragmentation">
          <div className="flow-step-item">
            <span style={{ color: "var(--teal-primary)" }}>&bull;</span>
            <span>Clinical Decision</span>
          </div>
          <span className="flow-step-arrow" aria-hidden="true">
            &rarr;
          </span>
          <div className="flow-step-item">
            <span style={{ color: "#d97706" }}>&bull;</span>
            <span>Fragmented Work</span>
          </div>
          <span className="flow-step-arrow" aria-hidden="true">
            &rarr;
          </span>
          <div className="flow-step-item">
            <span style={{ color: "#dc2626" }}>&bull;</span>
            <span>Administrative Delays</span>
          </div>
          <span className="flow-step-arrow" aria-hidden="true">
            &rarr;
          </span>
          <div className="flow-step-item">
            <span style={{ color: "#991b1b" }}>&bull;</span>
            <span>Incomplete Care</span>
          </div>
        </div>

        {/* 9 Touchpoints Grid */}
        <div style={{ marginTop: "3.5rem" }}>
          <div className="grid-3">
            {touchpoints.map((tp, idx) => (
              <div key={tp.title} className="problem-card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      fontWeight: "700",
                      color: "var(--text-muted)",
                    }}
                  >
                    TOUCHPOINT 0{idx + 1}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: "1.15rem",
                    color: "var(--navy-primary)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {tp.title}
                </h3>
                <p
                  style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.55" }}
                >
                  {tp.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
