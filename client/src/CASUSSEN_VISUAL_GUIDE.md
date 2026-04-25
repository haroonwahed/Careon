# Casussen Page - Visual Design Guide

## Overview

This guide shows the visual design details for the Casussen operational triage page.

---

## Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ← SIDEBAR (240px)                                            │
├──────────────────────────────────────────────────────────────┤
│ TOPBAR (64px height)                                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CASUSSEN PAGE CONTENT                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Casussen                                           │     │
│  │ Overzicht en triage · 6 actief · 4 aandacht       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ [🔍 Search...] [Filters] [📋 🎯]                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ [🔴 Zonder match] [🟡 Wacht > 3 dagen]            │     │
│  │ [⚠️ Hoog risico] [🟢 Klaar voor plaatsing]        │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Casussen die aandacht nodig hebben      4 urgent          │
│  ┌─────────────────────┐ ┌─────────────────────┐           │
│  │ [Critical Card]     │ │ [Critical Card]     │           │
│  │ Red glow + border   │ │ Red glow + border   │           │
│  └─────────────────────┘ └─────────────────────┘           │
│  ┌─────────────────────┐ ┌─────────────────────┐           │
│  │ [Warning Card]      │ │ [Warning Card]      │           │
│  │ Amber border        │ │ Amber border        │           │
│  └─────────────────────┘ └─────────────────────┘           │
│                                                              │
│  Overige casussen                        2 stabiel          │
│  ┌─────────────────────┐ ┌─────────────────────┐           │
│  │ [Normal Card]       │ │ [Stable Card]       │           │
│  │ Blue border         │ │ Green border        │           │
│  └─────────────────────┘ └─────────────────────┘           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Card Visual Hierarchy

### Critical Urgency Card (Red)

```
┌──────────────────────────────────────────────────────┐
│ ☑️ ┌──────────┐ ┌─────────┐              ┌────┐    │ ← Header
│    │ URGENT   │ │ Matching│              │ 8d │    │
│    │ Red bg   │ │ Status  │              │Red │    │
│    └──────────┘ └─────────┘              └────┘    │
│                                                      │
│    Jeugd 14 – Complex gedrag                        │ ← Title (Large)
│    ──────────────────────────                       │
│                                                      │
│    📍 Amsterdam  📈 Intensieve begeleiding          │ ← Key Info
│                                                      │
│    ┌──────────────────────────────────────────┐    │ ← Problems
│    │ ⚠️ Geen passende match gevonden         │    │   (Red)
│    └──────────────────────────────────────────┘    │
│    ┌──────────────────────────────────────────┐    │
│    │ 👥 Capaciteitstekort in regio           │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌──────────────────────────────────────────┐    │ ← Insight
│    │ ℹ️  Matching faalt door gebrek aan       │    │   (Blue)
│    │    aanbieders met expertise...           │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌──────────────────────────────────────────┐    │ ← Action
│    │ ✅ AANBEVOLEN ACTIE                      │    │   (Purple)
│    │    Escaleren naar regio coördinator     │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌─────────────────────────┐ ┌────────────┐     │ ← Buttons
│    │ Escaleren →             │ │ Bekijk     │     │
│    │ Purple filled           │ │ Outline    │     │
│    └─────────────────────────┘ └────────────┘     │
└──────────────────────────────────────────────────────┘
  ↑                                                 ↑
  Red border (2px, 40% opacity)                Red glow
  Red background (15% opacity)                 Shadow effect
  Gradient overlay                             Pulse animation
```

**Visual Effects:**
- **Border**: `2px solid rgba(239, 68, 68, 0.4)`
- **Background**: `rgba(239, 68, 68, 0.15)`
- **Glow**: `box-shadow: 0 0 20px rgba(239, 68, 68, 0.15)`
- **Gradient**: `linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)`
- **Pulse**: Border opacity animates (0.3 → 0.5 → 0.3, 2s loop)

---

### Warning Urgency Card (Amber)

```
┌──────────────────────────────────────────────────────┐
│ ☑️ ┌──────────┐ ┌─────────────┐          ┌────┐    │
│    │ AANDACHT │ │ Aanbieder Beoordeling │          │ 5d │    │
│    │ Amber bg │ │ Status      │          │    │    │
│    └──────────┘ └─────────────┘          └────┘    │
│                                                      │
│    Jeugd 11 – Licht verstandelijke beperking       │
│    ───────────────────────────────────────          │
│                                                      │
│    📍 Utrecht  📈 Dagbesteding                      │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ 🕐 Aanbieder Beoordeling vertraagd                 │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ ℹ️  Aanbieder Beoordeling loopt langer dan gepland │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ ✅ AANBEVOLEN ACTIE                      │    │
│    │    Start matching                        │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌─────────────────────────┐ ┌────────────┐     │
│    │ Start matching →        │ │ Bekijk     │     │
│    └─────────────────────────┘ └────────────┘     │
└──────────────────────────────────────────────────────┘
  ↑
  Amber border (2px, 40% opacity)
  Amber background (15% opacity)
  Subtle amber glow
```

**Visual Effects:**
- **Border**: `2px solid rgba(245, 158, 11, 0.4)`
- **Background**: `rgba(245, 158, 11, 0.15)`
- **Glow**: `box-shadow: 0 0 15px rgba(245, 158, 11, 0.1)`
- **Gradient**: `linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(0, 0, 0, 0.02) 100%)`

---

### Normal Urgency Card (Blue)

```
┌──────────────────────────────────────────────────────┐
│ ☑️ ┌──────────┐ ┌───────────┐            ┌────┐    │
│    │ NORMAAL  │ │ Plaatsing │            │ 2d │    │
│    │ Blue bg  │ │ Status    │            │    │    │
│    └──────────┘ └───────────┘            └────┘    │
│                                                      │
│    Jeugd 16 – Autisme spectrum                      │
│    ────────────────────────────                     │
│                                                      │
│    📍 Rotterdam  📈 Ambulante begeleiding           │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ ℹ️  Match geaccepteerd. Wacht op intake  │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ ✅ AANBEVOLEN ACTIE                      │    │
│    │    Plan intake gesprek                   │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌─────────────────────────┐ ┌────────────┐     │
│    │ Plan intake gesprek →   │ │ Bekijk     │     │
│    └─────────────────────────┘ └────────────┘     │
└──────────────────────────────────────────────────────┘
  ↑
  Blue border (2px, 30% opacity)
  Blue background (10% opacity)
  No glow effect
```

**Visual Effects:**
- **Border**: `2px solid rgba(59, 130, 246, 0.3)`
- **Background**: `rgba(59, 130, 246, 0.1)`
- **Glow**: None
- **Gradient**: None

---

### Stable Urgency Card (Green)

```
┌──────────────────────────────────────────────────────┐
│ ☑️ ┌──────────┐ ┌───────────┐            ┌────┐    │
│    │ STABIEL  │ │ Plaatsing │            │ 1d │    │
│    │ Green bg │ │ Status    │            │    │    │
│    └──────────┘ └───────────┘            └────┘    │
│                                                      │
│    Jeugd 15 – Verslavingsproblematiek              │
│    ────────────────────────────────────             │
│                                                      │
│    📍 Amsterdam  📈 Klinische zorg                  │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ ℹ️  Plaatsing bevestigd. Intake gepland  │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌──────────────────────────────────────────┐    │
│    │ ✅ AANBEVOLEN ACTIE                      │    │
│    │    Intake voorbereiden                   │    │
│    └──────────────────────────────────────────┘    │
│                                                      │
│    ┌─────────────────────────┐ ┌────────────┐     │
│    │ Intake voorbereiden →   │ │ Bekijk     │     │
│    └─────────────────────────┘ └────────────┘     │
└──────────────────────────────────────────────────────┘
  ↑
  Green border (2px, 30% opacity)
  Green background (10% opacity)
  Positive, calm feeling
```

**Visual Effects:**
- **Border**: `2px solid rgba(34, 197, 94, 0.3)`
- **Background**: `rgba(34, 197, 94, 0.1)`
- **Glow**: None
- **Gradient**: None

---

## Component Details

### Urgency Badge

```
Critical:
┌──────────┐
│ URGENT   │  ← Red bg (15%), Red text, Red border (40%)
└──────────┘

Warning:
┌──────────┐
│ AANDACHT │  ← Amber bg (15%), Amber text, Amber border (40%)
└──────────┘

Normal:
┌──────────┐
│ NORMAAL  │  ← Blue bg (10%), Blue text, Blue border (30%)
└──────────┘

Stable:
┌──────────┐
│ STABIEL  │  ← Green bg (10%), Green text, Green border (30%)
└──────────┘
```

**Styling:**
- Padding: `10px 12px`
- Border radius: `6px`
- Font: `12px, semibold, uppercase, tracked`
- Border: `1px solid`

---

### Status Badge

```
┌───────────┐
│ Matching  │  ← Specific color per status
└───────────┘
```

**Status Colors:**

| Status | Background | Text | Border |
|--------|------------|------|--------|
| Intake | Purple/20% | Purple/300 | Purple/30% |
| Aanbieder Beoordeling | Blue/20% | Blue/300 | Blue/30% |
| Matching | Amber/20% | Amber/300 | Amber/30% |
| Plaatsing | Green/20% | Green/300 | Green/30% |
| Afgerond | Slate/20% | Slate/300 | Slate/30% |

**Styling:**
- Padding: `4px 10px`
- Border radius: `6px`
- Font: `12px, medium`
- Border: `1px solid`

---

### Wait Time Indicator

```
Normal (≤5 days):
┌──────┐
│ 🕐 3d │  ← Muted bg, muted text
└──────┘

Delayed (>5 days):
┌──────┐
│ 🕐 8d │  ← Red bg (20%), red text, red border
└──────┘
```

**Styling:**
- Padding: `6px 12px`
- Border radius: `8px`
- Font: `14px, semibold`
- Icon size: `14px`

---

### Problem Indicator

```
┌────────────────────────────────────┐
│ ⚠️ Geen passende match gevonden   │
└────────────────────────────────────┘
  ↑
  Red background (10%)
  Red border (20%)
  Icon + text
```

**Styling:**
- Padding: `8px 12px`
- Border radius: `8px`
- Background: `rgba(239, 68, 68, 0.1)`
- Border: `1px solid rgba(239, 68, 68, 0.2)`
- Font: `12px, medium`
- Icon size: `14px`
- Color: Red/300

**Problem Types:**

| Type | Icon | Example Text |
|------|------|--------------|
| no-match | AlertTriangle | Geen passende match gevonden |
| missing-aanbieder beoordeling | Info | Aanbieder Beoordeling ontbreekt |
| capacity | Users | Capaciteitstekort in regio |
| delayed | Clock | Wachttijd te lang |

---

### System Insight Block

```
┌────────────────────────────────────────────┐
│ ℹ️  Matching faalt door gebrek aan         │
│    aanbieders met expertise in complexe    │
│    gedragsproblematiek in Amsterdam.       │
└────────────────────────────────────────────┘
  ↑
  Blue background (10%)
  Blue border (20%)
```

**Styling:**
- Padding: `12px`
- Border radius: `8px`
- Background: `rgba(59, 130, 246, 0.1)`
- Border: `1px solid rgba(59, 130, 246, 0.2)`
- Font: `12px, regular`
- Line height: `1.5`
- Icon size: `14px`
- Color: Blue/300

---

### Recommended Action Block

```
┌────────────────────────────────────────────┐
│ ✅ AANBEVOLEN ACTIE                        │
│    Escaleren naar regio coördinator       │
└────────────────────────────────────────────┘
  ↑
  Purple background (10%)
  Purple border (20%)
```

**Styling:**
- Padding: `12px`
- Border radius: `8px`
- Background: `rgba(139, 92, 246, 0.1)`
- Border: `1px solid rgba(139, 92, 246, 0.2)`
- Label font: `12px, semibold, uppercase, tracked`
- Action font: `14px, medium`
- Icon size: `14px`
- Color: Purple/300 (label), Purple/200 (action)

---

### CTA Buttons

```
Primary (Purple):
┌─────────────────────────────┐
│ Escaleren →                 │  ← Purple bg, white text
└─────────────────────────────┘

Secondary (Outline):
┌─────────────┐
│ Bekijk      │  ← Transparent bg, border, muted text
└─────────────┘
```

**Primary Button:**
- Background: `rgb(139, 92, 246)` (purple-500)
- Text: White
- Font: `14px, semibold`
- Padding: `10px 16px`
- Border radius: `8px`
- Hover: Slightly darker purple

**Secondary Button:**
- Background: Transparent
- Border: `1px solid rgba(255, 255, 255, 0.2)`
- Text: Muted foreground
- Font: `14px, medium`
- Padding: `10px 16px`
- Border radius: `8px`
- Hover: Border becomes purple, text becomes purple

---

## Quick Filter Chips

### Inactive State

```
┌─────────────────┐
│ 🔴 Zonder match │  ← Muted bg, light border, muted text
└─────────────────┘
```

**Styling:**
- Background: `rgba(255, 255, 255, 0.05)`
- Border: `2px solid rgba(255, 255, 255, 0.1)`
- Text: Muted foreground
- Padding: `8px 16px`
- Border radius: `8px`
- Font: `14px, medium`

### Active State

```
┌──────────────────────┐
│ 🔴 Zonder match  ✕   │  ← Red bg, red border, red text, X icon
└──────────────────────┘
```

**Styling:**
- Background: `rgba(239, 68, 68, 0.2)`
- Border: `2px solid rgba(239, 68, 68, 0.4)`
- Text: Red/300
- Padding: `8px 16px`
- Border radius: `8px`
- Font: `14px, medium`
- X icon: `14px`

### Hover State

```
┌─────────────────┐
│ 🔴 Zonder match │  ← Border changes to red preview
└─────────────────┘
```

**Styling:**
- Border color shifts to semantic color (red/amber/green)
- Text color previews semantic color
- Smooth transition (200ms)

---

## Board View Columns

```
┌──────────────────┐
│ Matching    (3)  │  ← Header: Title + count
├──────────────────┤
│                  │
│  [Case Card]     │  ← Same card design
│                  │
│  [Case Card]     │
│                  │
│  [Case Card]     │
│                  │
└──────────────────┘
  ↑
  Premium card styling
  Width: 320px (minimum)
  Vertical scroll if needed
```

**Column Header:**
- Background: Premium card
- Padding: `16px`
- Border radius: `12px`
- Font: `16px, semibold` (title), `14px, medium` (count)
- Margin bottom: `12px`

**Empty Column:**
```
┌──────────────────┐
│                  │
│  Geen casussen   │  ← Centered, muted text
│                  │
└──────────────────┘
```

---

## Bulk Action Bar

```
┌────────────────────────────────────────────────────────┐
│ 3 casussen geselecteerd  [Deselecteer alles]          │
│                                                         │
│        [Start matching] [Assign beoordelaar] [Escaleren]│
└────────────────────────────────────────────────────────┘
  ↑
  Premium card
  Appears with slide-in animation
```

**Styling:**
- Background: Premium card
- Padding: `16px`
- Border radius: `12px`
- Flex layout: Space between

**Left Side:**
- Text: `14px, medium`
- Count: Foreground color
- Deselect button: Ghost style, `12px`

**Right Side:**
- Buttons: Outline style
- Spacing: `8px` gap
- Icons: `16px`
- Purple accent for normal actions
- Red accent for escalate action

---

## Responsive Breakpoints

### Desktop (1400px+)

```
┌────────────────────────────────────────┐
│ [Card]              [Card]             │  ← 2 columns
│                                        │
│ [Card]              [Card]             │
└────────────────────────────────────────┘
```

- Grid: `grid-cols-2`
- Gap: `16px`
- Full features visible

### Laptop (1024px - 1399px)

```
┌────────────────────────────────────────┐
│ [Card]              [Card]             │  ← 2 columns (tighter)
└────────────────────────────────────────┘
```

- Grid: `grid-cols-2`
- Gap: `12px`
- All features visible

### Tablet (768px - 1023px)

```
┌──────────────────┐
│ [Card]           │  ← 1 column
│                  │
│ [Card]           │
└──────────────────┘
```

- Grid: `grid-cols-1`
- Gap: `12px`
- Quick filters wrap to 2 rows
- Board view: Horizontal scroll

### Mobile (<768px)

```
┌──────────────┐
│ [Card]       │  ← 1 column, full width
│              │
│ [Card]       │
└──────────────┘
```

- Grid: `grid-cols-1`
- Gap: `12px`
- Quick filters stack
- Reduced padding
- Smaller fonts

---

## Animation & Transitions

### Card Hover

```
Before:
┌────────────────┐
│ [Card]         │  ← Border 40% opacity
└────────────────┘

After (hover):
┌────────────────┐
│ [Card]         │  ← Border 60% opacity
└────────────────┘    Shadow appears
                      Title turns purple
                      200ms smooth transition
```

### Quick Filter Activation

```
Click:
  Background: muted → semantic color (200ms ease)
  Border: muted → semantic color (200ms ease)
  Text: muted → semantic color (200ms ease)
  Icon: Fade in X (150ms)
```

### Bulk Action Bar Appearance

```
Selection made:
  Bar slides down from top (300ms ease-out)
  Opacity: 0 → 1
  Transform: translateY(-20px) → translateY(0)
```

### Critical Card Pulse

```
Animation loop (2s):
  Border opacity: 0.3 → 0.5 → 0.3
  Infinite loop
  Easing: ease-in-out
```

---

## Color Palette Reference

### Urgency Colors

```css
/* Critical */
--critical-bg: rgba(239, 68, 68, 0.15);
--critical-border: rgba(239, 68, 68, 0.4);
--critical-text: rgb(248, 113, 113); /* red-400 */
--critical-glow: rgba(239, 68, 68, 0.15);

/* Warning */
--warning-bg: rgba(245, 158, 11, 0.15);
--warning-border: rgba(245, 158, 11, 0.4);
--warning-text: rgb(251, 191, 36); /* amber-400 */
--warning-glow: rgba(245, 158, 11, 0.1);

/* Normal */
--normal-bg: rgba(59, 130, 246, 0.1);
--normal-border: rgba(59, 130, 246, 0.3);
--normal-text: rgb(96, 165, 250); /* blue-400 */

/* Stable */
--stable-bg: rgba(34, 197, 94, 0.1);
--stable-border: rgba(34, 197, 94, 0.3);
--stable-text: rgb(74, 222, 128); /* green-400 */
```

### Semantic Block Colors

```css
/* Problem (Red) */
--problem-bg: rgba(239, 68, 68, 0.1);
--problem-border: rgba(239, 68, 68, 0.2);
--problem-text: rgb(252, 165, 165); /* red-300 */

/* Insight (Blue) */
--insight-bg: rgba(59, 130, 246, 0.1);
--insight-border: rgba(59, 130, 246, 0.2);
--insight-text: rgb(147, 197, 253); /* blue-300 */

/* Action (Purple) */
--action-bg: rgba(139, 92, 246, 0.1);
--action-border: rgba(139, 92, 246, 0.2);
--action-label: rgb(196, 181, 253); /* purple-300 */
--action-text: rgb(221, 214, 254); /* purple-200 */
```

---

## Typography Scale

```css
/* Page Title */
--title-size: 30px;
--title-weight: 600;
--title-line-height: 1.2;

/* Section Header */
--section-size: 18px;
--section-weight: 600;
--section-line-height: 1.3;

/* Card Title */
--card-title-size: 16px;
--card-title-weight: 600;
--card-title-line-height: 1.4;

/* Body Text */
--body-size: 14px;
--body-weight: 400;
--body-line-height: 1.5;

/* Small Text */
--small-size: 12px;
--small-weight: 500;
--small-line-height: 1.4;

/* Badge/Label */
--label-size: 12px;
--label-weight: 600;
--label-line-height: 1;
--label-tracking: 0.05em;
--label-transform: uppercase;
```

---

## Spacing System

```css
/* Page Spacing */
--page-padding-x: 24px;
--page-padding-y: 32px;
--section-gap: 24px;

/* Card Spacing */
--card-padding: 20px;
--card-gap: 16px;
--card-internal-gap: 16px;

/* Element Spacing */
--badge-gap: 8px;
--button-gap: 12px;
--icon-gap: 8px;

/* Grid Spacing */
--grid-gap: 16px;
--grid-gap-small: 12px;
```

---

## Summary

The visual design of the Casussen page uses **color as meaning**, **hierarchy through structure**, and **urgency through visual intensity**. Every visual element serves a purpose:

- **Red glow** = Immediate attention required
- **Purple blocks** = Recommended next steps
- **Blue blocks** = Contextual information
- **Red blocks** = Problems/blockers

The design prioritizes **fast scanning** and **instant comprehension**—users should understand the situation in under 3 seconds per card.

---

**Visual Design Date:** April 17, 2026  
**Status:** Production Ready  
**Design System:** CareOn v2.0
