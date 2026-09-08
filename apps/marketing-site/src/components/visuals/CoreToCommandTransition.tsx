"use client";

import { useEffect, useRef, useState } from "react";
import { ClinicalIntelligenceCore } from "./ClinicalIntelligenceCore";
import { CommandCenter } from "./CommandCenter";

const stages = [
  ["Fragmented information", "Documents and statuses live across systems and people."],
  ["Verified understanding", "Evidence converges into a longitudinal Clinical State."],
  ["Coordinated execution", "Authorized work organizes inside the Command Center."],
];

export function CoreToCommandTransition() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(Number((visible.target as HTMLElement).dataset.index));
      },
      { rootMargin: "-38% 0px -38% 0px", threshold: [0, 0.2, 0.6] },
    );
    for (const node of refs.current) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <section className="transform-story" aria-label="From fragmented information to care execution">
      <div className="container transform-story__grid">
        <div className="transform-copy">
          <span className="eyebrow">One connected story</span>
          {stages.map(([title, body], index) => (
            <div
              className={`transform-step ${active === index ? "is-active" : ""}`}
              data-index={index}
              key={title}
              ref={(node) => {
                refs.current[index] = node;
              }}
            >
              <span>0{index + 1}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          ))}
        </div>
        <div className="transform-canvas" data-stage={active}>
          <div className="transform-core">
            <ClinicalIntelligenceCore mode="home" />
          </div>
          <div className="transform-command">
            <CommandCenter compact />
          </div>
        </div>
      </div>
    </section>
  );
}
