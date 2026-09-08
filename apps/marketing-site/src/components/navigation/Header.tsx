"use client";

/**
 * @file Site Header & Global Navigation Component
 * @description Renders brand identity, responsive navigation, and primary early-access CTA.
 */

import { trackCtaClick } from "@/lib/analytics/events";
import Link from "next/link";
import { useState } from "react";
import { MobileNav } from "./MobileNav";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCtaClick = () => {
    trackCtaClick("early_access_cta_click", "header", "Request Early Access");
  };

  return (
    <header className="site-header">
      <div className="container">
        <div className="header-inner">
          <Link href="/" className="brand-logo" aria-label="Sovereign Home">
            <span className="brand-logo-mark" aria-hidden="true">
              <i />
            </span>
            <span>Sovereign</span>
          </Link>

          <nav className="nav-desktop" aria-label="Main Navigation">
            <Link href="/product" className="nav-link">
              Product
            </Link>
            <Link href="/platform" className="nav-link">
              Platform
            </Link>
            <Link href="/rheumatology" className="nav-link">
              Rheumatology
            </Link>
            <Link href="/security" className="nav-link">
              Security
            </Link>
            <Link href="/about" className="nav-link">
              About
            </Link>
          </nav>

          <div className="nav-actions">
            <Link
              href="/early-access"
              className="btn btn-primary"
              onClick={handleCtaClick}
              id="header-early-access-btn"
            >
              Request Early Access
            </Link>

            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <MobileNav onClose={() => setMobileMenuOpen(false)} onCtaClick={handleCtaClick} />
      )}
    </header>
  );
}
