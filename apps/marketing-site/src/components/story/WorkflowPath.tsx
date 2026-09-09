const DEFAULT_STEPS = [
  "Decision",
  "Prerequisites",
  "Evidence",
  "Documentation",
  "Authorization",
  "Pharmacy / Infusion",
  "Treatment Initiation",
  "Continuity",
];

export function WorkflowPath({
  steps = DEFAULT_STEPS,
  dark = false,
}: { steps?: string[]; dark?: boolean }) {
  return (
    <div className={`story-path ${dark ? "story-path--dark" : ""}`}>
      {steps.map((step, index) => (
        <div className="story-path__step" key={step}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{step}</strong>
          {index < steps.length - 1 ? <i>→</i> : null}
        </div>
      ))}
    </div>
  );
}
