/**
 * @file Product Pillars Section Component
 * @description Introduces the five core architectural concepts of the Sovereign platform.
 */

export function ProductPillarsSection() {
  const pillars = [
    {
      name: "Sovereign State",
      tagline: "Longitudinal Clinical State",
      desc: "Maintains persistent, structured clinical history that survives across disconnected encounters, visits, and EHR migrations.",
    },
    {
      name: "Sovereign Verify",
      tagline: "Evidence & Provenance",
      desc: "Anchors every asserted disease finding, past medication trial, and lab observation to immutable source documentation.",
    },
    {
      name: "Sovereign Execute",
      tagline: "Workflow Orchestration",
      desc: "Transforms clinical orders into multi-stakeholder execution graphs spanning prior auth, pharmacies, and infusion suites.",
    },
    {
      name: "Sovereign Control",
      tagline: "Governance & Authority",
      desc: "Enforces fine-grained clinician authority grants, tenant boundary isolation, and comprehensive tamper-evident audit logs.",
    },
    {
      name: "Sovereign Connect",
      tagline: "Healthcare Integration",
      desc: "Interoperates cleanly across existing EHR vendors, pharmacy portals, payer clearinghouses, and diagnostic laboratories.",
    },
  ];

  return (
    <section className="section section-subtle" id="pillars" aria-labelledby="pillars-heading">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Core Capabilities</span>
          <h2 id="pillars-heading" className="section-title">
            The Five Sovereign Pillars
          </h2>
          <p className="section-desc">
            Five unified modules working together to bridge the gap between clinical intent and
            real-world care delivery.
          </p>
        </div>

        <div className="pillars-grid">
          {pillars.map((p) => (
            <div key={p.name} className="pillar-card">
              <h3 className="pillar-name">{p.name}</h3>
              <div className="pillar-tagline">{p.tagline}</div>
              <p className="pillar-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
