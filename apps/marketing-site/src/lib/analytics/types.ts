/**
 * @file Provider-Neutral Marketing Analytics Event Types
 * @description Defines canonical telemetry contracts for advertising and funnel optimization
 * without hardcoding any proprietary vendor SDK.
 */

import type { UtmParameters } from "../attribution/utm";

export type AnalyticsEventName =
  | "page_view"
  | "hero_cta_click"
  | "early_access_cta_click"
  | "rheumatology_cta_click"
  | "form_start"
  | "form_submit"
  | "form_success"
  | "form_error"
  | "advanced_therapy_section_view";

export interface AnalyticsEventPayload {
  readonly path?: string;
  readonly title?: string;
  readonly ctaText?: string;
  readonly ctaLocation?:
    | "header"
    | "hero"
    | "rheumatology_section"
    | "workflow_section"
    | "footer"
    | "banner";
  readonly sectionName?: string;
  readonly formStep?: string;
  readonly errorMessage?: string;
  readonly practiceSize?: string;
  readonly role?: string;
  readonly utm?: UtmParameters;
  readonly timestamp?: string;
  readonly [key: string]: unknown;
}

export interface AnalyticsEvent {
  readonly event: AnalyticsEventName;
  readonly payload: AnalyticsEventPayload;
  readonly timestamp: string;
}

/**
 * Pluggable adapter interface for downstream advertising/analytics services
 * (e.g. Google Analytics 4, Meta Pixel, PostHog, Segment, or Server-Side CAPI).
 */
export interface IAnalyticsAdapter {
  readonly adapterName: string;
  track(event: AnalyticsEvent): void | Promise<void>;
}
