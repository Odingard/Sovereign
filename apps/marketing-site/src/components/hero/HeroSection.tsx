import { PageHero } from "@/components/story/PageHero";
import { ClinicalIntelligenceCore } from "@/components/visuals/ClinicalIntelligenceCore";

export function HeroSection() {
  return (
    <PageHero
      eyebrow="Specialty Clinical Intelligence & Execution"
      title="From clinical decision to completed care."
      body="Sovereign connects longitudinal clinical intelligence with the workflows required to move specialty care forward—from understanding the patient to completing the next step."
      primary={{ href: "/early-access", label: "Request Early Access" }}
      secondary={{ href: "/rheumatology", label: "Explore Sovereign Rheumatology" }}
      visual={<ClinicalIntelligenceCore mode="home" />}
    />
  );
}
