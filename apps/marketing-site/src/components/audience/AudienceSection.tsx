const audiences = [
  "Rheumatologists",
  "Nurses & Medical Assistants",
  "Prior Auth & Access Teams",
  "Practice Administrators",
  "Physician Owners",
];

export function AudienceSection() {
  return (
    <section className="story-section story-section--mist" id="audience">
      <div className="container">
        <div className="story-section__header">
          <span className="eyebrow">Designed with practices</span>
          <h2>One shared picture across the care team.</h2>
          <p>
            Sovereign is being built for the people responsible for moving a complex specialty-care
            decision through every downstream step.
          </p>
        </div>
        <div className="thesis-grid">
          {audiences.map((name, index) => (
            <article className="thesis-card" key={name}>
              <span>0{index + 1}</span>
              <h3>{name}</h3>
              <p>
                Role-aware visibility into the same connected Clinical State, authorized work, and
                verified progress.
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
