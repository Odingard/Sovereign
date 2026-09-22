/**
 * @file Design tokens (WO-002B S1-19)
 * @description Colour, spacing and focus, with contrast as a tested property.
 *
 * Source: docs/STAGE1_FOUNDATION_SPEC.md §7.5 — WCAG 2.2 AA from the first component
 * (PRD NFR-007).
 *
 * Contrast ratios are computed and asserted in the test suite rather than checked by
 * eye in a design review. An accessibility requirement nothing measures is a
 * preference.
 */

export const COLOR = {
  surface: "#ffffff",
  surfaceMuted: "#f4f5f7",
  text: "#14161a",
  textMuted: "#4a5058",
  border: "#d3d7de",
  focus: "#0b5cd5",
  // Tones for fact states and identity warnings. Chosen for contrast against
  // `surface`, not for how they look next to each other.
  neutral: "#3c4149",
  informational: "#1f5f8b",
  caution: "#8a5300",
  warning: "#9b1c1c",
} as const;

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 } as const;

/**
 * Focus ring.
 *
 * 2px at 3:1 against the adjacent surface is the WCAG 2.2 non-text contrast minimum.
 * Never removed on `:focus-visible` — a keyboard user who cannot see focus cannot use
 * the interface at all, and "outline: none" is the single most common way that
 * happens.
 */
export const FOCUS_RING = {
  width: 2,
  offset: 2,
  color: COLOR.focus,
  style: "solid",
} as const;

/** Minimum target size, WCAG 2.2 AA (2.5.8). */
export const MIN_TARGET_PX = 24;

function channel(component: number): number {
  const c = component / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text and non-text. */
export const AA_TEXT_CONTRAST = 4.5;
export const AA_LARGE_TEXT_CONTRAST = 3;
