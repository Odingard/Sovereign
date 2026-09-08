/**
 * @file Global Site Footer Component
 * @description Renders corporate identity (Sovereign Health AI LLC), legal links,
 * product navigation, and mandatory patient information disclaimers.
 */

import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        {/* Warning Banner */}
        <div className="phi-warning-footer" role="note">
          <strong>Notice:</strong> Sovereign provides specialty care execution software for
          healthcare practices. This public marketing website does not collect, process, or store
          patient records. Please do not submit patient information or protected health information
          through any form or contact channel on this site.
        </div>

        <div className="footer-top">
          <div>
            <div className="brand-logo" style={{ color: "#ffffff", marginBottom: "1rem" }}>
              <span className="brand-logo-mark" aria-hidden="true">
                S
              </span>
              <span>Sovereign</span>
            </div>
            <p
              style={{
                color: "var(--text-inverse-muted)",
                fontSize: "0.95rem",
                maxWidth: "340px",
                lineHeight: "1.6",
              }}
            >
              Specialty clinical intelligence and execution platform. From clinical decision to
              completed care.
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "1rem" }}>
              Sovereign Health AI LLC
            </p>
          </div>

          <div>
            <h4 className="footer-col-title">Specialty Products</h4>
            <ul className="footer-links">
              <li>
                <Link href="/rheumatology" className="footer-link">
                  Sovereign Rheumatology
                </Link>
              </li>
              <li>
                <Link href="/#workflow" className="footer-link">
                  Therapy Access & Continuity
                </Link>
              </li>
              <li>
                <Link href="/#platform" className="footer-link">
                  Platform Architecture
                </Link>
              </li>
              <li>
                <Link href="/early-access" className="footer-link">
                  Design Partner Program
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">For Practices</h4>
            <ul className="footer-links">
              <li>
                <Link href="/#audience" className="footer-link">
                  Rheumatology Groups
                </Link>
              </li>
              <li>
                <Link href="/#authority" className="footer-link">
                  Clinical Authority Model
                </Link>
              </li>
              <li>
                <Link href="/about#security" className="footer-link">
                  Security & Tenancy
                </Link>
              </li>
              <li>
                <Link href="/early-access" className="footer-link">
                  Request Early Access
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="footer-col-title">Company & Legal</h4>
            <ul className="footer-links">
              <li>
                <Link href="/about" className="footer-link">
                  About Sovereign
                </Link>
              </li>
              <li>
                <Link href="/contact" className="footer-link">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="footer-link">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="footer-link">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <div>&copy; {new Date().getFullYear()} Sovereign Health AI LLC. All rights reserved.</div>
          <div>
            Clinician Decides &bull; Sovereign Executes &bull; Synthetic Development Environment
          </div>
        </div>
      </div>
    </footer>
  );
}
