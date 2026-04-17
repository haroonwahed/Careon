# Careon Zorgregie - Figma Design System Specification

## 🎯 Purpose

This document provides complete specifications for creating the Careon Zorgregie design system in Figma.

**Goal:** Clean, scalable, component-based design system that matches the implemented code.

---

## 📁 Figma File Structure

```
Careon Zorgregie Design System

├─ 📄 01 — Foundations
├─ 📄 02 — Components
├─ 📄 03 — Layouts
├─ 📄 04 — Screens (Flows)
└─ 📄 05 — Prototypes
```

---

# 📄 01 — FOUNDATIONS

## Color Styles

### Base Colors

**Name:** `bg/background`  
**Value:** `#0A0A0A`  
**Usage:** Main app background

**Name:** `bg/card`  
**Value:** `#141414`  
**Usage:** Card backgrounds, sidebar, top bar

**Name:** `bg/surface`  
**Value:** `#1A1A1A`  
**Usage:** Elevated surfaces, modals

**Name:** `border/default`  
**Value:** `rgba(255, 255, 255, 0.10)`  
**Usage:** Default borders, dividers

**Name:** `border/hover`  
**Value:** `rgba(255, 255, 255, 0.20)`  
**Usage:** Hover state borders

---

### Text Colors

**Name:** `text/primary`  
**Value:** `#FFFFFF`  
**Usage:** Primary text, headings

**Name:** `text/secondary`  
**Value:** `rgba(255, 255, 255, 0.90)`  
**Usage:** Body text

**Name:** `text/muted`  
**Value:** `rgba(255, 255, 255, 0.60)`  
**Usage:** Labels, secondary info

**Name:** `text/disabled`  
**Value:** `rgba(255, 255, 255, 0.35)`  
**Usage:** Disabled text, placeholders

---

### Brand Colors

**Name:** `brand/primary`  
**Value:** `#8B5CF6`  
**Usage:** Primary actions, active states

**Name:** `brand/primary-hover`  
**Value:** `#7C3AED`  
**Usage:** Primary hover states

**Name:** `brand/primary-bg`  
**Value:** `rgba(139, 92, 246, 0.10)`  
**Usage:** Primary backgrounds

**Name:** `brand/primary-border`  
**Value:** `rgba(139, 92, 246, 0.20)`  
**Usage:** Primary borders

---

### Status Colors

**Name:** `status/red`  
**Value:** `#EF4444`  
**Usage:** Urgent, errors, high priority

**Name:** `status/red-bg`  
**Value:** `rgba(239, 68, 68, 0.10)`  
**Usage:** Red backgrounds

**Name:** `status/red-border`  
**Value:** `rgba(239, 68, 68, 0.30)`  
**Usage:** Red borders

---

**Name:** `status/amber`  
**Value:** `#F59E0B`  
**Usage:** Warnings, medium priority

**Name:** `status/amber-bg`  
**Value:** `rgba(245, 158, 11, 0.10)`  
**Usage:** Amber backgrounds

**Name:** `status/amber-border`  
**Value:** `rgba(245, 158, 11, 0.30)`  
**Usage:** Amber borders

---

**Name:** `status/green`  
**Value:** `#22C55E`  
**Usage:** Success, ok, low priority

**Name:** `status/green-bg`  
**Value:** `rgba(34, 197, 94, 0.10)`  
**Usage:** Green backgrounds

**Name:** `status/green-border`  
**Value:** `rgba(34, 197, 94, 0.30)`  
**Usage:** Green borders

---

**Name:** `status/blue`  
**Value:** `#3B82F6`  
**Usage:** Information, neutral

**Name:** `status/blue-bg`  
**Value:** `rgba(59, 130, 246, 0.10)`  
**Usage:** Blue backgrounds

**Name:** `status/blue-border`  
**Value:** `rgba(59, 130, 246, 0.30)`  
**Usage:** Blue borders

---

## Typography Styles

### Headings

**Name:** `text/h1`  
**Font:** Inter Bold  
**Size:** 30px  
**Line height:** 36px  
**Color:** text/primary  
**Usage:** Page titles

**Name:** `text/h2`  
**Font:** Inter Bold  
**Size:** 24px  
**Line height:** 30px  
**Color:** text/primary  
**Usage:** Section titles

**Name:** `text/h3`  
**Font:** Inter Bold  
**Size:** 18px  
**Line height:** 24px  
**Color:** text/primary  
**Usage:** Card titles, subsections

**Name:** `text/h4`  
**Font:** Inter Semibold  
**Size:** 16px  
**Line height:** 22px  
**Color:** text/primary  
**Usage:** Small headings

---

### Body Text

**Name:** `text/body-large`  
**Font:** Inter Regular  
**Size:** 16px  
**Line height:** 24px  
**Color:** text/secondary  
**Usage:** Large body text

**Name:** `text/body`  
**Font:** Inter Regular  
**Size:** 14px  
**Line height:** 20px  
**Color:** text/secondary  
**Usage:** Default body text

**Name:** `text/body-medium`  
**Font:** Inter Medium  
**Size:** 14px  
**Line height:** 20px  
**Color:** text/primary  
**Usage:** Medium weight body

**Name:** `text/body-semibold`  
**Font:** Inter Semibold  
**Size:** 14px  
**Line height:** 20px  
**Color:** text/primary  
**Usage:** Emphasized body

---

### Small Text

**Name:** `text/small`  
**Font:** Inter Regular  
**Size:** 12px  
**Line height:** 16px  
**Color:** text/muted  
**Usage:** Labels, captions

**Name:** `text/small-semibold`  
**Font:** Inter Semibold  
**Size:** 12px  
**Line height:** 16px  
**Color:** text/muted  
**Usage:** Small labels, uppercase labels

**Name:** `text/tiny`  
**Font:** Inter Regular  
**Size:** 11px  
**Line height:** 14px  
**Color:** text/muted  
**Usage:** Smallest text, timestamps

---

### Special

**Name:** `text/label-uppercase`  
**Font:** Inter Semibold  
**Size:** 12px  
**Line height:** 16px  
**Letter spacing:** 0.8px  
**Transform:** Uppercase  
**Color:** text/disabled  
**Usage:** Section labels in sidebar, form labels

**Name:** `text/badge`  
**Font:** Inter Bold  
**Size:** 11px  
**Line height:** 14px  
**Color:** Contextual  
**Usage:** Badges, counts

---

## Effect Styles

### Shadows

**Name:** `shadow/sm`  
**Effect:**  
```
Blur: 4px
Y: 2px
Color: rgba(0, 0, 0, 0.25)
```
**Usage:** Small cards, dropdowns

**Name:** `shadow/md`  
**Effect:**  
```
Blur: 8px
Y: 4px
Color: rgba(0, 0, 0, 0.30)
```
**Usage:** Cards, modals

**Name:** `shadow/lg`  
**Effect:**  
```
Blur: 16px
Y: 8px
Color: rgba(0, 0, 0, 0.35)
```
**Usage:** Large modals, overlays

**Name:** `shadow/primary`  
**Effect:**  
```
Blur: 8px
Y: 2px
Color: rgba(139, 92, 246, 0.20)
```
**Usage:** Active state glow

---

### Blur

**Name:** `blur/backdrop`  
**Effect:**  
```
Background blur: 12px
```
**Usage:** Backdrop for modals, sticky headers

---

## Spacing Scale

Create these as reusable spacing values:

```
spacing/2:   2px
spacing/4:   4px
spacing/6:   6px
spacing/8:   8px
spacing/12:  12px
spacing/16:  16px
spacing/20:  20px
spacing/24:  24px
spacing/28:  28px
spacing/32:  32px
spacing/40:  40px
spacing/48:  48px
spacing/64:  64px
```

---

## Border Radius Scale

```
radius/sm:   6px   (buttons, small elements)
radius/md:   8px   (cards, inputs)
radius/lg:   12px  (large cards, modals)
radius/full: 9999px (pills, badges)
```

---

# 📄 02 — COMPONENTS

## Component Naming Convention

**Format:** `Component / Type / Variant`

**Examples:**
```
Sidebar / Item / Active
Button / Primary
Card / KPI / Warning
AI / Recommendation / Action
```

---

## 1. Sidebar Components

### Component: `Sidebar`

**Variants:**
```
Property: role
Values: Gemeente, Zorgaanbieder, Admin

Property: collapsed
Values: true, false
```

**Auto Layout:**
```
Direction: Vertical
Spacing: 0
Padding: 0
Width: 256px (expanded), 80px (collapsed)
Fill: bg/card
Border: 1px border/default (right side)
```

**Structure:**
```
├─ Sidebar Header (64px height)
├─ Navigation Area (fill)
└─ Sidebar Footer (56px height)
```

---

### Component: `Sidebar / Header`

**Auto Layout:**
```
Direction: Horizontal
Spacing: 12px
Padding: 20px
Height: 64px
Border bottom: 1px border/default
Align: Space between
```

**Contents:**
```
├─ Logo + Title (when expanded)
│  ├─ Text: "Careon" (Inter Bold 18px)
│  └─ Text: "Zorgregie" (Inter Regular 12px, text/muted)
└─ Collapse Button
   └─ Icon: ChevronLeft/ChevronRight (18px)
```

---

### Component: `Sidebar / Section`

**Auto Layout:**
```
Direction: Vertical
Spacing: 0
Padding: 0
Margin top: 28px (first section: 0)
```

**Structure:**
```
├─ Section Label (when expanded)
│  └─ Text: "REGIE" (text/label-uppercase)
│  └─ Padding: 12px (horizontal), 0 (top), 12px (bottom)
└─ Items Container
   └─ Auto Layout: Vertical, spacing 8px
```

---

### Component: `Sidebar / Item`

**Variants:**
```
Property: state
Values: default, hover, active

Property: hasBadge
Values: true, false

Property: collapsed
Values: true, false
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 12px
Padding: 10px 12px
Border radius: radius/md (8px)
Height: auto (min 40px)
Justify: collapsed ? center : start
```

**State: Default**
```
Background: transparent
Icon color: text/muted
Text color: text/muted
```

**State: Hover**
```
Background: brand/primary-bg (rgba(139, 92, 246, 0.05))
Icon color: text/secondary
Text color: text/secondary
```

**State: Active**
```
Background: brand/primary-bg (rgba(139, 92, 246, 0.10))
Border: 1px brand/primary-border
Shadow: shadow/primary
Icon color: brand/primary
Text color: brand/primary
```

**Structure:**
```
├─ Icon (20x20px)
├─ Label (if expanded)
│  └─ Text: "Regiekamer" (text/body-medium)
└─ Badge (if hasBadge)
   └─ Component: Badge
```

**Tooltip (when collapsed):**
```
Position: Right of icon (8px offset)
Component: Tooltip
```

---

### Component: `Sidebar / Footer`

**Auto Layout:**
```
Direction: Horizontal
Spacing: 12px
Padding: 12px
Border top: 1px border/default
Align: collapsed ? center : start
```

**Structure:**
```
├─ Avatar (32x32px, radius/full)
└─ User Info (if expanded)
   ├─ Name (text/body-medium)
   └─ Role (text/small)
```

---

## 2. Top Bar Components

### Component: `Topbar`

**Auto Layout:**
```
Direction: Horizontal
Spacing: 32px
Padding: 0 24px
Height: 64px
Fill: bg/card
Border bottom: 1px border/default
Align: Space between
```

**Structure:**
```
├─ Role Switcher (left)
├─ Search Bar (center, fill)
└─ Actions (right)
   ├─ Notifications
   ├─ Divider
   └─ Account
```

---

### Component: `Topbar / Role Switcher`

**Variants:**
```
Property: type
Values: gemeente, zorgaanbieder, admin

Property: open
Values: true, false
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 12px
Padding: 8px 12px
Border radius: radius/md
```

**State: Default**
```
Background: transparent
Hover: bg/surface (rgba(255, 255, 255, 0.05))
```

**Structure:**
```
├─ Icon Container
│  ├─ Size: 32x32px
│  ├─ Background: brand/primary-bg
│  ├─ Border: 1px brand/primary-border
│  ├─ Border radius: radius/md
│  └─ Icon: MapPin/Building2/Shield (16px, brand/primary)
├─ Text Container
│  ├─ Label: "GEMEENTE" (text/label-uppercase)
│  └─ Name: "Utrecht" (Inter Bold 14px, text/primary)
└─ ChevronDown (14px, text/muted)
   └─ Rotation: open ? 180deg : 0deg
```

---

### Component: `Topbar / Search`

**Auto Layout:**
```
Direction: Horizontal
Spacing: 0
Padding: 0 12px 0 40px
Height: 40px
Max width: 600px
Border radius: radius/md
Background: rgba(255, 255, 255, 0.05)
Border: 1px rgba(255, 255, 255, 0.10)
```

**State: Focus**
```
Background: rgba(255, 255, 255, 0.08)
Border: 1px rgba(255, 255, 255, 0.15)
```

**Structure:**
```
├─ Search Icon (absolute, left 12px, 18px, text/muted)
└─ Input
   └─ Text: "Zoek casussen, cliënten, aanbieders..." (text/body)
```

---

### Component: `Topbar / Notifications`

**Variants:**
```
Property: hasBadge
Values: true, false
```

**Size:** 40x40px  
**Border radius:** radius/md  
**Background:** transparent  
**Hover:** rgba(139, 92, 246, 0.05)

**Structure:**
```
├─ Bell Icon (20px, text/muted)
└─ Badge (if hasBadge)
   ├─ Position: Absolute (-4px, -4px)
   ├─ Size: 20x20px
   ├─ Background: status/red
   ├─ Border radius: radius/full
   └─ Text: "7" (text/badge, white)
```

---

### Component: `Topbar / Account`

**Variants:**
```
Property: open
Values: true, false
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 12px
Padding: 8px 12px
Border radius: radius/md
Background: transparent
Hover: rgba(255, 255, 255, 0.05)
```

**Structure:**
```
├─ Avatar (32x32px, radius/full)
│  └─ Fallback: Initials on brand/primary-bg
├─ User Info
│  ├─ Name (Inter Semibold 14px, text/primary)
│  └─ Role (text/small)
└─ ChevronDown (14px, text/muted)
```

---

## 3. Dropdown Components

### Component: `Dropdown / Menu`

**Variants:**
```
Property: type
Values: role, account
```

**Auto Layout:**
```
Direction: Vertical
Spacing: 0
Padding: 8px
Width: 288px (role), 224px (account)
Border radius: radius/lg
Background: bg/card
Border: 1px border/default
Shadow: shadow/lg
```

---

### Component: `Dropdown / Item`

**Variants:**
```
Property: state
Values: default, hover, active

Property: danger
Values: true, false
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 12px
Padding: 10px 12px
Border radius: radius/md
```

**State: Default**
```
Background: transparent
Text: text/secondary
```

**State: Hover**
```
Background: rgba(255, 255, 255, 0.05)
Text: text/primary
```

**State: Active** (role switcher only)
```
Background: brand/primary-bg
Border: 1px brand/primary-border
Text: brand/primary
Indicator: Purple dot (8px, right side)
```

**State: Danger**
```
Background hover: rgba(239, 68, 68, 0.10)
Icon: status/red
Text: status/red
```

---

## 4. Case Row Component

### Component: `Case / Row`

**Variants:**
```
Property: urgency
Values: high, medium, low

Property: status
Values: blocked, waiting, normal
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 16px
Padding: 16px 20px
Border radius: radius/md
Background: bg/card
Border: 1px border/default
Hover: bg/surface
```

**Structure:**
```
├─ Urgency Indicator (4px width, full height, radius left)
│  └─ Color: high=status/red, medium=status/amber, low=status/green
├─ Main Info (fill)
│  ├─ Header Row
│  │  ├─ Case ID (text/body-semibold)
│  │  └─ Status Badge
│  ├─ Client Name (text/h4)
│  └─ Metadata Row
│     ├─ Age (text/small)
│     ├─ Municipality (text/small)
│     └─ Date (text/small)
└─ Actions
   └─ ChevronRight icon (20px, text/muted)
```

---

## 5. KPI Card Component

### Component: `Card / KPI`

**Variants:**
```
Property: status
Values: normal, warning, critical
```

**Auto Layout:**
```
Direction: Vertical
Spacing: 8px
Padding: 20px
Border radius: radius/md
Background: bg/card
Border: 1px border/default
Shadow: shadow/sm
```

**Status styling:**
```
normal:
  Border: border/default

warning:
  Border: status/amber-border
  Background: Gradient (subtle amber glow)

critical:
  Border: status/red-border
  Background: Gradient (subtle red glow)
```

**Structure:**
```
├─ Label (text/small)
├─ Value (text/h1 or text/h2)
├─ Sublabel (text/small, text/muted)
└─ Trend Indicator (optional)
   └─ Icon + text (TrendingUp/Down, 14px)
```

---

## 6. Provider Card Component

### Component: `Card / Provider`

**Variants:**
```
Property: matchType
Values: best, alternative, risk
```

**Auto Layout:**
```
Direction: Vertical
Spacing: 16px
Padding: 20px
Border radius: radius/lg
Background: bg/card
Border: 1px (variant-specific)
Shadow: shadow/md
```

**Match type styling:**
```
best:
  Border: 2px brand/primary
  Shadow: shadow/primary

alternative:
  Border: 1px border/default

risk:
  Border: 1px status/amber-border
  Background: Subtle amber tint
```

**Structure:**
```
├─ Header
│  ├─ Provider Name (text/h3)
│  ├─ Match Score Badge (if best)
│  └─ Specialty (text/small)
├─ Match Indicators
│  ├─ Experience Match (✓)
│  ├─ Location Match (✓)
│  └─ Capacity Available (✓)
├─ Stats Row
│  ├─ Distance (text/small)
│  ├─ Wait Time (text/small)
│  └─ Rating (stars)
└─ Actions
   └─ Button: "Select" or "View Details"
```

---

## 7. AI Component

### Component: `AI / Block`

**Variants:**
```
Property: type
Values: recommendation, signal, insight
```

**Auto Layout:**
```
Direction: Vertical
Spacing: 12px
Padding: 16px
Border radius: radius/md
Background: bg/surface
Border: 1px (type-specific)
```

**Type styling:**
```
recommendation:
  Border: brand/primary-border
  Icon: Sparkles (brand/primary)

signal:
  Border: status/amber-border
  Icon: AlertTriangle (status/amber)

insight:
  Border: status/blue-border
  Icon: Info (status/blue)
```

**Structure:**
```
├─ Header Row
│  ├─ Icon (16px)
│  └─ Label (text/small-semibold, uppercase)
├─ Message (text/body)
└─ Action (optional)
   └─ Link or Button
```

---

## 8. Button Component

### Component: `Button`

**Variants:**
```
Property: variant
Values: primary, secondary, outline, ghost

Property: size
Values: sm, md, lg

Property: state
Values: default, hover, disabled
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 8px
Padding: size-dependent
Border radius: radius/sm
```

**Size specifications:**
```
sm:   Padding 8px 12px,  Height 32px, Font 12px
md:   Padding 10px 16px, Height 40px, Font 14px
lg:   Padding 12px 20px, Height 48px, Font 16px
```

**Variant: Primary**
```
Default:
  Background: brand/primary
  Text: white
  
Hover:
  Background: brand/primary-hover
  
Disabled:
  Background: rgba(139, 92, 246, 0.30)
  Text: rgba(255, 255, 255, 0.50)
```

**Variant: Secondary**
```
Default:
  Background: bg/surface
  Border: 1px border/default
  Text: text/primary
  
Hover:
  Background: bg/card
  Border: 1px border/hover
```

**Variant: Outline**
```
Default:
  Background: transparent
  Border: 1px border/default
  Text: text/primary
  
Hover:
  Border: 1px brand/primary-border
  Text: brand/primary
```

**Variant: Ghost**
```
Default:
  Background: transparent
  Text: text/primary
  
Hover:
  Background: rgba(255, 255, 255, 0.05)
```

---

## 9. Badge Component

### Component: `Badge`

**Variants:**
```
Property: variant
Values: default, red, amber, green, purple

Property: size
Values: sm, md
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 4px
Padding: 2px 8px (md), 2px 6px (sm)
Border radius: radius/full
```

**Variant colors:**
```
default:
  Background: rgba(255, 255, 255, 0.10)
  Text: text/muted

red:
  Background: status/red-bg
  Text: status/red

amber:
  Background: status/amber-bg
  Text: status/amber

green:
  Background: status/green-bg
  Text: status/green

purple:
  Background: brand/primary-bg
  Text: brand/primary
```

---

## 10. Input Component

### Component: `Input`

**Variants:**
```
Property: state
Values: default, focus, error, disabled
```

**Auto Layout:**
```
Direction: Horizontal
Spacing: 0
Padding: 10px 12px
Height: 40px
Border radius: radius/md
Background: bg/surface
Border: 1px border/default
```

**States:**
```
Default:
  Border: 1px border/default
  
Focus:
  Border: 1px brand/primary
  Background: rgba(255, 255, 255, 0.02)
  
Error:
  Border: 1px status/red
  Background: rgba(239, 68, 68, 0.05)
  
Disabled:
  Background: rgba(255, 255, 255, 0.02)
  Text: text/disabled
  Cursor: not-allowed
```

---

## 11. Tooltip Component

### Component: `Tooltip`

**Auto Layout:**
```
Direction: Vertical
Spacing: 0
Padding: 8px 12px
Border radius: radius/md
Background: bg/surface
Border: 1px border/default
Shadow: shadow/md
```

**Structure:**
```
└─ Text (text/body-medium, white)
```

**Position:** Relative to trigger, 8px offset

---

# 📄 03 — LAYOUTS

## Layout Naming Convention

**Format:** `Layout / Type`

**Examples:**
```
Layout / App
Layout / Page
Layout / Split
```

---

## 1. App Layout

### Component: `Layout / App`

**Purpose:** Base layout for entire app

**Auto Layout:**
```
Direction: Horizontal
Spacing: 0
Width: Fill container
Height: 100vh
```

**Structure:**
```
├─ Sidebar (256px fixed, or 80px collapsed)
└─ Main Area (fill)
   ├─ Topbar (64px fixed height, sticky)
   └─ Content (fill, scrollable)
```

**Usage:**
```
All pages use this layout
Ensures consistent sidebar + topbar
Content area is scrollable
```

---

## 2. Page Layout

### Component: `Layout / Page`

**Purpose:** Standard page content structure

**Auto Layout:**
```
Direction: Vertical
Spacing: 24px
Padding: 24px
Max width: 1920px
Align: Top
```

**Structure:**
```
├─ Page Header
│  ├─ Title (text/h1)
│  └─ Subtitle (text/body, text/muted)
├─ Content Sections
│  └─ Spacing: 32px between sections
└─ Bottom spacing: 96px (scroll padding)
```

---

## 3. Split Layout

### Component: `Layout / Split`

**Purpose:** 60/40 split screen (e.g., Matching page)

**Auto Layout:**
```
Direction: Horizontal
Spacing: 24px
Width: Fill
Height: Fill
```

**Structure:**
```
├─ Left Panel (60% width)
│  └─ Content (scrollable)
└─ Right Panel (40% width)
   └─ Content (scrollable, sticky top)
```

**Usage:**
```
Matching page: Map left, providers right
Detail pages: Info left, actions right
```

---

## 4. Control Center Layout

### Component: `Layout / Control Center`

**Purpose:** 3-column layout for Regiekamer

**Auto Layout:**
```
Direction: Horizontal
Spacing: 24px
Width: Fill
```

**Structure:**
```
├─ Stats Column (25%)
│  └─ KPI Cards (vertical stack)
├─ Main Column (50%)
│  └─ Case list + AI guidance
└─ Quick Actions (25%)
   └─ Priority actions + timeline
```

---

## 5. Table Layout

### Component: `Layout / Table`

**Purpose:** Standard table/list view

**Auto Layout:**
```
Direction: Vertical
Spacing: 0
Width: Fill
```

**Structure:**
```
├─ Header
│  ├─ Title + Actions
│  └─ Filters/Search
├─ Table Header (sticky)
│  └─ Column headers
└─ Table Body (scrollable)
   └─ Rows
```

---

# 📄 04 — SCREENS (FLOWS)

## Screen Naming Convention

**Format:** `Screen / Section / Page Name`

**Examples:**
```
Screen / Regie / Regiekamer
Screen / Regie / Case Detail
Screen / Netwerk / Regio's
```

---

## Create These Screens

### 🟣 Regie Section

**1. Screen / Regie / Regiekamer**
```
Uses:
├─ Layout / App
├─ Layout / Control Center
├─ Component: Card / KPI (x4)
├─ Component: AI / Block
├─ Component: Case / Row (list)
└─ Component: Button

Content:
├─ AI Command Strip (top)
├─ Next Action Guidance
├─ Priority Case Management (3 columns)
└─ Quick Actions
```

---

**2. Screen / Regie / Case Detail**
```
Uses:
├─ Layout / App
├─ Layout / Page
├─ Component: AI / Block
├─ Component: Badge
└─ Component: Button

Content:
├─ Case Header (ID, client, urgency)
├─ AI Recommendation
├─ Tabs: Overview, Beoordeling, Matching, Timeline
└─ Action buttons
```

---

**3. Screen / Regie / Casussen**
```
Uses:
├─ Layout / App
├─ Layout / Table
├─ Component: Case / Row (multiple)
└─ Component: Input (filters)

Content:
├─ Search + Filters
├─ Sort options
└─ Case list
```

---

**4. Screen / Regie / Acties**
```
Uses:
├─ Layout / App
├─ Layout / Page
└─ Action cards

Content:
├─ Pending actions (12)
├─ Grouped by type
└─ Priority sorting
```

---

**5. Screen / Regie / Beoordeling** ⭐ NEW
```
Uses:
├─ Layout / App
├─ Layout / Page
├─ Component: AI / Block
├─ Component: Badge
└─ Component: Button

Content:
├─ Decision Strip (top)
│  ├─ AI Recommendation Block
│  ├─ Quick decision buttons (Urgent/Medium/Low)
│  └─ Fast facts (age, location, concerns)
├─ Assessment Form
│  ├─ Sections: expandable/collapsible
│  ├─ Questions with smart fields
│  ├─ Auto-save indicators
│  └─ Progress tracking
├─ Decision Timeline (right sidebar)
│  └─ Who decided what, when
└─ Action Buttons
   ├─ Save & Continue
   └─ Complete Assessment

Design principles:
- Decision-first (recommendation at top)
- 3-second comprehension (key info visible)
- Expandable sections (reduce overwhelm)
- Semantic colors (urgency-driven)
```

---

### 🔵 Netwerk Section

**6. Screen / Netwerk / Zorgaanbieders**
```
Uses:
├─ Layout / App
├─ Layout / Table
└─ Component: Card / Provider (list)

Content:
├─ Provider list/grid
├─ Filters (specialty, capacity, location)
└─ Search
```

---

**7. Screen / Netwerk / Gemeenten**
```
Uses:
├─ Layout / App
├─ Layout / Table
└─ Municipality cards

Content:
├─ Municipality list
├─ Stats per gemeente
└─ Navigation to details
```

---

**8. Screen / Netwerk / Regio's Overview**
```
Uses:
├─ Layout / App
├─ Layout / Page
├─ Component: Card / KPI (system stats)
└─ Region cards

Content:
├─ System stats (4 KPIs)
├─ AI system insights
├─ Heat visualization
└─ Region cards (grid)
```

---

**9. Screen / Netwerk / Regio Detail**
```
Uses:
├─ Layout / App
├─ Layout / Page
└─ Various cards

Content:
├─ Region header (stats)
├─ Signalen (AI blocks)
├─ Gemeenten in region
└─ Providers in region
```

---

### 🟡 Workflow Pages (Critical)

**10. Screen / Workflow / Matching** ⭐ ENHANCED
```
Uses:
├─ Layout / App
├─ Layout / Split (60/40)
├─ Map component (left 60%)
├─ Component: Card / Provider (right 40%)
└─ Component: AI / Block

Content:

LEFT PANEL (60% - Map):
├─ Case context header (sticky)
│  ├─ Client name
│  ├─ Urgency badge
│  └─ Key requirements
├─ Interactive map
│  ├─ Case location (purple pin)
│  ├─ Provider locations (pins)
│  ├─ Distance circles
│  └─ Zoom controls
└─ Map legend

RIGHT PANEL (40% - Providers):
├─ AI Recommendation (sticky top)
│  ├─ "Best match: Horizon Jeugdzorg"
│  ├─ Match score: 94%
│  └─ Reasoning
├─ Provider cards (scrollable)
│  ├─ Best Match (highlighted)
│  │  ├─ Provider name
│  │  ├─ Match indicators (✓✓✓)
│  │  ├─ Distance + wait time
│  │  ├─ Capacity available
│  │  └─ "Select" button (primary)
│  ├─ Alternative Matches
│  │  └─ Standard card design
│  └─ Risk Matches
│     └─ Warning styling
└─ Filter controls (bottom)

Interactions:
- Click map pin → Highlight provider card
- Hover provider card → Highlight map pin
- Click provider → Expand details
- Select button → Navigate to Placement
```

---

**11. Screen / Workflow / Plaatsing** ⭐ NEW
```
Uses:
├─ Layout / App
├─ Layout / Page
├─ Component: AI / Block
├─ Component: Badge
└─ Component: Button

Content:

TOP SECTION:
├─ Back button (to Matching)
├─ Title: "Plaatsing bevestigen"
└─ Subtitle: Case ID + Client name

PLACEMENT SUMMARY:
├─ Selected Provider Card (large)
│  ├─ Provider name + logo
│  ├─ Match score badge
│  ├─ Match indicators
│  ├─ Contact information
│  └─ Capacity confirmation
├─ Case Summary Card
│  ├─ Client details
│  ├─ Urgency
│  ├─ Key requirements
│  └─ Municipality
└─ AI Confidence Block
   ├─ "94% match confidence"
   ├─ Reasoning
   └─ Risk assessment

PLACEMENT DETAILS:
├─ Placement Date Picker
│  └─ Calendar component
├─ Start Date (expected)
├─ Duration (estimated)
├─ Notes Field
│  └─ Textarea for additional info
└─ Attachments
   └─ Upload documents

CONFIRMATION SECTION:
├─ Review checklist
│  ├─ ☑ Provider capacity confirmed
│  ├─ ☑ Client requirements met
│  └─ ☑ Dates scheduled
├─ Action buttons
│  ├─ "Bevestig Plaatsing" (primary, green)
│  └─ "Annuleren" (secondary)
└─ Warning (if any)
   └─ AI / Block (type: signal)

Post-confirmation:
- Success message
- Navigate to Intake page
- Email notifications sent
```

---

**12. Screen / Workflow / Intake** ⭐ NEW
```
Uses:
├─ Layout / App
├─ Layout / Page
├─ Component: AI / Block
├─ Component: Badge
└─ Timeline component

Content:

HEADER:
├─ Title: "Intake voorbereiden"
├─ Case ID + Client name
├─ Provider: Horizon Jeugdzorg
└─ Placement date badge

INTAKE CHECKLIST:
├─ Document Preparation
│  ├─ ☑ Assessment completed
│  ├─ ☑ Placement confirmed
│  ├─ ☐ Intake form sent to provider
│  └─ ☐ Parent consent received
├─ Provider Notification
│  ├─ Status: "Notified via email"
│  ├─ Sent: timestamp
│  └─ View email button
└─ Scheduling
   ├─ Intake date picker
   ├─ Time selection
   └─ Location (provider address)

INTAKE DOCUMENTS:
├─ Documents to send
│  ├─ Assessment report (PDF)
│  ├─ Medical information
│  └─ Parent consent form
├─ Upload additional
│  └─ Drag & drop area
└─ Document checklist
   └─ Required vs. optional

AI PREPARATION BLOCK:
├─ "Intake gegevens compleet"
├─ Checklist status (8/10 completed)
└─ Missing items highlighted

COMMUNICATION LOG:
├─ Timeline of interactions
│  ├─ Placement confirmed (timestamp)
│  ├─ Email sent to provider (timestamp)
│  ├─ Provider acknowledged (timestamp)
│  └─ Intake scheduled (timestamp)
└─ Add note button

ACTION BUTTONS:
├─ "Verstuur Intake Uitnodiging" (primary)
├─ "Opslaan als concept" (secondary)
└─ "Annuleer Intake" (danger, outline)

Provider View (alternate):
└─ Shows intake request from provider perspective
   ├─ Case details (limited)
   ├─ Accept/Decline buttons
   └─ Questions for municipality
```

---

### ⚙️ Provider View

**13. Screen / Provider / Intake Dashboard** ⭐ UPDATED
```
Uses:
├─ Layout / App
├─ Layout / Page
└─ Intake request cards

Content:

STATS ROW:
├─ 3 nieuwe intake verzoeken (red badge)
├─ 12 actieve casussen
└─ 8 afgerond deze maand

INTAKE REQUESTS (3):
├─ Intake Card 1 (NEW)
│  ├─ Municipality badge
│  ├─ Client: [Name], [Age]
│  ├─ Urgency indicator
│  ├─ Key requirements (bullet list)
│  ├─ Requested start date
│  ├─ Match score (from municipality)
│  └─ Actions
│     ├─ "Accepteer" (green)
│     ├─ "Afwijzen" (red, outline)
│     └─ "Meer informatie" (link)
├─ Intake Card 2 (NEW)
└─ Intake Card 3 (NEW)

RECENTLY ACCEPTED:
└─ Shows accepted intakes in progress
```

---

**14. Screen / Provider / Mijn Casussen**
```
Uses:
├─ Layout / App
├─ Layout / Table
└─ Component: Case / Row (filtered)

Content:
└─ Cases assigned to this provider only
```

---

### 🟢 Provider Profile

**15. Screen / Provider / Profile** ⭐ NEW
```
Uses:
├─ Layout / App
├─ Layout / Page
└─ Provider components

Content:

HEADER:
├─ Back button (to providers list)
├─ Provider name + logo
├─ Specialty badges
└─ Active status indicator

AI DECISION LAYER:
├─ Match Suitability Block
│  ├─ "92% match voor deze casus"
│  ├─ Strengths (checkmarks)
│  └─ Concerns (warnings)
└─ Recommendation
   └─ "Sterk aanbevolen voor urgente casussen"

PROFILE TABS:
├─ Overzicht (active)
├─ Capaciteit
├─ Track Record
└─ Contact

TAB: OVERZICHT
├─ Key Information
│  ├─ Type: Residentieel
│  ├─ Specialisaties (badges)
│  ├─ Leeftijdscategorie: 12-18
│  └─ Locatie + map preview
├─ Quick Stats
│  ├─ Capaciteit: 28/30 (93%)
│  ├─ Gem. wachttijd: 5 dagen
│  ├─ Rating: 4.8 ⭐
│  └─ Afgeronde casussen: 156
└─ Description
   └─ Provider description text

TAB: CAPACITEIT
├─ Capacity Overview
│  ├─ Total: 30 plekken
│  ├─ In gebruik: 28
│  ├─ Beschikbaar: 2
│  └─ Visual capacity bar
├─ Availability Calendar
│  └─ Shows open spots timeline
└─ Wait Time Trends
   └─ Chart showing wait time over time

TAB: TRACK RECORD
├─ Success Metrics
│  ├─ 94% succesvolle afronding
│  ├─ 4.8/5.0 gemiddelde rating
│  └─ 12 dagen gem. plaatsingsduur
├─ Recent Cases
│  └─ Anonymized case outcomes
└─ Reviews/Feedback
   └─ Municipality feedback (if available)

TAB: CONTACT
├─ Primary Contact
│  ├─ Name
│  ├─ Role
│  ├─ Email
│  └─ Phone
├─ Address
│  └─ Full address + map
└─ Office Hours

ACTION BUTTONS:
├─ "Selecteer voor Matching" (primary)
├─ "Contact opnemen" (secondary)
└─ "Markeer als favoriet" (outline)
```

---

### 🔵 Netwerk Section