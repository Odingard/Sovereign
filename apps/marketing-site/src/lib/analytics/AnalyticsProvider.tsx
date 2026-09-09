"use client";

/**
 * @file Analytics Provider Component
 * @description Injects client-side telemetry listener, captures UTM parameters on initial load,
 * and emits page_view on path changes.
 */

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, createContext, useContext, useEffect } from "react";
import { captureAndStoreUtmParameters } from "../attribution/utm";
import { trackPageView } from "./events";

interface AnalyticsContextValue {
  readonly isInitialized: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({ isInitialized: true });

function NavigationTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    captureAndStoreUtmParameters();
    trackPageView(url, document.title);
  }, [url]);

  return null;
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  return (
    <AnalyticsContext.Provider value={{ isInitialized: true }}>
      {children}
      <Suspense fallback={null}>
        <NavigationTracker />
      </Suspense>
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
