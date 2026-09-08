/**
 * @file 404 Not Found Page
 * @description Accessible, branded not found page for the marketing website.
 */

import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div
      className="section section-subtle"
      style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}
    >
      <div className="container container-narrow" style={{ textAlign: "center" }}>
        <span className="badge badge-teal" style={{ marginBottom: "1rem" }}>
          Page Not Found
        </span>
        <h1
          style={{
            fontSize: "3rem",
            fontWeight: "800",
            color: "var(--navy-primary)",
            marginBottom: "1rem",
          }}
        >
          404 &mdash; Page Not Found
        </h1>
        <p style={{ fontSize: "1.15rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
          <Link href="/" className="btn btn-primary">
            Return to Homepage
          </Link>
          <Link href="/early-access" className="btn btn-secondary">
            Request Early Access
          </Link>
        </div>
      </div>
    </div>
  );
}
