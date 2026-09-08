/**
 * @file Audience Section Component
 * @description Outlines specific practice personas and how Sovereign resolves their operational friction.
 */

export function AudienceSection() {
  const personas = [
    {
      role: "Rheumatologists",
      benefit:
        "Spend clinic hours evaluating patients and choosing therapy without wondering if your orders will disappear into an administrative black hole.",
    },
    {
      role: "Nurses & Medical Assistants",
      benefit:
        "Eliminate repetitive chart scavenger hunts for prior DMARD trial dates, doses, and toxicity notes before submitting authorization packages.",
    },
    {
      role: "Prior Auth & Access Teams",
      benefit:
        "Generate policy-compliant clinical dossiers with verified evidence linkage, dramatically accelerating approval timelines and appeal packages.",
    },
    {
      role: "Practice Administrators",
      benefit:
        "Gain complete transparency into care execution pipelines, unblocking patient therapies before delays cause clinical flare-ups or patient drop-off.",
    },
    {
      role: "Physician Owners",
      benefit:
        "Protect the independence and financial viability of your practice by optimizing infusion suite throughput and in-house specialty dispensing.",
    },
    {
      role: "Multi-Location Specialty Groups",
      benefit:
        "Standardize complex clinical execution workflows across satellite clinics with strict multi-tenant governance and audit traceability.",
    },
  ];

  return (
    <section className="section" id="audience" aria-labelledby="audience-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Designed for Your Team</span>
          <h2 id="audience-heading" className="section-title">
            Built for specialty practices where complexity lives between the visit and the
            treatment.
          </h2>
          <p className="section-desc">
            Sovereign is built specifically for the multi-disciplinary teams running independent,
            physician-led specialty practices.
          </p>
        </div>

        <div className="grid-3">
          {personas.map((item) => (
            <div key={item.role} className="audience-card card">
              <h3 className="audience-role">{item.role}</h3>
              <p className="audience-benefit">{item.benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
