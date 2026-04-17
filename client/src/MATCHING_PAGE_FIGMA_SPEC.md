# Matching Page - Figma Design Specification

## 🎯 Layout Dimensions

### Desktop (1920x1080)

```
┌──────────────────────────────────────────────────────────────────┐
│                    TOP BAR (Height: 64px)                        │
├────────────────────────────────┬─────────────────────────────────┤
│                                │                                 │
│  LEFT PANEL                    │  RIGHT PANEL                    │
│  Width: 60% (1152px)           │  Width: 40% (768px)            │
│  Padding: 24px                 │  Padding: 0                     │
│  Overflow: Scroll              │  Overflow: Hidden               │
│                                │                                 │
│  Max width: 1200px             │  Fixed position                 │
│  Centered                      │                                 │
│                                │                                 │
└────────────────────────────────┴─────────────────────────────────┘
```

---

## 📐 Component Measurements

### Top Bar

```
Height: 64px
Padding: 16px 24px
Border bottom: 1px solid rgba(255,255,255,0.10)
Background: Card background

Content Layout:
├─ Back Button (Left)
│  ├─ Icon: 16x16px
│  ├─ Text: Inter Regular 14px
│  └─ Gap: 8px
│
└─ Right Section
   ├─ Case Info: Inter Regular 14px, Muted
   ├─ Separator: "·"
   └─ Status Badge:
      ├─ Padding: 6px 12px
      ├─ Border radius: 20px (full pill)
      ├─ Background: Purple/10%
      ├─ Text: Inter Semibold 12px, Purple
      └─ Height: 28px
```

---

### Left Panel - Decision Area

```
Container:
  Width: 60% of viewport (max 1200px)
  Padding: 24px
  Overflow-Y: Auto
  Background: Background color

Content Spacing:
  Gap between sections: 24px
```

---

### Provider Decision Card

```
┌────────────────────────────────────────────────────────────┐
│ ← 20px padding all sides                                   │
│                                                            │
│ [Provider Header]                           [Match Score] │  ← Row 1
│ ↕ 16px gap                                                │
│ [Metrics Grid]                                            │  ← Row 2
│ ↕ 16px gap                                                │
│ [Match Explanation Component]                             │  ← Row 3
│ ↕ 16px gap                                                │
│ [Action Buttons]                                          │  ← Row 4
│                                                            │
└────────────────────────────────────────────────────────────┘

Dimensions:
  Width: Fill container
  Padding: 20px
  Border radius: 8px
  Border: 2px (default state)
  Border: 2px purple (selected state)
  Background: Card background
  Gap between sections: 16px
```

#### Provider Header (Row 1)

```
Layout: Horizontal, Space between
Height: Auto

Left Side:
  ┌─ Name + Badge (Vertical stack, gap 8px)
  │  ├─ Name: Inter Bold 18px, Foreground
  │  └─ Type: Inter Regular 14px, Muted
  │
  └─ Match Badge:
     ├─ Padding: 4px 8px
     ├─ Border radius: 4px
     ├─ Icon: 12x12px
     ├─ Text: Inter Semibold 12px
     ├─ Gap: 4px
     └─ Background based on type:
        • Best: rgba(34, 197, 94, 0.10)
        • Alternative: rgba(245, 158, 11, 0.10)
        • Risky: rgba(239, 68, 68, 0.10)

Right Side:
  Score Badge:
    Width: 80px
    Height: 48px
    Padding: 8px 12px
    Border radius: 8px
    Border: 2px solid (semantic color)
    Background: (semantic color 10% opacity)
    
    Score:
      Font: Inter Bold 24px
      Color: Semantic (green/amber/red)
      Align: Center
    
    Label:
      Font: Inter Regular 10px
      Color: Muted
      Align: Center
```

#### Metrics Grid (Row 2)

```
Layout: Grid 4 columns, equal width
Gap: 12px

Each Metric Cell:
  Layout: Vertical
  Gap: 4px
  
  Header:
    Layout: Horizontal
    Gap: 4px
    Align: Center
    
    Icon: 12x12px, Muted or Semantic
    Label: Inter Regular 11px, Muted
  
  Value:
    Font: Inter Semibold 14px
    Color: Semantic (based on metric value)
    
Metrics:
  1. Afstand (Distance)
  2. Capaciteit (Capacity)
  3. Rating
  4. Reactie (Response time)
```

#### Match Explanation (Row 3)

```
Use component: AI / Block / Match (compact variant)

Settings:
  Compact: True
  Score: Same as card header
  Confidence: Based on score
  
See: /components/ai/MatchExplanation.tsx
```

#### Action Buttons (Row 4)

```
Layout: Horizontal
Gap: 12px

Primary Button:
  Width: Flex 1
  Height: 40px
  Padding: 0 20px
  Background: Purple Primary
  Border radius: 6px
  Text: Inter Semibold 14px, White
  
Secondary Button:
  Width: Auto
  Height: 40px
  Padding: 0 20px
  Background: Transparent
  Border: 1px solid Border
  Border radius: 6px
  Text: Inter Semibold 14px, Foreground
```

---

### Right Panel - Map Area

```
Container:
  Width: 40% of viewport
  Height: 100% (minus top bar)
  Position: Fixed
  Overflow: Hidden
  Background: Muted/20%

Map:
  Width: 100%
  Height: 100%
  Style: Dark, desaturated
  Minimal labels
```

#### Map Controls Container

```
Position: Absolute
Top: 16px
Right: 16px
Z-index: 10

Layout: Vertical
Gap: 12px
```

#### Radius Selector

```
Container:
  Padding: 12px
  Border radius: 8px
  Border: 1px solid Border
  Background: Card/95% + backdrop blur
  
Header:
  Text: "Radius"
  Font: Inter Regular 11px, Muted
  Margin bottom: 8px

Buttons Row:
  Layout: Horizontal
  Gap: 8px
  
  Each Button:
    Width: 60px
    Height: 32px
    Padding: 0 12px
    Border radius: 6px
    Font: Inter Semibold 12px
    
    Active:
      Background: Purple Primary
      Color: White
      
    Inactive:
      Background: Muted
      Color: Muted Foreground
      Hover: Muted/80%
```

#### Control Buttons (Filter, Reset, Toggle)

```
Each Button:
  Width: 40px
  Height: 40px
  Padding: 0
  Border radius: 8px
  Border: 1px solid Border
  Background: Card/95% + backdrop blur
  
  Icon: 16x16px, Muted Foreground
  
  Hover:
    Background: Card/80%
```

#### Map Legend

```
Position: Centered on map (when empty)
Or: Bottom left corner (when map active)

Container:
  Padding: 16px
  Border radius: 8px
  Background: Card/80% + backdrop blur
  
Layout: Vertical
Gap: 8px

Each Legend Item:
  Layout: Horizontal
  Gap: 8px
  Align: Center
  
  Dot:
    Width: 12px
    Height: 12px
    Border radius: 50%
    Background: Semantic color
    
  Label:
    Font: Inter Regular 12px
    Color: Muted Foreground
```

#### Selected Provider Mini Preview

```
Position: Absolute
Bottom: 16px
Left: 16px
Right: 16px
Z-index: 10

Container:
  Padding: 16px
  Border radius: 8px
  Border: 1px solid Border
  Background: Card/95% + backdrop blur
  
Layout: Horizontal, Space between
Align: Center

Left Content:
  Name: Inter Semibold 14px, Foreground
  Info: Inter Regular 12px, Muted
  Layout: Vertical, Gap 4px

Right Content:
  Button (small):
    Height: 32px
    Padding: 0 16px
    Background: Purple Primary
```

---

## 🎨 Color Specifications

### Match Type Colors

```
Best Match (Green):
  Primary: #22C55E
  Background: rgba(34, 197, 94, 0.10)
  Border: rgba(34, 197, 94, 0.30)

Alternative (Amber):
  Primary: #F59E0B
  Background: rgba(245, 158, 11, 0.10)
  Border: rgba(245, 158, 11, 0.30)

Risky (Red):
  Primary: #EF4444
  Background: rgba(239, 68, 68, 0.10)
  Border: rgba(239, 68, 68, 0.30)
```

### Metric Value Colors

```
Distance:
  ≤10km:  Green (#22C55E)
  ≤20km:  Amber (#F59E0B)
  >20km:  Red (#EF4444)

Capacity:
  Available:    Green (#22C55E)
  Not available: Red (#EF4444)

Rating:
  Always: Green (#22C55E)

Response Time:
  ≤6h:  Green (#22C55E)
  >6h:  Amber (#F59E0B)
```

### Selection States

```
Default Card:
  Border: 2px solid rgba(255,255,255,0.10)
  Background: Card background

Hovered Card:
  Border: 2px solid rgba(139, 92, 246, 0.40)
  Background: Card background

Selected Card:
  Border: 2px solid #8B5CF6
  Background: Card background
  Shadow: 0 8px 32px rgba(139, 92, 246, 0.20)
```

---

## 🎭 Interactive States

### Provider Card States

**Default:**
```
Border: 2px #FFFFFF10
Background: Card BG
Cursor: Pointer
```

**Hover:**
```
Border: 2px Purple/40%
Transform: None (no movement)
Transition: 200ms ease
```

**Selected:**
```
Border: 2px Purple Primary
Shadow: 0 8px 32px Purple/20%
Z-index: 10
```

**Pressed:**
```
Transform: Scale(0.99)
Transition: 100ms ease
```

---

### Map Pin States

**Default:**
```
Size: 40x40px
Background: Semantic color (green/amber/red)
Border radius: 50%
Shadow: 0 2px 8px rgba(0,0,0,0.2)
```

**Hover:**
```
Size: 44x44px (scale 1.1)
Shadow: 0 4px 12px Semantic/50%
Z-index: 10
Transition: 200ms ease
```

**Selected:**
```
Size: 50x50px (scale 1.25)
Ring: 4px solid rgba(139, 92, 246, 0.40)
Shadow: 0 8px 24px Purple/50%
Z-index: 20
Transition: 300ms ease
```

**Pulse (Hover, not selected):**
```
Pseudo-element:
  Position: Absolute
  Size: 100%
  Background: Semantic color
  Opacity: 0.5
  Animation: Ping 1s infinite
```

---

## 📏 Spacing Scale

```
Component Spacing:
  Section gaps:      24px
  Card gap:          16px
  Metric gap:        12px
  Button gap:        12px
  Icon-text gap:     8px
  Badge gap:         4px

Card Internal:
  Padding:           20px
  Section gap:       16px
  Row gap:           12px

Map Controls:
  Control gap:       12px
  Button padding:    12px
  Icon padding:      8px
```

---

## 🔤 Typography Scale

```
Page Title:        Inter Bold 24px
Card Title:        Inter Bold 18px
Section Header:    Inter Semibold 16px
Body:              Inter Regular 14px
Small:             Inter Regular 12px
Tiny:              Inter Regular 11px
Badge:             Inter Semibold 12px
Button:            Inter Semibold 14px
Score:             Inter Bold 24px
```

---

## 🎬 Animations & Transitions

### Card Selection

```
Transition properties:
  border-color: 200ms ease
  box-shadow: 200ms ease
  transform: 100ms ease (on press only)

Timing:
  Hover in:  200ms
  Hover out: 200ms
  Select:    300ms
```

### Map Pin

```
Transition properties:
  transform: 200ms cubic-bezier(0.4, 0, 0.2, 1)
  box-shadow: 200ms ease

Scale values:
  Default:   scale(1.0)
  Hover:     scale(1.1)
  Selected:  scale(1.25)
```

### Map Centering

```
When card clicked:
  Map pans to pin location
  Duration: 500ms
  Easing: ease-in-out
```

---

## 📐 Auto Layout Settings (Figma)

### Left Panel Container

```
Direction: Vertical
Gap: 24px
Padding: 24px
Align: Top
Hug: Horizontal
Fill: Vertical
```

### Provider Card

```
Direction: Vertical
Gap: 16px
Padding: 20px
Align: Top Left
Fill: Horizontal
Hug: Vertical
```

### Card Header

```
Direction: Horizontal
Gap: 16px
Padding: 0
Align: Center (vertical)
Justify: Space between
Fill: Horizontal
Hug: Vertical
```

### Metrics Grid

```
Direction: Horizontal
Gap: 12px
Padding: 0
Align: Top
Distribute: Equal
Fill: Horizontal
Hug: Vertical
```

### Button Row

```
Direction: Horizontal
Gap: 12px
Padding: 0
Align: Center
Fill: Horizontal
Hug: Vertical
```

---

## 📱 Responsive Breakpoints

### Desktop (1920px)
```
Left:  60% (1152px)
Right: 40% (768px)
Padding: 24px
```

### Laptop (1440px)
```
Left:  60% (864px)
Right: 40% (576px)
Padding: 20px
```

### Tablet (1024px)
```
Layout: Vertical stack
Map: Top, 400px height
List: Below, scrollable
Padding: 16px
```

### Mobile (375px)
```
Layout: Vertical stack
Map: Collapsible
Cards: Full width
Padding: 12px
Metrics: 2x2 grid
```

---

## ✅ Figma Component Checklist

**Create these components:**

- [ ] Provider Decision Card
  - [ ] Variant: Default
  - [ ] Variant: Selected
  - [ ] Variant: Hovered

- [ ] Match Type Badge
  - [ ] Variant: Best (Green)
  - [ ] Variant: Alternative (Amber)
  - [ ] Variant: Risky (Red)

- [ ] Metric Cell
  - [ ] Property: Type (Distance/Capacity/Rating/Response)
  - [ ] Property: Value (Good/Medium/Bad)

- [ ] Map Pin
  - [ ] Variant: Best (Green)
  - [ ] Variant: Alternative (Amber)
  - [ ] Variant: Risky (Red)
  - [ ] State: Default/Hover/Selected

- [ ] Radius Selector
  - [ ] Button variant: Active/Inactive

- [ ] Map Control Button
  - [ ] Icons: Filter/Reset/Toggle/Navigation

- [ ] Mini Provider Preview
  - [ ] Layout: Horizontal

**Use existing AI components:**

- [x] AI / Block / Aanbevolen
- [x] AI / Inline / Insight
- [x] AI / Block / Risico
- [x] AI / Block / Match

---

## 🎯 Design Principles

**Decision-First:**
- Left panel (60%) is dominant
- Map (40%) is supportive
- AI recommendation at top (most prominent)

**Spatial Awareness:**
- Distance visible in metrics
- Map provides geographic context
- Radius control for flexibility

**Calm Interface:**
- No flashy animations
- Smooth, subtle transitions
- Professional color scheme
- Clear visual hierarchy

**Synced Interactions:**
- Card click → map update
- Map click → card scroll
- Hover states synchronized
- Selection state unified

---

*This specification ensures pixel-perfect implementation of the map-enhanced matching page.*
