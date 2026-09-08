"use client";

/**
 * @file Early Access Design Partner CTA Banner Component
 * @description Conversion banner placed at the bottom of marketing pages inviting practices
 * into the Design Partner Program.
 */

import { trackCtaClick } from "@/lib/analytics/events";
import Link from "next/link";

export function EarlyAccessBanner() {
  return (
    <section className="section" aria-labelledby="cta-banner-heading">
      <div className="container">
        <div className="cta-banner">
          <span className="badge badge-teal" style={{ marginBottom: "1.25rem" }}>
            Design Partner Program
          </span>
          <h2 id="cta-banner-heading" className="cta-banner-title">
            Help shape the future of specialty care execution.
          </h2>
          <p className="cta-banner-desc">
            Sovereign is seeking select rheumatology practices to participate in early product
            development, workflow evaluation, and design-partner discussions.
          </p>
          <div>
            <Link
              href="/early-access"
              className="btn btn-primary btn-lg"
              id="banner-early-access-cta"
              onClick={() =>
                trackCtaClick("early_access_cta_click", "banner", "Request Early Access")
              }
            >
              Request Early Access
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
