/**
 * @file SEO & Canonical Site Metadata Configuration
 * @description Centralized metadata, OpenGraph, and Twitter card definitions for Sovereign marketing pages.
 */

import type { Metadata } from "next";

export const SITE_CONFIG = {
  name: "Sovereign",
  companyName: "Sovereign Health AI LLC",
  launchProduct: "Sovereign Rheumatology",
  url: "https://sovereignhealth.ai",
  tagline: "From clinical decision to completed care.",
  defaultDescription:
    "Sovereign is building a specialty clinical intelligence and execution platform that helps practices turn longitudinal clinical information, physician decisions, and complex administrative workflows into coordinated, trackable care execution.",
};

export function constructMetadata({
  title,
  description = SITE_CONFIG.defaultDescription,
  path = "",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
} = {}): Metadata {
  const fullTitle = title ? `${title}` : `${SITE_CONFIG.name} | ${SITE_CONFIG.tagline}`;
  const canonicalUrl = `${SITE_CONFIG.url}${path}`;
  const chapter =
    path === "/" || path === ""
      ? "home"
      : path === "/early-access"
        ? "access"
        : path.slice(1).split("/")[0];
  const socialImage = `${SITE_CONFIG.url}/api/social-card?chapter=${chapter}`;

  return {
    title: fullTitle,
    description,
    applicationName: SITE_CONFIG.name,
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: SITE_CONFIG.name,
      locale: "en_US",
      type: "website",
      images: [{ url: socialImage, width: 1200, height: 630, alt: `${fullTitle} — Sovereign` }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [socialImage],
    },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
