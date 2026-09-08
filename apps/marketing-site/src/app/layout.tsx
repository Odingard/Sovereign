/**
 * @file Master Root Layout for Sovereign Marketing Website
 * @description Provides global styling, SEO metadata, navigation header, footer,
 * and client-side analytics provider.
 */

import { Footer } from "@/components/footer/Footer";
import { Header } from "@/components/navigation/Header";
import { AnalyticsProvider } from "@/lib/analytics/AnalyticsProvider";
import { constructMetadata } from "@/lib/seo/site-metadata";
import type { ReactNode } from "react";

import "@/styles/globals.css";
import "@/styles/navigation.css";
import "@/styles/hero.css";
import "@/styles/workflow.css";
import "@/styles/sections.css";
import "@/styles/forms.css";

export const metadata = constructMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <AnalyticsProvider>
          <Header />
          <main id="main-content" style={{ flex: "1 0 auto" }}>
            {children}
          </main>
          <Footer />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
