/**
 * @file Sovereign Marketing Homepage (/)
 * @description Primary conversion destination for paid advertising, design-partner outreach,
 * and early-access campaigns.
 */

import { AudienceSection } from "@/components/audience/AudienceSection";
import { ClinicalAuthoritySection } from "@/components/authority/ClinicalAuthoritySection";
import { EarlyAccessBanner } from "@/components/cta/EarlyAccessBanner";
import { HeroSection } from "@/components/hero/HeroSection";
import { ProductPillarsSection } from "@/components/pillars/ProductPillarsSection";
import { PlatformSection } from "@/components/platform/PlatformSection";
import { ProblemSection } from "@/components/problem/ProblemSection";
import { RheumatologySection } from "@/components/rheumatology/RheumatologySection";
import { CommandCenter } from "@/components/visuals/CommandCenter";
import { CoreToCommandTransition } from "@/components/visuals/CoreToCommandTransition";
import { WorkflowHeroSection } from "@/components/workflow/WorkflowHeroSection";
import { constructMetadata } from "@/lib/seo/site-metadata";

export const metadata = constructMetadata({
  title: "Sovereign | From clinical decision to completed care",
  description:
    "Sovereign is building a specialty clinical intelligence and execution platform that helps practices turn longitudinal clinical information, physician decisions, and complex administrative workflows into coordinated, trackable care execution.",
  path: "/",
});

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <CoreToCommandTransition />
      <ProblemSection />
      <PlatformSection />
      <section className="story-section story-section--mist">
        <div className="container">
          <div className="story-section__header">
            <span className="eyebrow">Product proof</span>
            <h2>Understanding becomes an operating environment.</h2>
            <p>
              Clinical State, evidence, therapy history, Clinical Intent, access pathways,
              monitoring, and recent activity remain connected without confusing discussion with
              decision or an attempt with completion.
            </p>
          </div>
          <CommandCenter />
        </div>
      </section>
      <RheumatologySection />
      <WorkflowHeroSection />
      <ClinicalAuthoritySection />
      <ProductPillarsSection />
      <AudienceSection />
      <EarlyAccessBanner />
    </>
  );
}
