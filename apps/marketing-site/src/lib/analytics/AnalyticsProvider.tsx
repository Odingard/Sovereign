"use client";

/**
 * @file Analytics Provider Component
 * @description Injects client-side telemetry listener, captures UTM parameters on initial load,
 * and emits page_view on path changes.
 */

import { type ReactNode, createContext, useContext, useEffect } from "react";
import { captureAndStoreUtmParameters } from "../attribution/utm";
import { trackPageView } from "./events";

interface AnalyticsContextValue {
  readonly isInitialized: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({ isInitialized: true });

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // 1. Capture incoming advertising/campaign UTM parameters
    captureAndStoreUtmParameters();

    // 2. Track initial client page view
    trackPageView(window.location.pathname, document.title);
  }, []);

  return (
    <AnalyticsContext.Provider value={{ isInitialized: true }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
