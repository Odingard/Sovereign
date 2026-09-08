const steps = [
  "Clinical decision",
  "Documentation",
  "Prerequisites",
  "Prior authorization",
  "Payer follow-up",
  "Pharmacy / infusion",
  "Treatment initiation",
  "Continuity",
];

export function ProblemSection() {
  return (
    <section className="story-section story-section--mist" id="problem">
      <div className="container">
        <div className="story-section__header">
          <span className="eyebrow">The execution gap</span>
          <h2>A decision is only the beginning.</h2>
          <p>
            A clinician can make the right decision and still watch care stall across disconnected
            documents, prerequisites, payers, pharmacies, infusion sites, and follow-up. Today, the
            work fragments. Sovereign is being built to keep it connected.
          </p>
        </div>
        <div className="problem-chain">
          {steps.map((step, index) => (
            <div className="problem-chain__item" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
