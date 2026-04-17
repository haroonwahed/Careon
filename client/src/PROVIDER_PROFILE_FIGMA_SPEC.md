# Provider Profile Page - Figma Design Specification

## 🎯 Page Layout

### Desktop (1920x1080)

```
┌──────────────────────────────────────────────────────────────────┐
│                    TOP BAR (Height: 64px)                        │
├──────────────────────────────────┬───────────────────────────────┤
│                                  │                               │
│  LEFT COLUMN                     │  RIGHT COLUMN (SIDEBAR)       │
│  Width: 66.67% (~1280px)         │  Width: 33.33% (~640px)      │
│  Max width: 800px                │  Sticky top: 80px             │
│  Padding: 24px                   │  Padding: 24px                │
│  Overflow: Scroll                │  Overflow: Hidden             │
│                                  │                               │
└──────────────────────────────────┴───────────────────────────────┘

Container Max Width: 1400px (7xl)
Centered on page
```

---

## 📐 Component Measurements

### Top Bar

```
Height: 64px
Padding: 16px 24px
Border bottom: 1px solid rgba(255,255,255,0.10)
Background: Card
Position: Sticky, top: 0, z-index: 30

Layout: Horizontal, Space between
├─ Left: Back Button
└─ Right: Context Info
   ├─ Case ID (if matching)
   └─ Match Score Badge
```

**Back Button:**
```
Padding: 8px 16px
Gap: 8px
Border radius: 6px
Hover: bg-primary/10

Icon: ArrowLeft, 16x16px
Text: Inter Regular 14px
```

**Match Score Badge:**
```
Width: 72px
Height: 40px
Padding: 8px 12px
Border: 2px solid Green/30%
Background: Green/10%
Border radius: 8px

Score:
  Font: Inter Bold 18px
  Color: Green #22C55E
  Align: Center
```

---

### Provider Header

```
┌────────────────────────────────────────────────────────────┐
│ ← 24px padding all sides                                   │
│                                                            │
│ [Provider Name]                            [Capacity Badge]│  ← Row 1
│ ↕ 8px gap                                                 │
│ [📍 Region  🏢 Type  ⭐ Rating]                           │  ← Row 2
│ ↕ 16px gap                                                │
│ [Tags: Jeugdzorg, Specialistisch, Trauma]                │  ← Row 3
│                                                            │
└────────────────────────────────────────────────────────────┘

Dimensions:
  Width: Fill container
  Padding: 24px
  Border radius: 8px
  Border: 1px solid Border
  Background: Card
```

**Provider Name:**
```
Font: Inter Bold 30px (text-3xl)
Line height: 36px
Color: Foreground #FFFFFF
```

**Metadata Row:**
```
Layout: Horizontal
Gap: 12px
Align: Center

Each Item:
  Icon: 14x14px, Muted
  Text: Inter Regular 14px, Muted
  Gap: 6px
```

**Tags:**
```
Layout: Horizontal, Wrap
Gap: 8px

Each Tag:
  Padding: 6px 12px
  Border radius: 20px (full pill)
  Background: Semantic/10%
  Border: None
  
  Text:
    Font: Inter Semibold 12px
    Color: Semantic (purple/blue/green)
```

**Capacity Badge:**
```
Position: Absolute, Top-right of header
Width: Auto
Padding: 8px 16px
Border: 2px solid Semantic/30%
Background: Semantic/10%
Border radius: 8px

Status Label:
  Font: Inter Semibold 11px
  Transform: Uppercase
  Letter spacing: 0.5px
  Color: Semantic
  
Capacity Text:
  Font: Inter Regular 12px
  Color: Muted
  Margin top: 4px
```

---

### Quick Summary

```
Use component: AI / Block / Samenvatting

Width: Fill container
Items: 4-5 bullets
Icon size: 14px
Text size: 14px
Gap between items: 10px

See: /components/ai/Samenvatting.tsx
```

---

### "Why This Provider?" Section

```
┌────────────────────────────────────────────────────────────┐
│ ← 24px padding                                             │
│                                                            │
│ 🎯 Waarom deze aanbieder?                    ← Title      │
│ ↕ 16px gap                                                │
│ [Match Explanation Component]                             │
│                                                            │
└────────────────────────────────────────────────────────────┘

Use component: AI / Block / Match

Settings:
  Score: From props
  Confidence: High/Medium/Low
  Show full layout (not compact)
  
See: /components/ai/MatchExplanation.tsx
```

---

### Collapsible Section

```
┌────────────────────────────────────────────────────────────┐
│  HEADER (Clickable)                                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ← 24px padding                              ← 24px → │ │
│  │ ↕ 20px padding                                       │ │
│  │                                                      │ │
│  │ [Icon] Section Title              [ChevronDown]     │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  CONTENT (when expanded)                                   │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ ← 24px padding                                       │ │
│  │ ↕ 24px padding                                       │ │
│  │ Border top: 1px solid Border                         │ │
│  │                                                      │ │
│  │ [Content]                                            │ │
│  │                                                      │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

Header:
  Padding: 20px 24px
  Cursor: Pointer
  Hover: bg-muted/20
  
  Icon: 20x20px, Primary
  Title: Inter Bold 18px, Foreground
  Chevron: 20x20px, Muted
  Gap: 12px
  
Content:
  Padding: 24px (top) 24px (horizontal) 24px (bottom)
  Border top: 1px solid Border
  
Transition:
  Duration: 200ms
  Easing: ease-in-out
```

---

### Capacity & Availability Card (Sidebar)

```
┌─────────────────────────────────┐
│ ← 20px padding                  │
│ ↕ 20px padding                  │
│                                 │
│ 📅 Beschikbaarheid ← Header    │
│ ↕ 16px gap                      │
│                                 │
│ [Status Item]                   │
│ ↕ 16px gap                      │
│ [Status Item]                   │
│ ↕ 16px gap                      │
│ [Status Item]                   │
│ ↕ 16px gap                      │
│ [Status Item]                   │
│ ↕ 24px gap                      │
│                                 │
│ [CTA Button]                    │
│                                 │
└─────────────────────────────────┘

Dimensions:
  Width: Fill sidebar
  Padding: 20px
  Border radius: 8px
  Border: 1px solid Border
  Background: Card
  Position: Sticky, top: 96px

Header:
  Icon: 16x16px
  Text: Inter Bold 14px
  Gap: 8px
```

**Status Item:**
```
Layout: Vertical
Gap: 4px

Label:
  Font: Inter Regular 11px
  Color: Muted
  
Value:
  Font: Inter Semibold 14px
  Color: Foreground or Semantic
  
  With Icon (optional):
    Icon: 14x14px, Semantic
    Gap: 6px
    Layout: Horizontal
```

**CTA Button:**
```
Width: Fill container
Height: 44px
Padding: 0 20px
Background: Primary #8B5CF6
Border radius: 6px
Font: Inter Semibold 14px
Color: White

Hover: bg-primary/90
Active: scale(0.98)
```

---

### Mini Map Component

```
┌─────────────────────────────────┐
│ Map Visualization               │
│ Height: 192px (12rem)           │
│ Border radius: 8px              │
│ Border: 1px solid Border        │
│ Background: Muted/20%           │
│ Position: Relative              │
│                                 │
│ [Center Pin with Animation]     │
│                                 │
│ [Region Label Overlay]          │
│ [Distance Badge]                │
│                                 │
└─────────────────────────────────┘

Pin:
  Size: 48x48px
  Color: Primary
  Position: Absolute, Center
  Fill: currentColor
  Drop shadow: 0 4px 12px rgba(0,0,0,0.3)
  
  Animation:
    Pulse ring: opacity 0.3, scale 1.2
    Duration: 2s infinite

Region Label:
  Position: Absolute, bottom: 12px, left: 12px, right: 12px
  Padding: 8px 12px
  Background: Card/90% + backdrop blur
  Border: 1px solid Border
  Border radius: 8px
  
  Label: Inter Regular 11px, Muted
  Value: Inter Semibold 14px, Foreground

Distance Badge (if provided):
  Position: Absolute, top: 12px, right: 12px
  Padding: 4px 12px
  Background: Primary/90%
  Border: 1px solid Primary/30%
  Border radius: 8px
  
  Text: Inter Bold 12px, White
```

---

### Contact Info Card

```
┌─────────────────────────────────┐
│ Contact & Verwijzing            │
│                                 │
│ [Contact Person Block]          │
│ ↕ 12px gap                      │
│ [Phone Link]                    │
│ ↕ 8px gap                       │
│ [Email Link]                    │
│ ↕ 12px gap                      │
│ [Divider]                       │
│ ↕ 12px gap                      │
│ [Referral Info]                 │
│                                 │
└─────────────────────────────────┘

Contact Person:
  Name: Inter Semibold 14px, Foreground
  Title: Inter Regular 11px, Muted
  Gap: 2px

Link Items:
  Layout: Horizontal
  Gap: 8px
  Padding: 8px
  Border radius: 6px
  Hover: bg-muted/30
  
  Icon: 14x14px, Muted
  Text: Inter Regular 14px, Primary
  Hover: Underline

Divider:
  Height: 1px
  Background: Border
```

---

### Documents List

```
Each Document Link:
  Padding: 8px
  Border radius: 6px
  Hover: bg-muted/30
  Cursor: Pointer
  
  Layout: Horizontal
  Gap: 8px
  Align: Center
  
  Icon: FileText, 14x14px, Primary
  Text: Inter Regular 14px, Foreground
  
  Transition: 150ms ease
```

---

## 🎨 Color Specifications

### Capacity Status

```
Available (>30% spots):
  Dot: #22C55E
  Text: #22C55E
  Border: rgba(34, 197, 94, 0.30)
  Background: rgba(34, 197, 94, 0.10)

Limited (1-30% spots):
  Dot: #F59E0B
  Text: #F59E0B
  Border: rgba(245, 158, 11, 0.30)
  Background: rgba(245, 158, 11, 0.10)

Full (0% spots):
  Dot: #EF4444
  Text: #EF4444
  Border: rgba(239, 68, 68, 0.30)
  Background: rgba(239, 68, 68, 0.10)
```

### Tag Colors

```
Primary (Jeugdzorg):
  Background: rgba(139, 92, 246, 0.10)
  Text: #8B5CF6

Secondary (Specialistisch):
  Background: rgba(59, 130, 246, 0.10)
  Text: #3B82F6

Tertiary (Trauma, etc):
  Background: rgba(34, 197, 94, 0.10)
  Text: #22C55E
```

### Interactive States

```
Collapsible Header Default:
  Background: Transparent
  
Collapsible Header Hover:
  Background: rgba(255, 255, 255, 0.05)
  Transition: 200ms ease
  
Links Hover:
  Background: rgba(255, 255, 255, 0.08)
  Text decoration: Underline
  Transition: 150ms ease
```

---

## 📏 Spacing System

```
Page Layout:
  Container max width: 1400px
  Container padding: 24px
  Column gap: 24px

Cards:
  Padding large: 24px
  Padding standard: 20px
  Padding small: 16px
  Border radius: 8px
  Border width: 1px

Sections:
  Gap between: 24px
  Internal gap: 16px

Lists:
  Item gap: 12px
  Bullet gap: 8px

Components:
  Icon-text gap: 8px
  Button gap: 12px
  Tag gap: 8px
```

---

## 🔤 Typography Scale

```
Page Title (Provider Name):
  Font: Inter Bold
  Size: 30px (text-3xl)
  Line: 36px (120%)
  Color: #FFFFFF

Section Headers (Collapsible):
  Font: Inter Bold
  Size: 18px (text-lg)
  Line: 28px (155%)
  Color: #FFFFFF

Subsection Headers:
  Font: Inter Semibold
  Size: 14px (text-sm)
  Line: 20px (143%)
  Color: #FFFFFF

Body Text:
  Font: Inter Regular
  Size: 14px (text-sm)
  Line: 22px (157%)
  Color: rgba(255, 255, 255, 0.60)

Small Text:
  Font: Inter Regular
  Size: 12px (text-xs)
  Line: 18px (150%)
  Color: rgba(255, 255, 255, 0.60)

Tiny Text (Labels):
  Font: Inter Regular
  Size: 11px
  Line: 16px (145%)
  Color: rgba(255, 255, 255, 0.60)

Tags:
  Font: Inter Semibold
  Size: 12px (text-xs)
  Line: 16px
  Color: Semantic

Buttons:
  Font: Inter Semibold
  Size: 14px (text-sm)
  Color: #FFFFFF
```

---

## 🎬 Interactive States & Animations

### Collapsible Sections

**Collapsed:**
```
Header:
  Icon: ChevronDown
  Content: display: none
  
Transition: None (instant)
```

**Expanded:**
```
Header:
  Icon: ChevronUp (rotated 180deg)
  
Content:
  Opacity: 0 → 1 (200ms)
  Max-height: 0 → auto (200ms)
  
Transition: 
  Timing: ease-in-out
  Duration: 200ms
```

**Hover (Always):**
```
Header background: rgba(255, 255, 255, 0.05)
Transition: 200ms ease
Cursor: pointer
```

---

### Link Hover States

**Phone/Email Links:**
```
Default:
  Text color: Primary #8B5CF6
  Background: Transparent
  Text decoration: None

Hover:
  Background: rgba(255, 255, 255, 0.08)
  Text decoration: Underline
  Transition: 150ms ease

Active:
  Background: rgba(255, 255, 255, 0.12)
```

---

### Button States

**CTA Button:**
```
Default:
  Background: #8B5CF6
  Color: #FFFFFF
  Border: None
  
Hover:
  Background: rgba(139, 92, 246, 0.90)
  Transform: None
  
Active/Pressed:
  Transform: scale(0.98)
  Transition: 100ms ease
  
Focus:
  Outline: 2px solid Primary
  Outline offset: 2px
```

---

## 📐 Auto Layout Settings (Figma)

### Page Container

```
Direction: Horizontal
Gap: 24px
Padding: 24px
Align: Top
Max width: 1400px
Centered: True
```

### Left Column

```
Direction: Vertical
Gap: 24px
Padding: 0
Align: Top Left
Width: Fill (66.67%)
Max width: 800px
Overflow: Scroll
```

### Right Column (Sidebar)

```
Direction: Vertical
Gap: 24px
Padding: 0
Align: Top Right
Width: Fill (33.33%)
Position: Sticky, top: 96px
```

### Provider Header

```
Direction: Vertical
Gap: 8px (name to metadata)
       16px (metadata to tags)
Padding: 24px
Align: Top Left
Fill: Horizontal
Hug: Vertical
```

### Collapsible Section Header

```
Direction: Horizontal
Gap: 12px
Padding: 20px 24px
Align: Center (vertical)
Justify: Space between
Fill: Horizontal
Hug: Vertical
```

### Sidebar Cards

```
Direction: Vertical
Gap: 16px (between items)
      24px (before CTA)
Padding: 20px
Align: Top Left
Fill: Horizontal
Hug: Vertical
```

---

## 📱 Responsive Breakpoints

### Desktop (1920px)
```
Layout: Two columns (66.67% / 33.33%)
Max width: 1400px
Padding: 24px
Sidebar: Sticky
All sections: Visible
```

### Laptop (1440px)
```
Layout: Two columns (66.67% / 33.33%)
Max width: 1200px
Padding: 20px
Sidebar: Sticky
```

### Tablet (1024px)
```
Layout: Two columns (60% / 40%)
Max width: 100%
Padding: 16px
Sidebar: Scrollable (not sticky)
Font sizes: Slightly reduced
```

### Mobile (768px and below)
```
Layout: Single column stack
Sidebar: Below main content
Padding: 12px
Sticky CTA: Fixed bottom bar
Collapsible sections: Start collapsed
Header: 2-line layout (name above metadata)
```

---

## ✅ Figma Component Checklist

**Create these components:**

- [ ] Provider Header
  - [ ] Property: Has capacity badge
  - [ ] Property: Capacity status (available/limited/full)

- [ ] Collapsible Section
  - [ ] State: Collapsed / Expanded
  - [ ] Variant: With icon / Without icon

- [ ] Capacity Status Badge
  - [ ] Variant: Available (Green)
  - [ ] Variant: Limited (Amber)
  - [ ] Variant: Full (Red)

- [ ] Capacity Indicator
  - [ ] Property: Available spots (number)
  - [ ] Property: Total spots (number)
  - [ ] Auto-color based on percentage

- [ ] Provider Tag
  - [ ] Variant: Primary (Purple)
  - [ ] Variant: Secondary (Blue)
  - [ ] Variant: Tertiary (Green)

- [ ] Mini Map
  - [ ] With distance badge
  - [ ] Without distance badge

- [ ] Contact Info Card
  - [ ] Link states: Default / Hover

- [ ] Document Link
  - [ ] State: Default / Hover

**Use existing AI components:**

- [x] AI / Block / Samenvatting
- [x] AI / Block / Match

---

## 🎯 Design Principles

**Clarity:**
- Large, clear provider name
- Visual hierarchy with sizing
- Scannable bullet points

**Trust:**
- Professional, structured layout
- Consistent spacing
- High-quality typography

**Decision Support:**
- "Why This Provider?" prominent when relevant
- Capacity always visible (sticky sidebar)
- Clear CTA placement

**No Overload:**
- Collapsible sections reduce cognitive load
- Progressive disclosure
- Only show matching context when relevant

**Scannability:**
- Icons for visual anchors
- Color-coded status indicators
- Clear section headers

---

*This specification ensures a professional, trustworthy provider profile that supports confident decision-making.*
