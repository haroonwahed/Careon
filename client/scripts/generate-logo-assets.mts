/**
 * Generate all static Carelane logo assets from the single geometry source.
 *
 * Produces:
 *   public/logos/carelane-mark-gradient.svg
 *   public/logos/carelane-mark-white.svg
 *   public/logos/carelane-mark-navy.svg
 *   public/logos/carelane-logo-dark.svg
 *   public/logos/carelane-logo-light.svg
 *   public/logos/carelane-logo-dark-tagline.svg
 *   public/logos/carelane-logo-light-tagline.svg
 *   public/favicon.svg
 *   public/favicon-16.png, public/favicon-32.png        (transparent mark)
 *   public/icon-192.png, public/icon-512.png            (navy rounded, "any")
 *   public/icon-maskable-512.png                        (navy full-bleed, safe zone)
 *   public/apple-touch-icon.png                         (180×180 navy rounded)
 *
 * Run locally with Node ≥23 (TS type-stripping):
 *   cd client && node --experimental-strip-types scripts/generate-logo-assets.mts
 *
 * `sharp` is used only here, installed transiently via `npm install --no-save sharp`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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
} from "../src/components/logos/markGeometry.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
const LOGOS = join(PUBLIC, "logos");
mkdirSync(LOGOS, { recursive: true });

const gradientStopsSvg = GRADIENT_STOPS.map(
  (s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`,
).join("");

function gradientDef(id: string): string {
  return `<linearGradient id="${id}" x1="${GRADIENT_VECTOR.x1}" y1="${GRADIENT_VECTOR.y1}" x2="${GRADIENT_VECTOR.x2}" y2="${GRADIENT_VECTOR.y2}" gradientUnits="userSpaceOnUse">${gradientStopsSvg}</linearGradient>`;
}

/** The mark's <g> strokes, given a stroke paint (solid colour or url(#id)). */
function markGroup(strokePaint: string): string {
  return (
    `<g fill="none" stroke="${strokePaint}" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${C_PATH}" stroke-width="${STROKE}"/>` +
    `<path d="${L_PATH}" stroke-width="${STROKE}"/>` +
    `<circle cx="${ENDPOINT.cx}" cy="${ENDPOINT.cy}" r="${ENDPOINT.r}" stroke-width="${ENDPOINT.stroke}"/>` +
    `</g>`
  );
}

/** Standalone mark SVG (transparent), gradient or solid. */
function markSvg(kind: "gradient" | "white" | "navy"): string {
  if (kind === "gradient") {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-label="Carelane">` +
      `<defs>${gradientDef("clg")}</defs>` +
      markGroup("url(#clg)") +
      `</svg>\n`
    );
  }
  const color = kind === "white" ? COLOR_WHITE : COLOR_NAVY;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" role="img" aria-label="Carelane">` +
    markGroup(color) +
    `</svg>\n`
  );
}

/**
 * Horizontal lockup SVG. Mark on the left, wordmark (+ optional tagline) right.
 * Wordmark uses <text> with the brand font stack (self-contained, external use).
 */
function lockupSvg(opts: {
  markPaint: "gradient" | "white" | "navy";
  wordColor: string;
  tagColor?: string;
  tagline?: boolean;
}): string {
  const { markPaint, wordColor, tagColor, tagline } = opts;
  const markH = 48;
  const markGap = 18;
  const wordSize = 38;
  const wordX = VIEWBOX + markGap;
  // Generous advance estimates so nothing clips with the fallback font.
  const wordWidth = wordSize * 4.3;
  const tagSize = 9.6;
  // Tagline "CARE. COORDINATED. FORWARD." (27 chars) with wide letter-spacing.
  const taglineWidth = tagline ? tagSize * 23.5 : 0;
  const contentWidth = Math.max(wordWidth, taglineWidth);
  const width = Math.ceil(wordX + contentWidth + 8);
  const height = tagline ? 76 : 64;
  const cy = height / 2;

  const markPaintRef = markPaint === "gradient" ? "url(#clg)" : markPaint === "white" ? COLOR_WHITE : COLOR_NAVY;
  const defs = markPaint === "gradient" ? `<defs>${gradientDef("clg")}</defs>` : "";

  // Vertically center mark; nudge text block for optical balance.
  const markY = (height - markH) / 2;
  const wordBaselineDy = tagline ? -3 : 0;

  const wordText =
    `<text x="${wordX}" y="${cy + wordBaselineDy}" dominant-baseline="middle" ` +
    `font-family="${WORDMARK_FONT.replace(/"/g, "'")}" font-weight="500" font-size="${wordSize}" ` +
    `letter-spacing="-0.6" fill="${wordColor}">Carelane</text>`;

  const tagText = tagline
    ? `<text x="${wordX + 2}" y="${cy + 20}" dominant-baseline="middle" ` +
      `font-family="${WORDMARK_FONT.replace(/"/g, "'")}" font-weight="600" font-size="${tagSize}" ` +
      `letter-spacing="2.4" fill="${tagColor ?? wordColor}">CARE. COORDINATED. FORWARD.</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Carelane">` +
    defs +
    `<g transform="translate(0 ${markY})">${markGroup(markPaintRef)}</g>` +
    wordText +
    tagText +
    `</svg>\n`
  );
}

/** Compose a square app-icon SVG: navy background + centered mark at `markFrac` of canvas. */
function appIconSvg(sizePx: number, markFrac: number, rounded: boolean): string {
  const m = sizePx * markFrac;
  const s = m / VIEWBOX;
  const t = (sizePx - m) / 2;
  const radius = rounded ? Math.round(sizePx * 0.22) : 0;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sizePx} ${sizePx}" width="${sizePx}" height="${sizePx}">` +
    `<defs>${gradientDef("clg")}</defs>` +
    `<rect width="${sizePx}" height="${sizePx}" rx="${radius}" ry="${radius}" fill="${COLOR_NAVY}"/>` +
    `<g transform="translate(${t} ${t}) scale(${s})">${markGroup("url(#clg)")}</g>` +
    `</svg>`
  );
}

// ── Write static SVGs ──────────────────────────────────────────────────────
const writes: Array<[string, string]> = [
  [join(LOGOS, "carelane-mark-gradient.svg"), markSvg("gradient")],
  [join(LOGOS, "carelane-mark-white.svg"), markSvg("white")],
  [join(LOGOS, "carelane-mark-navy.svg"), markSvg("navy")],
  [
    join(LOGOS, "carelane-logo-dark.svg"),
    lockupSvg({ markPaint: "gradient", wordColor: COLOR_WHITE }),
  ],
  [
    join(LOGOS, "carelane-logo-light.svg"),
    lockupSvg({ markPaint: "navy", wordColor: COLOR_NAVY }),
  ],
  [
    join(LOGOS, "carelane-logo-dark-tagline.svg"),
    lockupSvg({ markPaint: "gradient", wordColor: COLOR_WHITE, tagColor: "#9B82FF", tagline: true }),
  ],
  [
    join(LOGOS, "carelane-logo-light-tagline.svg"),
    lockupSvg({ markPaint: "navy", wordColor: COLOR_NAVY, tagColor: "rgba(6,11,23,0.6)", tagline: true }),
  ],
  [join(PUBLIC, "favicon.svg"), markSvg("gradient")],
];

for (const [path, content] of writes) {
  writeFileSync(path, content);
  console.log("wrote", path.replace(join(__dirname, ".."), "."));
}

// ── Rasterize favicon + PWA PNGs ───────────────────────────────────────────
async function raster(svg: string, outPath: string, size: number) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log("wrote", outPath.replace(join(__dirname, ".."), "."), `(${size}px)`);
}

const transparentMark = markSvg("gradient");

await raster(transparentMark, join(PUBLIC, "favicon-16.png"), 16);
await raster(transparentMark, join(PUBLIC, "favicon-32.png"), 32);
await raster(appIconSvg(192, 0.6, true), join(PUBLIC, "icon-192.png"), 192);
await raster(appIconSvg(512, 0.6, true), join(PUBLIC, "icon-512.png"), 512);
await raster(appIconSvg(512, 0.52, false), join(PUBLIC, "icon-maskable-512.png"), 512);
await raster(appIconSvg(180, 0.6, true), join(PUBLIC, "apple-touch-icon.png"), 180);

console.log("\n✅ Logo assets generated.");
