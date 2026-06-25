# Carelane Logo System

The official Carelane artwork ships as the **raster brand kit** in
[`public/brand`](../../../public/brand) (installed from `Blueprint and design/carelane_brand_kit`).
Use those PNG assets **exactly as delivered** — see `public/brand/README.md` and
`public/brand/asset-index.json` for the canonical rules.

> Do **not** redraw, recolor, restretch, CSS-build, add gradients/filters/shadows
> to, or re-type the "Carelane" wordmark beside the mark. The wordmark is part of
> the image. A true SVG would need the vector master (not supplied).

## Component: `CarelaneLogo`

```tsx
import { CarelaneLogo } from "@/components/logos/CarelaneLogo";

<CarelaneLogo theme="dark" className="w-[160px]" />   // dark surfaces (default)
<CarelaneLogo theme="light" className="w-[160px]" />  // light surfaces
<CarelaneLogo theme="auto" className="w-[165px]" />   // follows app .dark class
<CarelaneLogo compact className="w-[150px]" />        // narrow navigation
<CarelaneLogo mark className="w-[38px]" decorative /> // collapsed sidebar / empty states
<CarelaneLogo monochrome className="w-[160px]" />     // monochrome dark contexts
```

Renders a single `<img>` with `object-contain` and `h-auto` — set **width** via
`className`, never a fixed width+height (that distorts). `decorative` sets
`alt=""` + `aria-hidden`; otherwise `alt="Carelane"`.

### Props

| Prop         | Type                          | Default  | Asset |
|--------------|-------------------------------|----------|-------|
| `theme`      | `"dark" \| "light" \| "auto"` | `"dark"` | gradient+white / navy / both via `dark:` |
| `compact`    | `boolean`                     | `false`  | `carelane-logo-compact-transparent.png` |
| `mark`       | `boolean`                     | `false`  | `marks/carelane-mark-gradient-transparent.png` |
| `monochrome` | `boolean`                     | `false`  | `carelane-logo-white-transparent.png` |
| `className`  | `string`                      | —        | set width here |
| `decorative` | `boolean`                     | `false`  | `alt=""` + `aria-hidden` |

Precedence: `mark` → `monochrome` → `compact` → `theme`.

## Asset map (`public/brand`)

| Use | File |
|-----|------|
| Dark surfaces      | `logos/png/carelane-logo-gradient-white-transparent.png` |
| Light surfaces     | `logos/png/carelane-logo-navy-transparent.png` |
| Narrow navigation  | `logos/png/carelane-logo-compact-transparent.png` |
| Monochrome dark    | `logos/png/carelane-logo-white-transparent.png` |
| Standalone mark    | `marks/carelane-mark-gradient-transparent.png` |
| Favicon            | `icons/favicon.ico` |
| Apple touch / PWA  | `icons/carelane-app-icon-180/192/512.png` |
| Brand tokens       | `tokens/brand-tokens.css` (mirrored to `src/styles/brand-tokens.css`) |

Horizontal lockups are 2048×512 (4:1); the mark and icons are square.

## In-app usage

| Location               | Call |
|------------------------|------|
| Landing navbar/footer  | `<CarelaneLogo theme="dark" decorative className="w-[160px]" />` (inside labelled `<a>`) |
| App sidebar (expanded) | `<CarelaneLogo theme="auto" decorative className="w-[165px]" />` |
| App sidebar (collapsed)| `<CarelaneLogo mark decorative className="w-[38px]" />` |
| Login                  | `<CarelaneLogo theme="dark" className="w-[240px]" />` |

## Sizing & clear space

- Sidebar 150–185px · header 145–175px · login 220–285px · mobile header 112–140px.
- Collapsed sidebar: mark only, 36–42px, centered.
- Keep ≥12% of the logo height as clear space; never tight against borders/cards/buttons.

## Django

Server-rendered templates reference the brand assets via the collected static
path, e.g. `{% static 'spa/brand/logos/png/carelane-logo-gradient-white-transparent.png' %}`
(vite copies `public/brand` → `theme/static/spa/brand` at build).
