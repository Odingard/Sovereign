const activity = [
  ["Evidence", "Therapy history reconciled", "Verified"],
  ["Intent", "Advanced therapy selected", "Clinician decided"],
  ["Access", "Authorization prerequisites", "In progress"],
  ["Monitoring", "Treatment initiation", "Awaiting confirmation"],
];

export function CommandCenter({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`command-center ${compact ? "command-center--compact" : ""}`}
      aria-label="Illustrative Sovereign Command Center product view"
    >
      <div className="product-truth-label">
        <span>Illustrative product view</span>
        <span>Synthetic data</span>
      </div>
      <div className="command-shell">
        <aside className="command-rail" aria-hidden="true">
          <div className="rail-mark">S</div>
          {[0, 1, 2, 3, 4].map((item) => (
            <i key={item} />
          ))}
        </aside>
        <div className="command-main">
          <header className="command-header">
            <div>
              <small>Clinical workspace</small>
              <strong>Longitudinal patient state</strong>
            </div>
            <span className="status-pill">Connected</span>
          </header>
          <div className="command-grid">
            <section className="command-profile">
              <span className="panel-kicker">Clinical State</span>
              <h3>Rheumatoid Arthritis</h3>
              <div className="state-row">
                <span>Evidence coverage</span>
                <strong>Reconciled</strong>
              </div>
              <div className="state-row">
                <span>Therapy history</span>
                <strong>Longitudinal</strong>
              </div>
              <div className="state-row">
                <span>Clinical intent</span>
                <strong>Recorded</strong>
              </div>
            </section>
            <section className="command-path">
              <span className="panel-kicker">Execution pathway</span>
              <div className="path-progress">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="path-labels">
                <span>Decision</span>
                <span>Verify</span>
                <span>Access</span>
                <span>Initiate</span>
              </div>
            </section>
            <section className="command-activity">
              <span className="panel-kicker">Recent activity</span>
              {activity.map(([kind, title, status]) => (
                <div className="activity-row" key={title}>
                  <i />
                  <div>
                    <small>{kind}</small>
                    <strong>{title}</strong>
                  </div>
                  <span>{status}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
