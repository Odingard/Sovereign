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
      <Link href="/product" className="mobile-nav-link" onClick={onClose}>
        Product
      </Link>
      <Link href="/platform" className="mobile-nav-link" onClick={onClose}>
        Platform
      </Link>
      <Link href="/rheumatology" className="mobile-nav-link" onClick={onClose}>
        Rheumatology
      </Link>
      <Link href="/security" className="mobile-nav-link" onClick={onClose}>
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
