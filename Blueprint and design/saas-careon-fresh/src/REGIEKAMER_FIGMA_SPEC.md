# Regiekamer Control Center - Figma Design Specification

## 🎯 Design Goal

Transform the Regiekamer from a passive dashboard into an **operational control tower** - a system that actively guides users toward priority actions.

**Feel:** Control cockpit, not reporting interface

---

## 📐 Page Layout

### Desktop (1920x1080)

```
┌──────────────────────────────────────────────────────────────────┐
│ HEADER (Height: auto, ~80px)                                     │
│ Padding: 24px                                                    │
├──────────────────────────────────────────────────────────────────┤
│ AI COMMAND STRIP (Height: auto, ~68px)                          │
│ Full width, prominent                                            │
├──────────────────────────────────────────────────────────────────┤
│ KPI BLOCKS (Height: auto, ~140px)                               │
│ Grid: 6 columns x 1 row, Gap: 16px                              │
├──────────────────────────────────────────────────────────────────┤
│ INLINE AI SIGNALS (Height: auto, conditional)                   │
│ Spacing: 24px from KPIs                                          │
├──────────────────────────────────────────────────────────────────┤
│ FILTER BAR (Height: 48px)                                       │
│ Search + 3 dropdowns                                             │
├──────────────────────────────────────────────────────────────────┤
│ FILTER CHIPS (Height: auto, conditional)                        │
│ "Gefilterd op: ..." with clear button                           │
├──────────────────────────────────────────────────────────────────┤
│ CASE LIST (Height: dynamic, scrollable)                         │
│ Gap between rows: 8px                                            │
│ Bottom padding: 96px (clear space)                               │
└──────────────────────────────────────────────────────────────────┘

Container:
  Max width: 1920px
  Padding: 24px all sides
  Background: Background color
```

---

## 📏 Component Measurements

### Header

```
┌────────────────────────────────────────────────────────────┐
│ ← 0px padding (inside container)                           │
│ ↕ 0px padding                                              │
│                                                            │
│ [Regiekamer]                            [Exporteer rapport]│
│ Casussen die aandacht nodig hebben                        │
│                                                            │
└────────────────────────────────────────────────────────────┘

Layout: Horizontal, Space between
Height: Auto (hug contents)
Margin bottom: 24px

Title:
  Font: Inter Bold 30px (text-3xl)
  Color: Foreground #FFFFFF
  Line height: 36px

Subtitle:
  Font: Inter Regular 14px
  Color: Muted rgba(255,255,255,0.60)
  Margin top: 8px

Button:
  Height: 40px
  Padding: 0 20px
  Border: 1px solid Border
  Background: Transparent
  Icon: Download, 16px
  Gap: 8px
```

---

### AI Command Strip (NEW)

```
┌────────────────────────────────────────────────────────────┐
│ ← 4px purple border                                        │
│ ← 20px padding                                    → 20px → │
│ ↕ 20px padding                                            │
│                                                            │
│ 2 casussen vereisen directe actie • 3 dossiers blokkeren  │
│ matching • Capaciteitstekort in regio Utrecht             │
│                                                            │
│                             [Bekijk urgente casussen →]    │
│                                                            │
└────────────────────────────────────────────────────────────┘

Dimensions:
  Width: Fill container
  Padding: 20px all sides
  Border left: 4px solid Primary #8B5CF6
  Border: 1px solid rgba(139, 92, 246, 0.20)
  Background: rgba(139, 92, 246, 0.05)
  Border radius: 8px
  Margin bottom: 24px

Layout: Horizontal, Space between
Align: Center (vertical)
Gap: 16px

Text Content:
  Font: Inter Regular 14px
  Line height: 22px
  Color: Foreground rgba(255,255,255,0.90)
  
  Clickable segments:
    Font: Inter Semibold 14px
    Color: Semantic (Red #EF4444 or Amber #F59E0B)
    Cursor: Pointer
    Hover: Underline
    
  Separators " • ":
    Color: Muted rgba(255,255,255,0.40)

CTA Button:
  Height: 36px
  Padding: 0 16px
  Background: Red #EF4444 (for urgent) or Primary #8B5CF6
  Border radius: 6px
  Font: Inter Semibold 14px
  Color: White
  Icon: ChevronRight, 14px, right aligned
  Gap: 4px
  
  Hover: bg-red-600 or bg-primary/90
```

---

### KPI Card (Enhanced)

```
┌─────────────────────┐
│ ← 16px padding      │  ← 16px →
│ ↕ 16px padding     │
│                    │
│ [Icon] ●           │  ← Icon left, active dot right (conditional)
│ ↕ 12px gap         │
│                    │
│ 12                 │  ← Value (large)
│ ↕ 4px gap          │
│ Casussen zonder    │  ← Label (small, 2 lines max)
│ match              │
│ ↕ 4px gap          │
│ +2 ↑               │  ← Context (colored)
│                    │
└─────────────────────┘

Dimensions:
  Width: Fill (responsive grid)
  Padding: 16px all sides
  Border radius: 8px
  Border: 1px solid Border (default)
  Border: 2px solid Primary (active state)
  Background: Card rgba(255,255,255,0.03)
  Cursor: Pointer

  Active state:
    Border: 2px solid Primary #8B5CF6
    Shadow: 0 8px 24px rgba(139, 92, 246, 0.20)

Icon Container:
  Size: 40px x 40px
  Padding: 8px
  Border radius: 8px
  Background: Semantic/5%
  
  Icon:
    Size: 18x18px
    Color: Semantic

Active Indicator (top-right):
  Size: 8px x 8px
  Background: Primary #8B5CF6
  Border radius: 50%
  Animation: Pulse
  Position: Absolute, top: 16px, right: 16px

Value:
  Font: Inter Bold 24px (text-2xl)
  Color: Foreground #FFFFFF
  Line height: 32px

Label:
  Font: Inter Regular 11px
  Color: Muted rgba(255,255,255,0.60)
  Line height: 16px
  Max lines: 2
  Overflow: Ellipsis

Context:
  Font: Inter Semibold 11px
  Color: Semantic (based on status)
  Line height: 16px

Hover:
  Transform: scale(1.02)
  Transition: 200ms ease
```

**Status Color Mapping:**
```
Good:
  Icon bg: rgba(34, 197, 94, 0.05)
  Icon color: #22C55E
  Context color: #22C55E

Normal:
  Icon bg: rgba(59, 130, 246, 0.05)
  Icon color: #3B82F6
  Context color: #3B82F6

Warning:
  Icon bg: rgba(245, 158, 11, 0.05)
  Icon color: #F59E0B
  Context color: #F59E0B

Critical:
  Icon bg: rgba(239, 68, 68, 0.05)
  Icon color: #EF4444
  Context color: #EF4444
```

---

### Filter Bar

```
┌────────────────────────────────────────────────────────────┐
│ [Search input...]          [Regio ▼] [Status ▼] [Urgentie ▼]│
└────────────────────────────────────────────────────────────┘

Layout: Horizontal
Gap: 16px
Height: 48px
Margin bottom: 16px (if no filter chips)
Margin bottom: 8px (if filter chips present)

Search Input:
  Width: Flex 1
  Height: 48px
  Padding: 0 16px 0 44px (space for icon)
  Border: 1px solid Border
  Background: Card
  Border radius: 8px
  
  Icon (Search):
    Position: Absolute, left: 16px
    Size: 18x18px
    Color: Muted

  Placeholder:
    Font: Inter Regular 14px
    Color: Muted

Dropdowns (Filters):
  Width: 180px each
  Height: 48px
  Padding: 0 16px
  Border: 1px solid Border
  Background: Card
  Border radius: 8px
  Font: Inter Regular 14px
  Color: Foreground
  
  Arrow icon: Built-in select styling
```

---

### Filter Chips (Conditional)

```
┌────────────────────────────────────────────────────────────┐
│ 🔍 Gefilterd op: [Urgentie: hoog] [Zonder match] [Wis filters]│
└────────────────────────────────────────────────────────────┘

Layout: Horizontal
Gap: 8px
Align: Center
Margin bottom: 16px

Label:
  Font: Inter Regular 14px
  Color: Muted
  Icon: Filter, 14px

Chip:
  Padding: 4px 12px
  Background: Primary/10%
  Border: 1px solid Primary/20%
  Border radius: 6px
  Font: Inter Semibold 12px
  Color: Primary

Clear Button:
  Font: Inter Regular 12px
  Color: Primary
  Hover: Underline
  Cursor: Pointer
```

---

### Case Row

```
┌────────────────────────────────────────────────────────────┐
│ ← 4px urgency border                                       │
│ ← 16px padding                                    → 16px → │
│ ↕ 16px padding                                            │
│                                                            │
│ [ID + Type]   [Status] [Wait] [Risk]   [Next Action] →   │
│ CASE-001      Beoor.   12d    ⚠️        Start beoor.      │
│ Ambulant                                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘

Dimensions:
  Width: Fill container
  Padding: 16px all sides
  Border left: 4px solid (urgency color)
  Border: 1px solid Border
  Background: Card (or tinted for urgent)
  Border radius: 8px
  Cursor: Pointer
  
  Hover:
    Background: rgba(255,255,255,0.05)
    
Grid Layout: 12 columns
  Col 1-3 (25%):  ID + Type
  Col 4-8 (42%):  Status, Wait time, Risk
  Col 9-12 (33%): Next Action

Border Left Colors:
  Critical: #EF4444 (Red, 4px)
  High:     #F59E0B (Amber, 4px)
  Medium:   rgba(59, 130, 246, 0.30) (Blue, 4px)
  Low:      rgba(255,255,255,0.10) (Muted, 4px)

Background Tint (for urgent cases):
  Critical: rgba(239, 68, 68, 0.05)
  High:     rgba(245, 158, 11, 0.05)
```

**Column 1-3: ID + Type**
```
Layout: Vertical
Gap: 4px

ID:
  Font: Inter Semibold 14px
  Color: Foreground
  Hover: Primary (transition 200ms)

Type:
  Font: Inter Regular 12px
  Color: Muted
```

**Column 4-8: Status + Metrics**
```
Layout: Horizontal
Gap: 16px
Align: Center

Status Badge:
  Padding: 4px 8px
  Border radius: 4px
  Background: Semantic/10%
  Font: Inter Semibold 12px
  Color: Semantic
  
  Mapping:
    Intake:       Blue   #3B82F6
    Beoordeling:  Purple #8B5CF6
    Matching:     Amber  #F59E0B
    Plaatsing:    Green  #22C55E
    Geblokkeerd:  Red    #EF4444

Waiting Time:
  Layout: Horizontal
  Gap: 6px
  Align: Center
  
  Icon: Clock, 14x14px
  Color: Red (if > 7 days), Muted (otherwise)
  
  Text:
    Font: Inter Semibold 12px
    Color: Red (if > 7 days), Muted (otherwise)
    Format: "12d"

Risk Icon:
  Size: 16x16px
  Color:
    High:   Red    #EF4444 (AlertCircle)
    Medium: Amber  #F59E0B (AlertCircle)
    Low:    Green  #22C55E (CheckCircle2)
```

**Column 9-12: Next Action**
```
Layout: Horizontal
Gap: 12px
Align: Center
Justify: End

Text Container:
  Layout: Vertical
  Align: Right
  Gap: 2px
  
  Label:
    Font: Inter Regular 11px
    Color: Muted
    Text: "Volgende actie:"
  
  Action:
    Font: Inter Semibold 14px
    Color:
      Urgent:  Red    #EF4444
      Normal:  Foreground
      Waiting: Muted
    Text examples:
      "Start beoordeling"
      "Controleer matching"
      "Wacht op reactie"

Chevron:
  Icon: ChevronRight, 18x18px
  Color: Muted (default)
  Color: Primary (on row hover)
  Transition: 200ms ease
```

---

## 🎨 Color System

### Urgency Colors (Row Border Left)

```
Critical:
  Border: #EF4444 (Red)
  Background tint: rgba(239, 68, 68, 0.05)

High:
  Border: #F59E0B (Amber)
  Background tint: rgba(245, 158, 11, 0.05)

Medium:
  Border: rgba(59, 130, 246, 0.30) (Blue, subtle)
  Background: None

Low:
  Border: rgba(255, 255, 255, 0.10) (Muted)
  Background: None
```

### Status Badge Colors

```
Intake:
  Background: rgba(59, 130, 246, 0.10)
  Text: #3B82F6

Beoordeling:
  Background: rgba(139, 92, 246, 0.10)
  Text: #8B5CF6

Matching:
  Background: rgba(245, 158, 11, 0.10)
  Text: #F59E0B

Plaatsing:
  Background: rgba(34, 197, 94, 0.10)
  Text: #22C55E

Geblokkeerd:
  Background: rgba(239, 68, 68, 0.10)
  Text: #EF4444

Afgerond:
  Background: rgba(255, 255, 255, 0.08)
  Text: rgba(255, 255, 255, 0.60)
```

### KPI Status Colors

```
Good (positive trend):
  Icon background: rgba(34, 197, 94, 0.05)
  Icon: #22C55E
  Context text: #22C55E

Normal (neutral):
  Icon background: rgba(59, 130, 246, 0.05)
  Icon: #3B82F6
  Context text: #3B82F6

Warning (attention needed):
  Icon background: rgba(245, 158, 11, 0.05)
  Icon: #F59E0B
  Context text: #F59E0B

Critical (urgent):
  Icon background: rgba(239, 68, 68, 0.05)
  Icon: #EF4444
  Context text: #EF4444
```

---

## 📏 Spacing System

```
Page Layout:
  Container padding: 24px
  Section gap: 24px

Command Strip:
  Padding: 20px
  Margin bottom: 24px

KPI Grid:
  Gap: 16px
  Card padding: 16px
  Internal gaps: 12px (icon to value), 4px (value to label)

Filter Bar:
  Height: 48px
  Gap: 16px
  Margin bottom: 16px (or 8px if chips)

Filter Chips:
  Gap: 8px
  Chip padding: 4px 12px
  Margin bottom: 16px

Case List:
  Row gap: 8px
  Row padding: 16px
  Column gap: 16px
  Bottom padding: 96px
```

---

## 🔤 Typography Scale

```
Page Title:
  Font: Inter Bold
  Size: 30px (text-3xl)
  Line: 36px
  Color: #FFFFFF

Section Headers:
  Font: Inter Bold
  Size: 18px (text-lg)
  Line: 28px
  Color: #FFFFFF

KPI Value:
  Font: Inter Bold
  Size: 24px (text-2xl)
  Line: 32px
  Color: #FFFFFF

Case ID:
  Font: Inter Semibold
  Size: 14px (text-sm)
  Line: 20px
  Color: #FFFFFF

Next Action:
  Font: Inter Semibold
  Size: 14px (text-sm)
  Line: 20px
  Color: Semantic

Body Text:
  Font: Inter Regular
  Size: 14px (text-sm)
  Line: 22px
  Color: rgba(255,255,255,0.90)

Small Text:
  Font: Inter Regular
  Size: 12px (text-xs)
  Line: 18px
  Color: rgba(255,255,255,0.60)

Tiny Text (Labels):
  Font: Inter Regular
  Size: 11px
  Line: 16px
  Color: rgba(255,255,255,0.60)

Badges:
  Font: Inter Semibold
  Size: 12px (text-xs)
  Line: 16px
  Color: Semantic
```

---

## 🎬 Interactive States

### Command Strip Segments

```
Default:
  Font: Inter Semibold 14px
  Color: Semantic (Red/Amber)
  Cursor: Pointer

Hover:
  Text decoration: Underline
  Transition: 150ms ease

Click:
  Apply filter
  Visual feedback: Brief scale pulse
```

---

### KPI Cards

```
Default:
  Border: 1px solid rgba(255,255,255,0.10)
  Background: rgba(255,255,255,0.03)
  Transform: scale(1)

Hover:
  Transform: scale(1.02)
  Transition: 200ms ease
  Cursor: Pointer

Active (Clicked):
  Border: 2px solid #8B5CF6
  Shadow: 0 8px 24px rgba(139, 92, 246, 0.20)
  Active dot: Visible, pulsing

Press:
  Transform: scale(0.98)
  Transition: 100ms ease
```

---

### Case Rows

```
Default:
  Border: 1px solid rgba(255,255,255,0.10)
  Border left: 4px solid (urgency color)
  Background: rgba(255,255,255,0.03) or tinted

Hover:
  Background: rgba(255,255,255,0.05)
  Cursor: Pointer
  
  Changes:
    Case ID color: #8B5CF6
    Chevron color: #8B5CF6
  
  Transition: 200ms ease

Click:
  Navigate to case detail
  Visual: Brief flash or scale effect
```

---

## 🎨 Animations

### KPI Active Dot

```
Animation: Pulse
Duration: 2s
Iteration: Infinite
Easing: ease-in-out

Keyframes:
  0%:   opacity: 1, scale: 1
  50%:  opacity: 0.5, scale: 1.2
  100%: opacity: 1, scale: 1
```

### Hover Transitions

```
All interactive elements:
  Transition properties:
    transform: 200ms ease
    background-color: 200ms ease
    color: 200ms ease
    border-color: 200ms ease
```

### Filter Application

```
When filter applied:
  1. KPI gets active state (instant)
  2. Case list fades out (100ms)
  3. Case list updates (re-render)
  4. Case list fades in (200ms)
  5. Filter chips appear (slide in from left, 150ms)
```

---

## 📐 Auto Layout Settings (Figma)

### Page Container

```
Direction: Vertical
Gap: 24px
Padding: 24px
Align: Top Left
Max width: 1920px
```

### Command Strip

```
Direction: Horizontal
Gap: 16px
Padding: 20px
Align: Center (vertical)
Justify: Space between
Fill: Horizontal
Hug: Vertical
```

### KPI Grid

```
Direction: Horizontal (use Grid layout plugin)
Columns: 6
Gap: 16px
Fill: Horizontal
Hug: Vertical
```

### Filter Bar

```
Direction: Horizontal
Gap: 16px
Align: Center
Fill: Horizontal
Height: 48px (fixed)
```

### Case Row

```
Direction: Horizontal (or use Grid with 12 columns)
Gap: 16px
Padding: 16px
Align: Center (vertical)
Fill: Horizontal
Hug: Vertical
```

---

## 📱 Responsive Breakpoints

### Desktop (1920px)
```
KPIs: 6 columns
Case row: Full grid (ID, Status, Metrics, Action)
Command strip: Single line
All features visible
```

### Laptop (1440px)
```
KPIs: 3 columns x 2 rows
Case row: Full grid
Command strip: May wrap text
```

### Tablet (1024px)
```
KPIs: 2 columns x 3 rows
Case row: Simplified grid
  - ID + Status
  - Metrics + Action
Command strip: Stacked, button below
```

### Mobile (375px)
```
KPIs: 1 column (cards)
Case row: Card layout
  - ID + Status (row 1)
  - Next action (row 2, prominent)
  - Metrics (row 3, small)
Command strip: Stacked, no button
Filters: Stacked vertically
```

---

## ✅ Figma Component Checklist

**Create these components:**

- [ ] AI Command Strip
  - [ ] Variant: With CTA
  - [ ] Variant: Without CTA
  - [ ] Property: Urgent segments (text)

- [ ] Enhanced KPI Card
  - [ ] State: Default
  - [ ] State: Active
  - [ ] Property: Status (good/normal/warning/critical)
  - [ ] Property: Icon type
  - [ ] Property: Value (number)
  - [ ] Property: Context text

- [ ] Case Row
  - [ ] Variant: Critical urgency
  - [ ] Variant: High urgency
  - [ ] Variant: Medium urgency
  - [ ] Variant: Low urgency
  - [ ] Property: Status
  - [ ] Property: Next action type

- [ ] Filter Chip
  - [ ] Default state
  - [ ] With close icon

**Use existing AI components:**

- [x] AI / Inline / Insight (for inline signals)

---

## 🎯 Design Principles

**Operational Feel:**
- Reduce dashboard aesthetics
- Increase control tower vibes
- Urgent items visually prominent
- Clear action hierarchy

**Active Communication:**
- System speaks (command strip)
- Metrics have context (+2, ↑ boven norm)
- Next actions explicit

**Guided Navigation:**
- Clickable intelligence
- Visual prioritization
- Clear pathways to action

---

*This specification creates a true operational control center, not a passive dashboard.*
