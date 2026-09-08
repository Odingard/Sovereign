/**
 * @file Sovereign Platform Section Component
 * @description Outlines the core 4-stage Sovereign operational loop:
 * Understand, Verify, Execute, Monitor.
 */

export function PlatformSection() {
  const steps = [
    {
      num: "01",
      title: "Understand the patient",
      subtitle: "Longitudinal Clinical Picture",
      desc: "Synthesizes multi-year therapy exposure, disease activity markers, laboratory trends, and failure rationales into an authoritative, specialty-specific state.",
    },
    {
      num: "02",
      title: "Verify what matters",
      subtitle: "Evidence & Provenance Linkage",
      desc: "Every clinical finding and historical DMARD trial remains bound to verifiable source evidence. No hallucinations, no unanchored assumptions, no silent overwrites.",
    },
    {
      num: "03",
      title: "Execute the workflow",
      subtitle: "Deterministic Orchestration",
      desc: "Translates clinician decisions into a coordinated execution graph spanning prior authorization packages, pharmacy logistics, and infusion scheduling.",
    },
    {
      num: "04",
      title: "Monitor to completion",
      subtitle: "Closed-Loop Tracking",
      desc: "Actively tracks real-world progression across external entities, distinguishing attempted, transmitted, accepted, and clinically completed care delivery.",
    },
  ];

  return (
    <section className="section" id="platform" aria-labelledby="platform-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">The Sovereign Architecture</span>
          <h2 id="platform-heading" className="section-title">
            Understand. Verify. Execute. Monitor.
          </h2>
          <p className="section-desc">
            Sovereign does not treat healthcare as a one-shot conversational prompt. We provide a
            deterministic, evidence-grounded execution platform designed to see complex clinical
            intentions through to verifiable completion.
          </p>
        </div>

        <div className="platform-loop-grid">
          {steps.map((step) => (
            <div key={step.num} className="platform-loop-card">
              <span className="loop-step-badge">STAGE {step.num}</span>
              <h3 className="loop-step-title">{step.title}</h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  color: "var(--teal-hover)",
                  marginBottom: "0.75rem",
                }}
              >
                {step.subtitle}
              </p>
              <p className="loop-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
