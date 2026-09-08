/**
 * @file UTM Attribution Tracking & Storage
 * @description Extracts, persists, and provides UTM marketing campaign parameters
 * across page transitions to preserve attribution through early-access lead submissions.
 */

export interface UtmParameters {
  readonly utm_source?: string;
  readonly utm_medium?: string;
  readonly utm_campaign?: string;
  readonly utm_content?: string;
  readonly utm_term?: string;
  readonly referrer?: string;
  readonly landing_page?: string;
  readonly captured_at?: string;
}

const STORAGE_KEY = "sovereign_utm_attribution";

/**
 * Extracts UTM parameters from a URL query string or URLSearchParams.
 */
export function extractUtmParameters(search: string | URLSearchParams): UtmParameters {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const utm: Record<string, string> = {};

  const fields = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
  for (const field of fields) {
    const val = params.get(field);
    if (val && val.trim().length > 0) {
      utm[field] = val.trim().slice(0, 100); // sanitize length
    }
  }

  return utm as UtmParameters;
}

interface BrowserEnvironment {
  readonly location?: { readonly search?: string; readonly pathname?: string };
  readonly sessionStorage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
}

interface DocumentEnvironment {
  readonly referrer?: string;
}

function getBrowserWindow(): BrowserEnvironment | undefined {
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    return (globalThis as unknown as { window?: BrowserEnvironment }).window;
  }
  return undefined;
}

function getBrowserDocument(): DocumentEnvironment | undefined {
  if (typeof globalThis !== "undefined" && "document" in globalThis) {
    return (globalThis as unknown as { document?: DocumentEnvironment }).document;
  }
  return undefined;
}

/**
 * Captures UTM parameters from window.location if in browser environment.
 * Persists first-touch / last-touch attribution in sessionStorage.
 */
export function captureAndStoreUtmParameters(): UtmParameters {
  const win = getBrowserWindow();
  const doc = getBrowserDocument();
  if (!win) {
    return {};
  }

  try {
    const currentParams = extractUtmParameters(win.location?.search || "");
    const hasCurrentUtm = Object.keys(currentParams).length > 0;

    let existing: UtmParameters = {};
    const rawStored = win.sessionStorage?.getItem(STORAGE_KEY);
    if (rawStored) {
      try {
        existing = JSON.parse(rawStored);
      } catch {
        // invalid json, ignore
      }
    }

    if (hasCurrentUtm || !rawStored) {
      const merged: UtmParameters = {
        ...existing,
        ...currentParams,
        referrer: existing.referrer || doc?.referrer || undefined,
        landing_page: existing.landing_page || win.location?.pathname,
        captured_at: existing.captured_at || new Date().toISOString(),
      };
      win.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }

    return existing;
  } catch {
    return {};
  }
}

/**
 * Retrieves currently stored UTM attribution parameters for form submission.
 */
export function getStoredUtmParameters(): UtmParameters {
  const win = getBrowserWindow();
  if (!win) {
    return {};
  }

  try {
    const raw = win.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UtmParameters;
  } catch {
    return {};
  }
}
