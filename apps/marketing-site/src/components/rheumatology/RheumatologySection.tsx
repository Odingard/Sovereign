import Link from "next/link";

export function RheumatologySection() {
  const history = [
    ["2019–2021", "Conventional therapy", "Evidence reconciled"],
    ["2022", "Biologic transition", "Response documented"],
    ["2024", "Treatment interruption", "Reason preserved"],
    ["Current", "Clinical State", "Intent distinct from receipt"],
  ];
  return (
    <section className="story-section story-section--mist" id="rheumatology">
      <div className="container split-story split-story--reverse">
        <div className="split-story__copy">
          <span className="eyebrow">The first specialty</span>
          <h2>Built first for rheumatology.</h2>
          <p>
            Complex longitudinal disease and therapy histories become a usable clinical
            picture—without collapsing what was considered, decided, authorized, and received into
            one ambiguous status.
          </p>
          <div className="story-points">
            <div className="story-point">
              <span>01</span>
              <div>
                <strong>Model the patient, not the document.</strong>
                <p>Connect history across encounters while preserving evidence and uncertainty.</p>
              </div>
            </div>
            <div className="story-point">
              <span>02</span>
              <div>
                <strong>Keep Clinical Intent distinct.</strong>
                <p>Considered does not mean decided. Decided does not mean treatment received.</p>
              </div>
            </div>
          </div>
          <Link className="text-link" href="/rheumatology">
            Explore Sovereign Rheumatology <span>→</span>
          </Link>
        </div>
        <div className="split-story__visual history-visual">
          <div className="history-visual__top">
            <span>Longitudinal therapy history</span>
            <span>Synthetic data</span>
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
  );
}
