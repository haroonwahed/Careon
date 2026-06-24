/**
 * CarelaneLogo — the single canonical brand component.
 *
 * Renders the approved "CL Guided Junction" mark (open C + internal L + ring
 * endpoint) from one geometry source (./markGeometry), optionally locked up with
 * the "Carelane" wordmark and tagline. Theme-aware, accessible, and crisp at any
 * size because the mark is inline SVG (never a raster image).
 *
 * Usage:
 *   <CarelaneLogo />                                  dark horizontal, no tagline
 *   <CarelaneLogo variant="mark" size="sm" />         standalone gradient mark
 *   <CarelaneLogo theme="light" />                    navy mark + navy wordmark
 *   <CarelaneLogo tagline size="lg" />                marketing lockup with tagline
 *   <CarelaneLogo theme="monochrome-white" />         flat white (image-heavy footers)
 *
 * Accessibility: pass `ariaLabel` for a meaningful label (default "Carelane").
 * Pass `ariaLabel=""` to mark the logo decorative (e.g. when the wrapping <a>
 * already provides the accessible name).
 */

import { useId } from "react";
import {
  VIEWBOX,
  STROKE,
  C_PATH,
  L_PATH,
  ENDPOINT,
  GRADIENT_STOPS,
  GRADIENT_VECTOR,
  COLOR_NAVY,
  COLOR_WHITE,
  WORDMARK_FONT,
} from "./markGeometry";

export type CarelaneLogoVariant = "horizontal" | "mark";
export type CarelaneLogoTheme =
  | "dark"
  | "light"
  | "monochrome-white"
  | "monochrome-navy"
  /** Gradient mark + wordmark in `currentColor` — for surfaces that switch light/dark. */
  | "adaptive";
export type CarelaneLogoSize = "sm" | "md" | "lg";

export interface CarelaneLogoProps {
  variant?: CarelaneLogoVariant;
  theme?: CarelaneLogoTheme;
  tagline?: boolean;
  /** Preset mark height, or a custom pixel height. sm=20, md=28, lg=40. */
  size?: CarelaneLogoSize | number;
  className?: string;
  /** Accessible name. Default "Carelane". Pass "" to render decorative. */
  ariaLabel?: string;
  /** Optional inline style passthrough on the wrapper. */
  style?: React.CSSProperties;
}

const SIZE_PX: Record<CarelaneLogoSize, number> = { sm: 20, md: 28, lg: 40 };

const TAGLINE_TEXT = "CARE. COORDINATED. FORWARD.";

function resolveMarkHeight(size: CarelaneLogoSize | number): number {
  return typeof size === "number" ? size : SIZE_PX[size];
}

/** Per-theme colour resolution. `gradient` means use the violet→blue gradient. */
function resolveColors(theme: CarelaneLogoTheme): { mark: "gradient" | string; word: string; tag: string } {
  switch (theme) {
    case "adaptive":
      // Wordmark/tagline inherit the surrounding text colour so the lockup stays
      // legible whether the surface is light or dark; mark keeps the gradient.
      return { mark: "gradient", word: "currentColor", tag: "currentColor" };
    case "light":
      return { mark: COLOR_NAVY, word: COLOR_NAVY, tag: "rgba(6,11,23,0.62)" };
    case "monochrome-white":
      return { mark: COLOR_WHITE, word: COLOR_WHITE, tag: "rgba(246,248,252,0.72)" };
    case "monochrome-navy":
      return { mark: COLOR_NAVY, word: COLOR_NAVY, tag: "rgba(6,11,23,0.62)" };
    case "dark":
    default:
      return { mark: "gradient", word: COLOR_WHITE, tag: "rgba(155,130,255,0.85)" };
  }
}

/** The pure mark SVG. `fill` is a gradient url() or a solid colour. */
function MarkSvg({ heightPx, stroke, gradientId }: { heightPx: number; stroke: string; gradientId: string | null }) {
  const strokeValue = gradientId ? `url(#${gradientId})` : stroke;
  return (
    <svg
      width={heightPx}
      height={heightPx}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", flexShrink: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      {gradientId && (
        <defs>
          <linearGradient
            id={gradientId}
            x1={GRADIENT_VECTOR.x1}
            y1={GRADIENT_VECTOR.y1}
            x2={GRADIENT_VECTOR.x2}
            y2={GRADIENT_VECTOR.y2}
            gradientUnits="userSpaceOnUse"
          >
            {GRADIENT_STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
      )}
      <g stroke={strokeValue} strokeLinecap="round" strokeLinejoin="round">
        <path d={C_PATH} strokeWidth={STROKE} />
        <path d={L_PATH} strokeWidth={STROKE} />
        <circle cx={ENDPOINT.cx} cy={ENDPOINT.cy} r={ENDPOINT.r} strokeWidth={ENDPOINT.stroke} />
      </g>
    </svg>
  );
}

export function CarelaneLogo({
  variant = "horizontal",
  theme = "dark",
  tagline = false,
  size = "md",
  className,
  ariaLabel = "Carelane",
  style,
}: CarelaneLogoProps) {
  const uid = useId();
  const colors = resolveColors(theme);
  const markHeight = resolveMarkHeight(size);
  const gradientId = colors.mark === "gradient" ? `cl-grad-${uid}` : null;

  const decorative = ariaLabel === "";
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": ariaLabel } as const);

  const mark = (
    <MarkSvg
      heightPx={markHeight}
      stroke={gradientId ? "" : (colors.mark as string)}
      gradientId={gradientId}
    />
  );

  if (variant === "mark") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", lineHeight: 0, ...style }}
        {...a11y}
      >
        {mark}
      </span>
    );
  }

  // Horizontal lockup: mark + wordmark (+ optional tagline)
  const wordSize = markHeight * 1.0;
  const tagSize = Math.max(7, markHeight * 0.255);
  const gap = Math.round(markHeight * 0.34);

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap, lineHeight: 0, ...style }}
      {...a11y}
    >
      {mark}
      <span style={{ display: "inline-flex", flexDirection: "column", justifyContent: "center" }}>
        <span
          aria-hidden="true"
          style={{
            fontFamily: WORDMARK_FONT,
            fontWeight: 500,
            fontSize: wordSize,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: colors.word,
            whiteSpace: "nowrap",
          }}
        >
          Carelane
        </span>
        {tagline && (
          <span
            aria-hidden="true"
            style={{
              fontFamily: WORDMARK_FONT,
              fontWeight: 600,
              fontSize: tagSize,
              lineHeight: 1,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: colors.tag,
              marginTop: Math.round(markHeight * 0.16),
              whiteSpace: "nowrap",
            }}
          >
            {TAGLINE_TEXT}
          </span>
        )}
      </span>
    </span>
  );
}

export default CarelaneLogo;
