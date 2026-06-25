/**
 * CarelaneLogo — renders the official Carelane brand artwork.
 *
 * The artwork is the supplied raster brand kit in `public/brand`. We use those
 * PNG assets EXACTLY: no recoloring, no redraw, no CSS-built mark, no gradients
 * or filters added, no separate "Carelane" text typed next to the mark. The
 * wordmark is part of the image. Aspect ratio is preserved via object-contain;
 * pass width through `className` and leave height auto.
 *
 * Asset selection (per public/brand/asset-index.json):
 *   - dark surfaces      → gradient mark + white wordmark
 *   - light surfaces     → navy mark + navy wordmark
 *   - narrow navigation  → compact lockup
 *   - monochrome dark    → flat white lockup
 *   - mark only          → standalone gradient mark (decorative / tight spaces)
 */

const BRAND_BASE = "/brand";

const ASSETS = {
  dark: `${BRAND_BASE}/logos/png/carelane-logo-gradient-white-transparent.png`,
  light: `${BRAND_BASE}/logos/png/carelane-logo-navy-transparent.png`,
  compact: `${BRAND_BASE}/logos/png/carelane-logo-compact-transparent.png`,
  monochromeWhite: `${BRAND_BASE}/logos/png/carelane-logo-white-transparent.png`,
  mark: `${BRAND_BASE}/marks/carelane-mark-gradient-transparent.png`,
} as const;

export type CarelaneLogoTheme = "dark" | "light" | "auto";

export interface CarelaneLogoProps {
  /**
   * Background the logo sits on. `dark` → gradient+white wordmark; `light` →
   * navy. `auto` follows the app's `.dark` class (for surfaces that flip
   * light/dark, e.g. the sidebar) by swapping assets via the `dark:` variant.
   */
  theme?: CarelaneLogoTheme;
  /** Use the compact horizontal lockup (narrow navigation, mobile header). */
  compact?: boolean;
  /** Use the standalone mark only (collapsed sidebar, empty/loading states). */
  mark?: boolean;
  /** Flat monochrome-white lockup (monochrome dark contexts). */
  monochrome?: boolean;
  /** Tailwind/utility classes — set width here; height stays auto. */
  className?: string;
  /** Decorative usage (e.g. mark watermark): hides from the a11y tree. */
  decorative?: boolean;
}

/**
 * Resolve the correct asset. Precedence: mark → monochrome → compact → theme.
 * Keeps the common `<CarelaneLogo theme="dark" />` call simple while supporting
 * the constrained variants the app needs.
 */
function resolveSrc({ theme, compact, mark, monochrome }: CarelaneLogoProps): string {
  if (mark) return ASSETS.mark;
  if (monochrome) return ASSETS.monochromeWhite;
  if (compact) return ASSETS.compact;
  return theme === "light" ? ASSETS.light : ASSETS.dark;
}

export function CarelaneLogo({
  theme = "dark",
  compact = false,
  mark = false,
  monochrome = false,
  className = "",
  decorative = false,
}: CarelaneLogoProps) {
  const a11y = decorative
    ? ({ alt: "", "aria-hidden": true } as const)
    : ({ alt: "Carelane" } as const);
  const base = "block h-auto max-w-full object-contain";

  // `auto` only applies to the theme-dependent full lockup. The mark/compact/
  // monochrome variants are a single asset regardless of theme.
  if (theme === "auto" && !mark && !compact && !monochrome) {
    return (
      <>
        <img
          src={ASSETS.light}
          {...a11y}
          draggable={false}
          className={`${base} dark:hidden ${className}`.trim()}
        />
        <img
          src={ASSETS.dark}
          {...(decorative ? a11y : { alt: "", "aria-hidden": true })}
          draggable={false}
          className={`${base} hidden dark:block ${className}`.trim()}
        />
      </>
    );
  }

  const src = resolveSrc({ theme: theme === "auto" ? "dark" : theme, compact, mark, monochrome });
  return (
    <img
      src={src}
      {...a11y}
      draggable={false}
      className={`${base} ${className}`.trim()}
    />
  );
}

export default CarelaneLogo;
