import Link from "next/link";
import type { ReactNode } from "react";

export function PageHero({
  eyebrow,
  title,
  body,
  primary = { href: "/early-access", label: "Request Early Access" },
  secondary,
  visual,
  mode = "intelligence",
}: {
  eyebrow: string;
  title: string;
  body: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string };
  visual: ReactNode;
  mode?: "intelligence" | "execution" | "authority";
}) {
  return (
    <section className={`page-hero page-hero--${mode}`}>
      <div className="container page-hero__grid">
        <div className="page-hero__copy">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{body}</p>
          <div className="hero-actions">
            <Link href={primary.href} className="btn btn-primary btn-lg">
              {primary.label}
            </Link>
            {secondary ? (
              <Link href={secondary.href} className="text-link">
                {secondary.label}
                <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
          </div>
          <div className="hero-proofline">
            <span>Specialty-native</span>
            <span>Human-authorized</span>
            <span>Evidence-connected</span>
          </div>
        </div>
        <div className="page-hero__visual">{visual}</div>
      </div>
    </section>
  );
}

export function ChapterCta({
  eyebrow,
  title,
  body,
  href,
  label,
}: { eyebrow: string; title: string; body: string; href: string; label: string }) {
  return (
    <section className="chapter-cta">
      <div className="container chapter-cta__inner">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <Link className="btn btn-light btn-lg" href={href}>
          {label}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
