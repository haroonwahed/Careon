# AI Components - Exact Figma Measurements

## 📐 Quick Reference Spec Sheet

### Component 1: AI / Block / Aanbevolen

```
┌─────────────────────────────────────────────────────────────┐
│ ← 20px →                                     ← 20px →      │
│ ↑                                                           │
│ 20px  ✨ AANBEVOLEN ACTIE         [Gemiddeld vertrouwen]  │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  Start beoordeling ← Inter Bold 16px                  │
│ ↓                                                           │
│ ↑                                                           │
│ 8px   Waarom: Matching is niet mogelijk ← Inter 14px       │
│       zonder urgentie en zorgtype definitie                │
│ ↓                                                           │
│ ↑                                                           │
│ 16px  [Start beoordeling →] ← 40px height, Purple bg       │
│ ↓                                                           │
│ ↑                                                           │
│ 20px  (bottom padding)                                     │
│ ↓                                                           │
└─────────────────────────────────────────────────────────────┘
│←───────────────────────────────────────────────────────────│
             Left border: 4px Purple #8B5CF6
             Card border: 2px rgba(139, 92, 246, 0.40)
             Background: rgba(139, 92, 246, 0.08)
             Border radius: 8px
```

**Frame Properties:**
```
Name: AI / Block / Aanbevolen
Layout: Auto Layout - Vertical
Gap: 12px
Padding: 20px
Stroke: 2px (right/top/bottom), 4px (left)
Fill: rgba(139, 92, 246, 0.08)
Corner radius: 8px
Width: Fill container
Height: Hug contents
```

**Header:**
```
Icon: Sparkles (Lucide), 16x16px
Text: "AANBEVOLEN ACTIE"
  Font: Inter Semibold
  Size: 12px
  Letter spacing: 0.5px (5%)
  Transform: Uppercase
  Color: #8B5CF6
Gap: 8px (between icon and text)
```

**Title:**
```
Font: Inter Bold
Size: 16px
Line height: 24px (150%)
Color: #FFFFFF (foreground)
```

**Explanation:**
```
Font: Inter Regular
Size: 14px
Line height: 22px (157%)
Color: rgba(255, 255, 255, 0.60) (muted)
```

**Button:**
```
Height: 40px
Padding: 0px 20px
Background: #8B5CF6
Border radius: 6px
Text:
  Font: Inter Semibold
  Size: 14px
  Color: #FFFFFF
Icon: ChevronRight, 16x16px
Gap: 8px
```

---

### Component 2: AI / Block / Risico

```
┌─────────────────────────────────────────────────────────────┐
│ ← 16px →                                     ← 16px →      │
│ ↑                                                           │
│ 16px  ⚠️ Risicosignalen                      3 signalen    │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  ┌──────────────────────────────────────────────────┐ │
│       │ ← 10px →                          ← 10px →       │ │
│       │ ↑                                                │ │
│       │ 10px  🔴 Wachttijd overschreden                 │ │
│       │ ↓                                                │ │
│       └──────────────────────────────────────────────────┘ │
│ ↓                                                           │
│ ↑                                                           │
│ 8px   ┌──────────────────────────────────────────────────┐ │
│       │ 🟠 Geen aanbieder beschikbaar                    │ │
│       └──────────────────────────────────────────────────┘ │
│ ↓                                                           │
│ ↑                                                           │
│ 16px  (bottom padding)                                     │
│ ↓                                                           │
└─────────────────────────────────────────────────────────────┘
```

**Frame Properties:**
```
Name: AI / Block / Risico
Layout: Auto Layout - Vertical
Gap: 0 (items have their own container)
Padding: 16px
Stroke: 2px rgba(239, 68, 68, 0.30) [if critical]
Fill: rgba(255, 255, 255, 0.03)
Corner radius: 8px
Width: Fill container
Height: Hug contents
```

**Header:**
```
Icon: AlertTriangle, 16x16px, color based on severity
Text: "Risicosignalen"
  Font: Inter Semibold, 14px
  Color: #FFFFFF
Counter: "3 signalen"
  Font: Inter Regular, 12px
  Color: rgba(255, 255, 255, 0.60)
Margin bottom: 12px
```

**Items Container:**
```
Layout: Auto Layout - Vertical
Gap: 8px
Width: Fill
```

**Signal Item (Critical):**
```
Padding: 10px
Background: rgba(239, 68, 68, 0.10)
Stroke: 1px rgba(239, 68, 68, 0.30)
Corner radius: 6px

Icon: AlertOctagon, 14x14px, #EF4444
Text:
  Font: Inter Regular, 12px
  Line height: 18px
  Color: #EF4444
Gap: 8px
```

---

### Component 3: AI / Block / Samenvatting

```
┌─────────────────────────────────────────────────────────────┐
│ ← 16px →                                     ← 16px →      │
│ ↑                                                           │
│ 16px  📄 Samenvatting                                      │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  ✓ Jongere (14) met complexe problematiek            │
│ ↓                                                           │
│ ↑                                                           │
│ 10px  ℹ️ Zorgtype: Intensieve Ambulante Begeleiding       │
│ ↓                                                           │
│ ↑                                                           │
│ 10px  ⚠️ Urgentie hoog - spoedtraject vereist             │
│ ↓                                                           │
│ ↑                                                           │
│ 16px  (bottom padding)                                     │
│ ↓                                                           │
└─────────────────────────────────────────────────────────────┘
```

**Frame Properties:**
```
Name: AI / Block / Samenvatting
Layout: Auto Layout - Vertical
Gap: 0
Padding: 16px
Stroke: 1px rgba(255, 255, 255, 0.10)
Fill: rgba(255, 255, 255, 0.03)
Corner radius: 8px
Width: Fill container
Height: Hug contents
```

**Header:**
```
Icon: FileText, 16x16px, rgba(255, 255, 255, 0.60)
Text: "Samenvatting"
  Font: Inter Semibold, 14px
  Color: #FFFFFF
Gap: 8px
Margin bottom: 12px
```

**Bullet Items Container:**
```
Layout: Auto Layout - Vertical
Gap: 10px
Width: Fill
```

**Bullet Item:**
```
Layout: Auto Layout - Horizontal
Gap: 10px
Align: Top

Icon: 14x14px
  CheckCircle2 (#22C55E) for success
  Info (#3B82F6) for info
  AlertCircle (#F59E0B) for warning

Text:
  Font: Inter Regular, 14px
  Line height: 22px
  Color: rgba(255, 255, 255, 0.60)
```

---

### Component 4: AI / Block / Match

```
┌─────────────────────────────────────────────────────────────┐
│ ← 16px →                                     ← 16px →      │
│ ↑                                                           │
│ 16px  📈 Waarom deze match?            [94%]  ← Score      │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  🎯 Hoog vertrouwen  ← Confidence badge               │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  Sterke punten  ← Green header                        │
│ ↓                                                           │
│ ↑                                                           │
│ 8px   ✓ Specialisatie match  ← 12px text                  │
│ ↓                                                           │
│ ↑                                                           │
│ 6px   ✓ 3 plekken beschikbaar                             │
│ ↓                                                           │
│ ↑                                                           │
│ 6px   ✓ Reactie binnen 4u                                 │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  Aandachtspunten  ← Amber header                      │
│ ↓                                                           │
│ ↑                                                           │
│ 8px   ⚠️ 15km reisafstand                                  │
│ ↓                                                           │
│ ↑                                                           │
│ 16px  (bottom padding)                                     │
│ ↓                                                           │
└─────────────────────────────────────────────────────────────┘
```

**Frame Properties:**
```
Name: AI / Block / Match
Layout: Auto Layout - Vertical
Gap: 0
Padding: 16px
Stroke: 2px rgba(59, 130, 246, 0.20)
Fill: rgba(59, 130, 246, 0.08)
Corner radius: 8px
Width: Fill container
Height: Hug contents
```

**Header (Horizontal Auto Layout):**
```
Gap: 8px
Justify: Space between

Icon: TrendingUp, 16x16px, #3B82F6
Title: "Waarom deze match?"
  Font: Inter Semibold, 14px
  Color: #FFFFFF

Score Badge:
  Width: 60px
  Height: 32px
  Padding: 6px 12px
  Background: rgba(34, 197, 94, 0.10) [if 90+]
  Stroke: 2px rgba(34, 197, 94, 0.30)
  Corner radius: 8px
  Text: Inter Bold, 24px, #22C55E
  Align: Center
```

**Confidence Indicator:**
```
Padding: 6px 10px
Background: rgba(255, 255, 255, 0.05)
Corner radius: 6px
Icon: Target, 12x12px
Text: Inter Regular, 12px
Gap: 6px
Margin top: 12px
```

**Section: Sterke punten**
```
Title:
  Font: Inter Semibold, 12px
  Color: #22C55E
  Margin bottom: 8px

Items (Auto Layout Vertical, Gap 6px):
  Icon: CheckCircle2, 12x12px, #22C55E
  Text: Inter Regular, 12px, rgba(255, 255, 255, 0.60)
  Gap: 8px
```

**Section: Aandachtspunten**
```
Title:
  Font: Inter Semibold, 12px
  Color: #F59E0B
  Margin top: 12px
  Margin bottom: 8px

Items (Auto Layout Vertical, Gap 6px):
  Icon: AlertCircle, 12x12px, #F59E0B
  Text: Inter Regular, 12px, rgba(255, 255, 255, 0.60)
  Gap: 8px
```

---

### Component 5: AI / Inline / Insight

```
┌─────────────────────────────────────────────────────────────┐
│ ← 12px → ℹ️ Aanbieder Beoordeling gepland voor 18 april ← 12px →    │
│    ↑                                                   ↑    │
│   10px                                                10px  │
│    ↓                                                   ↓    │
└─────────────────────────────────────────────────────────────┘
```

**Frame Properties:**
```
Name: AI / Inline / Insight
Layout: Auto Layout - Horizontal
Gap: 8px
Padding: 10px 12px
Stroke: 1px (based on type)
Fill: Based on type (10% opacity)
Corner radius: 8px
Width: Hug contents
Height: Hug contents
Align: Center
```

**Content:**
```
Icon: 14x14px (type-specific)
Text:
  Font: Inter Regular, 12px
  Line height: 18px
  Color: Type-specific
```

**Variants (Type = Info):**
```
Icon: Info, #3B82F6
Fill: rgba(59, 130, 246, 0.10)
Stroke: rgba(59, 130, 246, 0.30)
Text color: #3B82F6
```

---

### Component 6: AI / Block / Validatie

```
┌─────────────────────────────────────────────────────────────┐
│ ← 16px →                                     ← 16px →      │
│ ↑                                                           │
│ 16px  Validatie                                            │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  ✓ Aanbieder Beoordeling compleet                              │
│ ↓                                                           │
│ ↑                                                           │
│ 8px   ✓ Matching bevestigd                                │
│ ↓                                                           │
│ ↑                                                           │
│ 8px   ⚠️ Wachttijd hoger dan gemiddeld                    │
│ ↓                                                           │
│ ↑                                                           │
│ 12px  Je kunt veilig doorgaan  ← Footer message            │
│ ↓                                                           │
│ ↑                                                           │
│ 16px  (bottom padding)                                     │
│ ↓                                                           │
└─────────────────────────────────────────────────────────────┘
```

**Frame Properties:**
```
Name: AI / Block / Validatie
Layout: Auto Layout - Vertical
Gap: 0
Padding: 16px
Stroke: 2px rgba(34, 197, 94, 0.30) [when ready]
Fill: rgba(34, 197, 94, 0.10)
Corner radius: 8px
Width: Fill container
Height: Hug contents
```

---

### Component 7: AI / Strip / NextAction

```
┌─────────────────────────────────────────────────────────────┐
│ ← 20px →                                         ← 20px →  │
│ ↑                                                     ↑     │
│   Aanbevolen: Werk eerst open beoordelingen   [Button]     │
│ ↓                                                     ↓     │
│                    Height: 56px                             │
└─────────────────────────────────────────────────────────────┘
```

**Frame Properties:**
```
Name: AI / Strip / NextAction
Layout: Auto Layout - Horizontal
Gap: 16px
Padding: 0px 20px
Height: 56px (fixed)
Stroke: 1px rgba(139, 92, 246, 0.40)
Fill: rgba(139, 92, 246, 0.08)
Corner radius: 8px
Width: Fill container
Align: Center
```

**Label:**
```
Font: Inter Semibold, 14px
Color: #FFFFFF
Text: "Aanbevolen:"
```

**Message:**
```
Font: Inter Regular, 14px
Color: rgba(255, 255, 255, 0.60)
Fill container (flex)
```

**Button:**
```
Height: 32px
Padding: 0px 16px
Background: #8B5CF6
Corner radius: 6px
Text: Inter Semibold, 14px, #FFFFFF
```

---

## 🎨 Color Reference

### Purple (Action)
```
Primary:   #8B5CF6
Light 8%:  rgba(139, 92, 246, 0.08)
Light 10%: rgba(139, 92, 246, 0.10)
Border:    rgba(139, 92, 246, 0.40)
```

### Red (Critical)
```
Primary:   #EF4444
Light 10%: rgba(239, 68, 68, 0.10)
Border:    rgba(239, 68, 68, 0.30)
```

### Amber (Warning)
```
Primary:   #F59E0B
Light 10%: rgba(245, 158, 11, 0.10)
Border:    rgba(245, 158, 11, 0.30)
```

### Blue (Info)
```
Primary:   #3B82F6
Light 8%:  rgba(59, 130, 246, 0.08)
Light 10%: rgba(59, 130, 246, 0.10)
Border:    rgba(59, 130, 246, 0.20)
```

### Green (Success)
```
Primary:   #22C55E
Light 10%: rgba(34, 197, 94, 0.10)
Border:    rgba(34, 197, 94, 0.30)
```

### Neutral
```
Foreground: #FFFFFF (dark mode)
Muted:      rgba(255, 255, 255, 0.60)
Border:     rgba(255, 255, 255, 0.10)
Card BG:    rgba(255, 255, 255, 0.03)
```

---

## 📏 Spacing Scale

```
xs:  4px   - Icon internal gaps
sm:  8px   - Between related items
md:  12px  - Between sections
lg:  16px  - Component padding (default)
xl:  20px  - Large component padding
2xl: 24px  - Section gaps
```

---

## 🔤 Typography Scale

```
Header Label (Component headers)
  Font: Inter Semibold
  Size: 12px
  Line: 16px
  Transform: Uppercase
  Letter spacing: +5%

Title (Component titles)
  Font: Inter Bold
  Size: 16px
  Line: 24px

Body (Primary text)
  Font: Inter Regular
  Size: 14px
  Line: 22px

Small (Secondary text)
  Font: Inter Regular
  Size: 12px
  Line: 18px

Button
  Font: Inter Semibold
  Size: 14px

Section Header (Sterke punten, etc)
  Font: Inter Semibold
  Size: 12px
  Line: 16px

Badge/Score
  Font: Inter Bold
  Size: 24px (large) or 12px (small)
```

---

## 🎯 Icon Sizes

```
Component headers:  16x16px
Section icons:      14x14px
Inline icons:       12x14px
Button icons:       16x16px
```

---

## ✅ Figma File Structure

```
📁 Design System
  📁 Tokens
    🎨 Colors
    📐 Spacing
    🔤 Typography
    
  📁 AI Components
    🧱 AI / Block / Aanbevolen
    🧱 AI / Block / Risico
    🧱 AI / Block / Samenvatting
    🧱 AI / Block / Match
    🧱 AI / Block / Validatie
    🧱 AI / Inline / Insight
    🧱 AI / Strip / NextAction
    
  📁 Examples
    📄 All Components Showcase
    📄 Page Layouts
    📄 Mobile Views
```

---

*Use these exact measurements when building components in Figma*
