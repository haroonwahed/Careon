/**
 * Carelane "CL Guided Junction" mark — single geometry source of truth.
 *
 * The mark is composed of three elements on a 48×48 canvas:
 *   1. An open outer C (arc with the opening on the right).
 *   2. An internal L (vertical stroke turning into a horizontal route).
 *   3. A circular endpoint (ring) at the tip of the L — the decision/handoff point.
 *
 * This file is imported by BOTH:
 *   - the CarelaneLogo React component (in-app, theme-aware), and
 *   - scripts/generate-logo-assets.mts (static .svg + favicon/PWA .png assets),
 * so the mark never changes shape between contexts.
 *
 * Do not bake glow, shadow, or background into this geometry. Glow is a CSS-only
 * concern for large marketing surfaces.
 */

export const VIEWBOX = 48;

/** Stroke weight of the C and L strokes (round caps + joins). */
export const STROKE = 4.4;

/** Open outer C — opening on the right (≈1 o'clock to ≈5 o'clock, 240° arc swept via the left). */
export const C_PATH = "M 32 9.28 A 17 17 0 1 0 32 38.72";

/** Internal L — vertical drop turning into a horizontal route toward the endpoint. */
export const L_PATH = "M 20.5 12.5 L 20.5 30 L 32 30";

/** Circular endpoint (ring) at the tip of the L. */
export const ENDPOINT = { cx: 34.7, cy: 30, r: 2.7, stroke: 1.8 } as const;

/** Approved violet→indigo→blue gradient (top-left to bottom-right). */
export const GRADIENT_STOPS = [
  { offset: "0%", color: "#B06CFF" }, // upper violet
  { offset: "38%", color: "#6D5CFF" }, // middle indigo
  { offset: "78%", color: "#2D8CFF" }, // lower blue
  { offset: "100%", color: "#38A8FF" }, // endpoint blue
] as const;

/** Gradient vector runs corner-to-corner so the flow follows the mark. */
export const GRADIENT_VECTOR = { x1: 6, y1: 6, x2: 42, y2: 42 } as const;

/** Brand solids. */
export const COLOR_NAVY = "#060B17";
export const COLOR_WHITE = "#F6F8FC";

/** Approved wordmark font stack. */
export const WORDMARK_FONT =
  "'Plus Jakarta Sans', Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
