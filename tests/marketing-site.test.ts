import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  analytics,
  trackCtaClick,
  trackEvent,
  trackPageView,
} from "../apps/marketing-site/src/lib/analytics/events";
import type {
  AnalyticsEvent,
  IAnalyticsAdapter,
} from "../apps/marketing-site/src/lib/analytics/types";
import { extractUtmParameters } from "../apps/marketing-site/src/lib/attribution/utm";
import { SlidingWindowRateLimiter } from "../apps/marketing-site/src/lib/lead-capture/rate-limiter";
import { InMemoryLeadRepository } from "../apps/marketing-site/src/lib/lead-capture/repository";
import type { EarlyAccessFormData } from "../apps/marketing-site/src/lib/lead-capture/types";
import { validateEarlyAccessForm } from "../apps/marketing-site/src/lib/lead-capture/validation";
import { SITE_CONFIG } from "../apps/marketing-site/src/lib/seo/site-metadata";

const ROOT = process.cwd();
const MARKETING_ROOT = join(ROOT, "apps/marketing-site");

function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!existsSync(dir)) return fileList;
  const files = readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === "dist" || file === ".next" || file === ".git") continue;
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("WEB-001 Public Marketing Website Test Suite", () => {
  // 1. Page Routes and Existence
  describe("Route Structure & Page Components", () => {
    const requiredRoutes = [
      "src/app/page.tsx", // Homepage
      "src/app/rheumatology/page.tsx", // Sovereign Rheumatology
      "src/app/early-access/page.tsx", // Early Access
      "src/app/about/page.tsx", // About Sovereign
      "src/app/contact/page.tsx", // Contact
      "src/app/privacy/page.tsx", // Privacy Policy
      "src/app/terms/page.tsx", // Terms of Service
      "src/app/not-found.tsx", // 404
      "src/app/api/early-access/route.ts", // Lead generation API route
    ];

    for (const route of requiredRoutes) {
      it(`verifies route exists: ${route}`, () => {
        const fullPath = join(MARKETING_ROOT, route);
        expect(existsSync(fullPath)).toBe(true);
      });
    }

    it("verifies robots.txt and sitemap.xml exist in public directory", () => {
      expect(existsSync(join(MARKETING_ROOT, "public/robots.txt"))).toBe(true);
      expect(existsSync(join(MARKETING_ROOT, "public/sitemap.xml"))).toBe(true);
    });
  });

  // 2. Homepage Sections and Copy Requirements
  describe("Homepage Content & Doctrine Verifications", () => {
    const homePagePath = join(MARKETING_ROOT, "src/app/page.tsx");
    const homeContent = readFileSync(homePagePath, "utf-8");

    it("renders all 10 mandated homepage components", () => {
      expect(homeContent).toContain("<HeroSection");
      expect(homeContent).toContain("<ProblemSection");
      expect(homeContent).toContain("<PlatformSection");
      expect(homeContent).toContain("<RheumatologySection");
      expect(homeContent).toContain("<WorkflowHeroSection");
      expect(homeContent).toContain("<ClinicalAuthoritySection");
      expect(homeContent).toContain("<ProductPillarsSection");
      expect(homeContent).toContain("<AudienceSection");
      expect(homeContent).toContain("<EarlyAccessBanner");
    });

    it("enforces primary tagline in Hero section", () => {
      const heroPath = join(MARKETING_ROOT, "src/components/hero/HeroSection.tsx");
      const heroContent = readFileSync(heroPath, "utf-8");
      expect(heroContent).toContain("From clinical decision to completed care.");
      expect(heroContent).toContain("Sovereign Rheumatology");
      expect(heroContent).toContain("Request Early Access");
      expect(heroContent).toContain("Explore Sovereign Rheumatology");
    });

    it("enforces human clinical authority statement in Clinical Authority section", () => {
      const authPath = join(
        MARKETING_ROOT,
        "src/components/authority/ClinicalAuthoritySection.tsx",
      );
      const authContent = readFileSync(authPath, "utf-8");
      expect(authContent).toContain(
        "The clinician decides. Sovereign makes the decision executable.",
      );
      expect(authContent).toContain("Sovereign will never be the doctor.");
      expect(authContent).toContain("Built to support clinical judgment—not replace it.");
    });

    it("enforces 4-stage Sovereign loop in Platform section", () => {
      const platformPath = join(MARKETING_ROOT, "src/components/platform/PlatformSection.tsx");
      const content = readFileSync(platformPath, "utf-8");
      expect(content).toContain("Understand. Verify. Execute. Monitor.");
      expect(content).toContain("Understand the patient");
      expect(content).toContain("Verify what matters");
      expect(content).toContain("Execute the workflow");
      expect(content).toContain("Monitor to completion");
    });

    it("enforces 8-stage care execution pathway in Workflow Hero section", () => {
      const workflowPath = join(MARKETING_ROOT, "src/components/workflow/WorkflowHeroSection.tsx");
      const content = readFileSync(workflowPath, "utf-8");
      expect(content).toContain("Turn a therapy decision into a completed care pathway.");
      expect(content).toContain("Clinical Decision");
      expect(content).toContain("Prerequisites");
      expect(content).toContain("Documentation");
      expect(content).toContain("Authorization");
      expect(content).toContain("Payer Follow-Up");
      expect(content).toContain("Pharmacy / Infusion");
      expect(content).toContain("Treatment Initiation");
      expect(content).toContain("Care Continuity");
    });

    it("enforces five Sovereign platform pillars in Product Pillars section", () => {
      const pillarsPath = join(MARKETING_ROOT, "src/components/pillars/ProductPillarsSection.tsx");
      const content = readFileSync(pillarsPath, "utf-8");
      expect(content).toContain("Sovereign State");
      expect(content).toContain("Sovereign Verify");
      expect(content).toContain("Sovereign Execute");
      expect(content).toContain("Sovereign Control");
      expect(content).toContain("Sovereign Connect");
    });

    it("enforces audience personas in Audience section", () => {
      const audiencePath = join(MARKETING_ROOT, "src/components/audience/AudienceSection.tsx");
      const content = readFileSync(audiencePath, "utf-8");
      expect(content).toContain("Rheumatologists");
      expect(content).toContain("Nurses & Medical Assistants");
      expect(content).toContain("Prior Auth & Access Teams");
      expect(content).toContain("Practice Administrators");
      expect(content).toContain("Physician Owners");
    });
  });

  // 3. Navigation and CTAs
  describe("Navigation & Primary CTAs", () => {
    it("header contains all required navigation links and primary CTA", () => {
      const headerPath = join(MARKETING_ROOT, "src/components/navigation/Header.tsx");
      const content = readFileSync(headerPath, "utf-8");
      expect(content).toContain('href="/rheumatology"');
      expect(content).toContain('href="/#workflow"');
      expect(content).toContain('href="/#audience"');
      expect(content).toContain('href="/about#security"');
      expect(content).toContain('href="/about"');
      expect(content).toContain('href="/early-access"');
      expect(content).toContain("Request Early Access");
    });

    it("footer contains all required links and official company name", () => {
      const footerPath = join(MARKETING_ROOT, "src/components/footer/Footer.tsx");
      const content = readFileSync(footerPath, "utf-8");
      expect(content).toContain("Sovereign Health AI LLC");
      expect(content).toContain('href="/privacy"');
      expect(content).toContain('href="/terms"');
      expect(content).toContain('href="/contact"');
      expect(content).toContain(
        "Please do not submit patient information or protected health information",
      );
    });
  });

  // 4. Legal Pages & Draft Disclaimers
  describe("Legal Disclosures & Draft Status", () => {
    it("privacy page contains DRAFT notice and anti-PHI rules", () => {
      const privacyPath = join(MARKETING_ROOT, "src/app/privacy/page.tsx");
      const content = readFileSync(privacyPath, "utf-8");
      expect(content).toContain("DRAFT — REQUIRES LEGAL REVIEW");
      expect(content).toContain("Sovereign Health AI LLC");
      expect(content).toContain("Strict Non-Collection of Patient Information (No PHI)");
    });

    it("terms page contains DRAFT notice and clinical disclaimers", () => {
      const termsPath = join(MARKETING_ROOT, "src/app/terms/page.tsx");
      const content = readFileSync(termsPath, "utf-8");
      expect(content).toContain("DRAFT — REQUIRES LEGAL REVIEW");
      expect(content).toContain("Sovereign Health AI LLC");
      expect(content).toContain("Sovereign will never be the doctor.");
      expect(content).toContain("The clinician decides. Sovereign makes the decision executable.");
    });
  });

  // 5. Form Validation & Anti-PHI Guards
  describe("Lead Generation Form & Validation Logic", () => {
    const validPayload: EarlyAccessFormData = {
      firstName: "Jane",
      lastName: "Doe",
      workEmail: "jdoe@rheumassociates.com",
      organization: "Pacific Arthritis Care",
      role: "Rheumatologist / Physician",
      practiceSize: "3-5 clinicians",
      locationCount: "2-4 locations",
      currentEhr: "athenahealth",
      message: "Interested in early access for our biologic workflow.",
      honeypot: "",
      formRenderedAt: Date.now() - 5000, // 5 seconds ago
    };

    it("accepts valid business demographic submission", () => {
      const result = validateEarlyAccessForm(validPayload, true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it("rejects invalid email address format", () => {
      const result = validateEarlyAccessForm(
        {
          ...validPayload,
          workEmail: "not-an-email",
        },
        true,
      );
      expect(result.isValid).toBe(false);
      expect(result.errors.workEmail).toBeDefined();
    });

    it("enforces required business fields", () => {
      const result = validateEarlyAccessForm(
        {
          firstName: "",
          lastName: "",
          workEmail: "",
          organization: "",
          role: "",
          practiceSize: "",
          locationCount: "",
          honeypot: "",
          formRenderedAt: Date.now() - 5000,
        },
        true,
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.firstName).toBeDefined();
      expect(result.errors.lastName).toBeDefined();
      expect(result.errors.workEmail).toBeDefined();
      expect(result.errors.organization).toBeDefined();
      expect(result.errors.role).toBeDefined();
      expect(result.errors.practiceSize).toBeDefined();
      expect(result.errors.locationCount).toBeDefined();
    });

    it("rejects bot submissions that trigger honeypot", () => {
      const result = validateEarlyAccessForm(
        {
          ...validPayload,
          honeypot: "I am a spam bot",
        },
        true,
      );
      expect(result.isValid).toBe(false);
      expect(result.isSpam).toBe(true);
      expect(result.errors.honeypot).toBeDefined();
    });

    it("rejects suspiciously fast submissions (< 1s)", () => {
      const result = validateEarlyAccessForm(
        {
          ...validPayload,
          formRenderedAt: Date.now() - 200, // 200ms ago
        },
        true,
      );
      expect(result.isValid).toBe(false);
      expect(result.isSpam).toBe(true);
      expect(result.errors.form).toBeDefined();
    });

    it("actively detects and rejects clinical PHI keywords in freeform message", () => {
      const phiKeywords = [
        "patient name",
        "patient id",
        "mrn",
        "diagnosis",
        "ssn",
        "medical record",
        "date of birth",
      ];
      for (const keyword of phiKeywords) {
        const result = validateEarlyAccessForm(
          {
            ...validPayload,
            message: `Inquiry regarding ${keyword} data treatment`,
          },
          true,
        );
        expect(result.isValid).toBe(false);
        expect(result.errors.message).toContain("patient information");
      }
    });

    it("confirms NO PHI fields or file upload exist in EarlyAccessForm component", () => {
      const formPath = join(MARKETING_ROOT, "src/components/forms/EarlyAccessForm.tsx");
      const formContent = readFileSync(formPath, "utf-8");

      // Verify no file upload input exists
      expect(formContent).not.toContain('type="file"');

      // Verify no patient demographic fields exist
      expect(formContent).not.toContain('name="patientName"');
      expect(formContent).not.toContain('name="dob"');
      expect(formContent).not.toContain('name="dateOfBirth"');
      expect(formContent).not.toContain('name="mrn"');
      expect(formContent).not.toContain('name="ssn"');
      expect(formContent).not.toContain('name="diagnosis"');
      expect(formContent).not.toContain('name="insurance"');

      // Verify explicit helper text is present in the form UI
      expect(formContent).toContain("Please do not submit patient information");
      expect(formContent).toContain("protected health information");
    });
  });

  // 6. Lead Repository & Transport
  describe("Lead Storage & Attribution Preservation", () => {
    it("successfully persists lead with UTM attribution in InMemoryLeadRepository", async () => {
      const repo = new InMemoryLeadRepository();
      const payload: EarlyAccessFormData = {
        firstName: "Robert",
        lastName: "Smith",
        workEmail: "rsmith@arthritisassociates.org",
        organization: "Arthritis Care Center",
        role: "Practice Administrator / Executive",
        practiceSize: "6-15 clinicians",
        locationCount: "5+ locations",
        currentEhr: "Epic",
        honeypot: "",
        formRenderedAt: Date.now() - 6000,
      };

      const utm = {
        utm_source: "linkedin",
        utm_medium: "paid_social",
        utm_campaign: "rheum_q4_launch",
        utm_content: "completed_care_cta",
        utm_term: "rheumatology_workflow",
      };

      const result = await repo.saveLead({
        ...payload,
        utm,
        submittedAt: new Date().toISOString(),
        clientIp: "127.0.0.1",
      });

      expect(result.success).toBe(true);
      expect(result.leadId).toBeDefined();

      const allLeads = await repo.getAllLeads();
      expect(allLeads.length).toBe(1);
      const stored = allLeads[0];
      expect(stored.firstName).toBe("Robert");
      expect(stored.utm?.utm_source).toBe("linkedin");
      expect(stored.utm?.utm_campaign).toBe("rheum_q4_launch");
      expect(stored.status).toBe("NEW");
    });
  });

  // 7. Rate Limiter
  describe("Lead Submission Rate Limiting", () => {
    it("enforces sliding window rate limit per client identifier", () => {
      const limiter = new SlidingWindowRateLimiter(3, 60000); // 3 allowed per window
      const clientId = "client-test-rate-limit";

      expect(limiter.check(clientId).allowed).toBe(true);
      expect(limiter.check(clientId).allowed).toBe(true);
      expect(limiter.check(clientId).allowed).toBe(true);

      const fourth = limiter.check(clientId);
      expect(fourth.allowed).toBe(false);
      expect(fourth.remaining).toBe(0);
      expect(fourth.resetInMs).toBeGreaterThan(0);
    });
  });

  // 8. Analytics & Attribution
  describe("Provider-Neutral Telemetry & Attribution", () => {
    it("extracts UTM parameters from query string", () => {
      const query =
        "?utm_source=google&utm_medium=cpc&utm_campaign=brand_search&utm_content=ad1&utm_term=sovereign_rheumatology";
      const utm = extractUtmParameters(query);

      expect(utm.utm_source).toBe("google");
      expect(utm.utm_medium).toBe("cpc");
      expect(utm.utm_campaign).toBe("brand_search");
      expect(utm.utm_content).toBe("ad1");
      expect(utm.utm_term).toBe("sovereign_rheumatology");
    });

    it("dispatches analytics events to registered adapters", () => {
      const receivedEvents: AnalyticsEvent[] = [];
      const testAdapter: IAnalyticsAdapter = {
        adapterName: "test-adapter",
        track: (event) => {
          receivedEvents.push(event);
        },
      };

      analytics.registerAdapter(testAdapter);

      trackPageView("/rheumatology", "Sovereign Rheumatology");
      trackCtaClick("hero_cta_click", "hero", "Request Early Access");

      expect(receivedEvents.length).toBeGreaterThanOrEqual(2);
      const pageView = receivedEvents.find((e) => e.event === "page_view");
      expect(pageView).toBeDefined();
      expect(pageView?.payload.path).toBe("/rheumatology");

      const ctaClick = receivedEvents.find((e) => e.event === "hero_cta_click");
      expect(ctaClick).toBeDefined();
      expect(ctaClick?.payload.ctaText).toBe("Request Early Access");
      expect(ctaClick?.payload.ctaLocation).toBe("hero");
    });
  });

  // 9. Brand Protection & Prohibited Strings
  describe("Brand Safety & Prohibited Corporate Entities", () => {
    it("strictly forbids parent-company entity 'Six Sense Enterprise Services LLC' anywhere in marketing site", () => {
      const files = walkDir(MARKETING_ROOT);
      const forbiddenString = "Six Sense Enterprise Services";

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        expect(content).not.toContain(forbiddenString);
      }
    });

    it("verifies public corporate entity is Sovereign Health AI LLC", () => {
      expect(SITE_CONFIG.companyName).toBe("Sovereign Health AI LLC");
      const footerPath = join(MARKETING_ROOT, "src/components/footer/Footer.tsx");
      const content = readFileSync(footerPath, "utf-8");
      expect(content).toContain("Sovereign Health AI LLC");
    });
  });

  // 10. Architectural Isolation
  describe("Architectural Boundary Enforcement", () => {
    it("ensures marketing site does NOT import clinical domain, persistence, authority, or execution graph", () => {
      const files = walkDir(join(MARKETING_ROOT, "src"));
      const prohibitedImports = [
        "@sovereign/persistence",
        "@sovereign/domain",
        "@sovereign/application",
        "@temporalio",
        "@google/genai",
        "@google-cloud",
      ];

      for (const file of files) {
        const content = readFileSync(file, "utf-8");
        for (const bad of prohibitedImports) {
          expect(content).not.toContain(`'${bad}'`);
          expect(content).not.toContain(`"${bad}"`);
        }
      }
    });
  });
});
