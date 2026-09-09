const modules = [
  ["Sovereign State", "Longitudinal clinical state."],
  ["Sovereign Verify", "Evidence and provenance."],
  ["Sovereign Execute", "Coordinated workflow execution."],
  ["Sovereign Control", "Identity, policy and authority."],
  ["Sovereign Connect", "Healthcare-system integration."],
];

export function ProductPillarsSection() {
  return (
    <section className="story-section">
      <div className="container">
        <div className="story-section__header">
          <span className="eyebrow">One platform system</span>
          <h2>Five capabilities. One controlled path.</h2>
          <p>
            Reusable platform infrastructure supports specialty-specific clinical intelligence
            without creating a second authority path.
          </p>
        </div>
        <div className="module-grid">
          {modules.map(([name, body], index) => (
            <article className="module-card" key={name}>
              <span>0{index + 1}</span>
              <h3>{name}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
