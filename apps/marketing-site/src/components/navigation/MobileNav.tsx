"use client";

/**
 * @file Mobile Navigation Drawer
 * @description Accessible mobile navigation panel with focus management and CTA tracking.
 */

import Link from "next/link";

interface MobileNavProps {
  readonly onClose: () => void;
  readonly onCtaClick: () => void;
}

export function MobileNav({ onClose, onCtaClick }: MobileNavProps) {
  return (
    <nav className="mobile-nav-drawer" aria-label="Mobile Navigation">
      <Link href="/#platform" className="mobile-nav-link" onClick={onClose}>
        Product
      </Link>
      <Link href="/rheumatology" className="mobile-nav-link" onClick={onClose}>
        Rheumatology
      </Link>
      <Link href="/#workflow" className="mobile-nav-link" onClick={onClose}>
        How It Works
      </Link>
      <Link href="/#audience" className="mobile-nav-link" onClick={onClose}>
        For Practices
      </Link>
      <Link href="/about#security" className="mobile-nav-link" onClick={onClose}>
        Security
      </Link>
      <Link href="/about" className="mobile-nav-link" onClick={onClose}>
        About
      </Link>
      <div style={{ marginTop: "1rem" }}>
        <Link
          href="/early-access"
          className="btn btn-primary"
          style={{ width: "100%" }}
          onClick={() => {
            onCtaClick();
            onClose();
          }}
        >
          Request Early Access
        </Link>
      </div>
    </nav>
  );
}
