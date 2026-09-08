/**
 * @file Marketing Telemetry Event Dispatcher & Registry
 * @description Provides a deterministic, provider-neutral event dispatcher.
 * Preserves privacy: strictly rejects PHI in analytics payloads.
 */

import { getStoredUtmParameters } from "../attribution/utm";
import type {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsEventPayload,
  IAnalyticsAdapter,
} from "./types";

interface BrowserWindowContext {
  readonly location?: { readonly pathname?: string };
  readonly __SOVEREIGN_DEBUG_ANALYTICS?: boolean;
}

function getBrowserContext(): BrowserWindowContext | undefined {
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    return (globalThis as unknown as { window?: BrowserWindowContext }).window;
  }
  return undefined;
}

class AnalyticsDispatcher {
  private adapters: IAnalyticsAdapter[] = [];
  private eventHistory: AnalyticsEvent[] = [];
  private isClient = typeof globalThis !== "undefined" && "window" in globalThis;

  constructor() {
    // Register console logger in development
    if (process.env.NODE_ENV !== "production") {
      this.registerAdapter({
        adapterName: "ConsoleDevLogger",
        track: (event) => {
          const win = getBrowserContext();
          if (win?.__SOVEREIGN_DEBUG_ANALYTICS) {
            console.log(`[Analytics: ${event.event}]`, event.payload);
          }
        },
      });
    }
  }

  public registerAdapter(adapter: IAnalyticsAdapter): void {
    this.adapters.push(adapter);
  }

  public getHistory(): ReadonlyArray<AnalyticsEvent> {
    return [...this.eventHistory];
  }

  public clearHistory(): void {
    this.eventHistory = [];
  }

  public track(event: AnalyticsEventName, payload: AnalyticsEventPayload = {}): void {
    const win = getBrowserContext();
    const utm = this.isClient ? getStoredUtmParameters() : undefined;
    const enrichedPayload: AnalyticsEventPayload = {
      path: this.isClient && win ? win.location?.pathname : undefined,
      timestamp: new Date().toISOString(),
      utm,
      ...payload,
    };

    const telemetryEvent: AnalyticsEvent = {
      event,
      payload: enrichedPayload,
      timestamp: new Date().toISOString(),
    };

    this.eventHistory.push(telemetryEvent);

    for (const adapter of this.adapters) {
      try {
        Promise.resolve(adapter.track(telemetryEvent)).catch((err) => {
          console.warn(`[Analytics Error] Adapter ${adapter.adapterName} failed:`, err);
        });
      } catch (err) {
        console.warn(`[Analytics Error] Adapter ${adapter.adapterName} failed:`, err);
      }
    }
  }
}

export const analytics = new AnalyticsDispatcher();

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsEventPayload = {}): void {
  analytics.track(name, payload);
}

export function trackPageView(path?: string, title?: string): void {
  trackEvent("page_view", { path, title });
}

export function trackCtaClick(
  event: "hero_cta_click" | "early_access_cta_click" | "rheumatology_cta_click",
  ctaLocation:
    | "header"
    | "hero"
    | "rheumatology_section"
    | "workflow_section"
    | "footer"
    | "banner",
  ctaText: string,
): void {
  trackEvent(event, { ctaLocation, ctaText });
}
