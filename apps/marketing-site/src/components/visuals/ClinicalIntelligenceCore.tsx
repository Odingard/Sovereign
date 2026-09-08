type CoreMode = "home" | "rheumatology" | "platform" | "security";

const MODE_CONTENT: Record<CoreMode, { label: string; subject: string; nodes: string[] }> = {
  home: {
    label: "Patient Clinical State",
    subject: "Rheumatoid Arthritis",
    nodes: [
      "Disease Activity",
      "Evidence",
      "Therapy History",
      "Clinical Intent",
      "Monitoring",
      "Access Pathway",
    ],
  },
  rheumatology: {
    label: "Longitudinal Clinical State",
    subject: "RA · Illustrative",
    nodes: [
      "Disease Activity",
      "Therapy History",
      "Evidence",
      "Current Treatment",
      "Monitoring",
      "Clinical Intent",
      "Access",
    ],
  },
  platform: {
    label: "Sovereign Platform",
    subject: "Clinical Intelligence Core",
    nodes: ["State", "Verify", "Execute", "Control", "Connect"],
  },
  security: {
    label: "Controlled Clinical State",
    subject: "Human Authority",
    nodes: ["Identity", "Evidence", "Clinical Intent", "Policy", "Execution", "Audit"],
  },
};

export function ClinicalIntelligenceCore({ mode = "home" }: { mode?: CoreMode }) {
  const content = MODE_CONTENT[mode];

  return (
    <div
      className={`clinical-core clinical-core--${mode}`}
      aria-label={`${content.subject} clinical intelligence visualization`}
    >
      <div className="core-boundary" aria-hidden="true" />
      <div className="core-orbit core-orbit--one" aria-hidden="true" />
      <div className="core-orbit core-orbit--two" aria-hidden="true" />
      <div className="core-center">
        <span>{content.label}</span>
        <strong>{content.subject}</strong>
        <small>Verified longitudinal context</small>
      </div>
      <div className="core-nodes">
        {content.nodes.map((node, index) => (
          <div className={`core-node core-node--${index + 1}`} key={node}>
            <i />
            <span>{node}</span>
          </div>
        ))}
      </div>
      <span className="synthetic-label">Illustrative · synthetic data</span>
    </div>
  );
}
