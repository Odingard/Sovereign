const loop = [
  ["Understand", "Understand the patient", "Know the longitudinal patient, not only today’s note."],
  ["Verify", "Verify what matters", "Keep important assertions connected to supporting evidence."],
  [
    "Execute",
    "Execute the workflow",
    "Turn authorized clinical decisions into coordinated downstream work.",
  ],
  [
    "Monitor",
    "Monitor to completion",
    "Track whether intended care progresses to confirmed completion.",
  ],
];

export function PlatformSection() {
  return (
    <section className="story-section" id="platform">
      <div className="container">
        <div className="story-section__header story-section__header--center">
          <span className="eyebrow">The Sovereign loop</span>
          <h2>Understand. Verify. Execute. Monitor.</h2>
          <p>
            One continuous operating model connects what is known, what the clinician intends, what
            is authorized, and what actually happens.
          </p>
        </div>
        <div className="loop-grid">
          {loop.map(([verb, title, body], index) => (
            <article className="loop-card" key={verb}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
