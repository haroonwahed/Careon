# AI Components - Figma Design System Specification

## 🎯 Core Principle

**One voice. One system. One pattern.**

All AI components must feel like parts of the same intelligent system, not 7 different styles.

---

## 📐 Foundation Tokens

### Colors

```
Purple (Action)
  Primary:   #8B5CF6
  Light:     rgba(139, 92, 246, 0.08)  // Backgrounds
  Border:    rgba(139, 92, 246, 0.40)  // Borders
  
Red (Critical)
  Primary:   #EF4444
  Light:     rgba(239, 68, 68, 0.10)
  Border:    rgba(239, 68, 68, 0.30)
  
Amber (Warning)
  Primary:   #F59E0B
  Light:     rgba(245, 158, 11, 0.10)
  Border:    rgba(245, 158, 11, 0.30)
  
Blue (Info)
  Primary:   #3B82F6
  Light:     rgba(59, 130, 246, 0.08)
  Border:    rgba(59, 130, 246, 0.20)
  
Green (Success)
  Primary:   #22C55E
  Light:     rgba(34, 197, 94, 0.10)
  Border:    rgba(34, 197, 94, 0.30)
  
Neutral
  Foreground:      #FFFFFF (or #0A0A0A for light mode)
  Muted:           rgba(255, 255, 255, 0.60)
  Border:          rgba(255, 255, 255, 0.10)
  Card BG:         rgba(255, 255, 255, 0.03)
```

### Typography

```
Title (Component Headers)
  Font: Inter Semibold
  Size: 14px
  Line height: 20px
  Color: Foreground

Body (Main Text)
  Font: Inter Regular
  Size: 14px
  Line height: 22px
  Color: Muted

Small (Secondary Text)
  Font: Inter Regular
  Size: 12px
  Line height: 18px
  Color: Muted

Button Text
  Font: Inter Semibold
  Size: 14px
  Color: Based on variant
```

### Spacing Scale

```
4px   (xs)  - Icon gaps
8px   (sm)  - Item spacing
12px  (md)  - Component internal spacing
16px  (lg)  - Component padding
20px  (xl)  - Large component padding
24px  (2xl) - Section gaps
```

### Corner Radius

```
8px  - All cards
6px  - Buttons
4px  - Small elements
```

### Icons

```
Size: 14-16px (consistent)
Style: Lucide React (outline style)
Color: Inherit from text or semantic color
```

---

## 🧱 Component 1: AI / Block / Aanbevolen

### Purpose
Primary decision card - tells user what to do next

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│ [Left border: 4px purple]                                  │
│                                                            │
│  ✨ AANBEVOLEN ACTIE                     [Badge]          │  ← 16px top padding
│                                                            │
│  Start beoordeling                                         │  ← Title (bold)
│                                                            │
│  Waarom: Matching is niet mogelijk zonder urgentie        │  ← Explanation
│  en zorgtype definitie                                    │
│                                                            │
│  [Start beoordeling →]                                    │  ← CTA button
│                                                            │
└────────────────────────────────────────────────────────────┘
  20px padding all sides
```

### Measurements

```
Container
  Padding: 20px
  Border radius: 8px
  Border left: 4px solid Purple Primary
  Background: Purple Light
  Border: 2px solid Purple Border

Header
  Icon: Sparkles, 16px, Purple Primary
  Text: "AANBEVOLEN ACTIE"
  Font: Inter Semibold, 12px, uppercase, Purple Primary
  Gap: 8px

Title
  Font: Inter Bold, 16px
  Color: Foreground
  Margin top: 12px
  Margin bottom: 8px

Explanation
  Font: Inter Regular, 14px
  Color: Muted
  Line height: 22px
  Margin bottom: 16px

CTA Button
  Height: 40px
  Padding: 0 20px
  Background: Purple Primary
  Border radius: 6px
  Font: Inter Semibold, 14px
  Icon: ChevronRight, 16px
  Gap: 8px
```

### Variants

**1. Default (with CTA)**
- Full structure as above

**2. Urgent**
- Border color: Red Primary
- Background: Red Light
- Border: Red Border
- Button: Red background
- Icon color: Red

**3. Compact (no CTA)**
- Remove button
- Reduce bottom padding to 16px

**4. Medium Confidence**
- Add badge "Gemiddeld vertrouwen" in top right
- Badge: 10px padding, Muted background, 12px text

### Auto Layout Settings

```
Direction: Vertical
Gap: 12px
Padding: 20px
Align: Left
Hug: Vertical
Fill: Horizontal
```

---

## 🧱 Component 2: AI / Block / Risico

### Purpose
Display risk warnings with severity levels

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│  ⚠️ Risicosignalen                           3 signalen    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔴 Wachttijd overschreden (kritiek)                  │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🟠 Geen aanbieder met directe capaciteit            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ 🔵 Monitor wekelijks voor escalatie                 │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### Measurements

```
Container
  Padding: 16px
  Border radius: 8px
  Border: 2px solid (Red or Amber based on severity)
  Background: Card BG

Header
  Icon: AlertTriangle, 16px
  Title: "Risicosignalen"
  Counter: Small text, right aligned
  Gap: 8px
  Margin bottom: 12px

Signal Item (Critical)
  Padding: 10px
  Border radius: 6px
  Border: 1px solid Red Border
  Background: Red Light
  Icon: AlertOctagon, 14px, Red Primary
  Text: 12px, Red Primary
  Gap: 8px

Signal Item (Warning)
  Same as Critical but Amber colors

Signal Item (Info)
  Same as Critical but Blue colors

Gap between items: 8px
```

### Variants

**1. Has Critical**
- Container border: Red
- Shows critical items first

**2. Warning Only**
- Container border: Amber
- All warnings

**3. Empty State**
- Show: "Geen risicosignalen 🎯"
- Green tint
- Single line

**4. Compact**
- Reduce padding to 12px
- Smaller gap (6px)

### Auto Layout Settings

```
Container
  Direction: Vertical
  Gap: 0
  Padding: 16px
  Hug: Both

Items List
  Direction: Vertical
  Gap: 8px
  Fill: Horizontal
```

---

## 🧱 Component 3: AI / Block / Samenvatting

### Purpose
Clean bullet-point summary of key information

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│  📄 Samenvatting                                           │
│                                                            │
│  ✓ Jongere (14) met complexe problematiek                 │
│                                                            │
│  ℹ️ Zorgtype: Intensieve Ambulante Begeleiding            │
│                                                            │
│  ⚠️ Urgentie hoog - spoedtraject vereist                  │
│                                                            │
│  ✓ Beoordeling gepland met Dr. P. Bakker                  │
└────────────────────────────────────────────────────────────┘
```

### Measurements

```
Container
  Padding: 16px
  Border radius: 8px
  Border: 1px solid Border
  Background: Card BG

Header
  Icon: FileText, 16px, Muted
  Title: "Samenvatting"
  Font: Inter Semibold, 14px
  Margin bottom: 12px
  Gap: 8px

Bullet Item
  Icon: 14px (left aligned)
    ✓ CheckCircle2 (Green for success)
    ℹ️ Info (Blue for info)
    ⚠️ AlertCircle (Amber for warning)
  Text: Inter Regular, 14px, Muted
  Line height: 22px
  Gap: 10px

Gap between bullets: 10px
```

### Variants

**1. Default (4-5 items)**
- Full structure

**2. Compact (3 items)**
- Smaller gaps (8px)
- Smaller padding (12px)

**3. Inline (no card)**
- Remove background/border
- Just list items

### Auto Layout Settings

```
Container
  Direction: Vertical
  Gap: 0
  Padding: 16px
  Hug: Vertical
  Fill: Horizontal

Items List
  Direction: Vertical
  Gap: 10px
  Align: Left
```

---

## 🧱 Component 4: AI / Block / Match

### Purpose
Explain why a provider match was selected

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│  📈 Waarom deze match?                      [94%]          │
│                                                            │
│  🎯 Hoog vertrouwen                                        │
│                                                            │
│  Sterke punten                                            │
│  ✓ Specialisatie match                                    │
│  ✓ 3 plekken beschikbaar                                  │
│  ✓ Reactie binnen 4u                                      │
│                                                            │
│  Aandachtspunten                                          │
│  ⚠️ 15km reisafstand                                       │
│  ⚠️ Groepstherapie wachtlijst (2-3w)                      │
└────────────────────────────────────────────────────────────┘
```

### Measurements

```
Container
  Padding: 16px
  Border radius: 8px
  Border: 2px solid Blue Border
  Background: Blue Light

Header
  Icon: TrendingUp, 16px, Blue Primary
  Title: "Waarom deze match?"
  Score Badge: Right aligned
    Width: 60px
    Height: 32px
    Border radius: 8px
    Border: 2px solid Green Border (if 90+)
    Background: Green Light
    Text: 24px bold, Green Primary
  Gap: 8px
  Margin bottom: 12px

Confidence Indicator
  Icon: Target, 12px
  Text: "Hoog vertrouwen" / "Gemiddeld vertrouwen"
  Background: Muted background, 8px padding
  Border radius: 6px
  Margin bottom: 12px

Section: Sterke punten
  Title: Inter Semibold, 12px, Green Primary
  Margin bottom: 8px
  Items:
    Icon: CheckCircle2, 12px, Green
    Text: 12px, Muted
    Gap: 8px
  Gap between items: 6px

Section: Aandachtspunten (if exists)
  Title: Inter Semibold, 12px, Amber Primary
  Margin top: 12px
  Margin bottom: 8px
  Items:
    Icon: AlertCircle, 12px, Amber
    Text: 12px, Muted
    Gap: 8px
  Gap between items: 6px
```

### Variants

**1. High Score (90-100%)**
- Score badge: Green
- Border: Blue

**2. Medium Score (75-89%)**
- Score badge: Amber
- Border: Blue

**3. Low Score (<75%)**
- Score badge: Red
- Border: Blue

**4. Compact**
- Remove confidence indicator
- Smaller padding (12px)

### Auto Layout Settings

```
Container
  Direction: Vertical
  Gap: 0
  Padding: 16px
  Hug: Vertical
  Fill: Horizontal

Each Section
  Direction: Vertical
  Gap: 6px
```

---

## 🧱 Component 5: AI / Inline / Insight

### Purpose
Quick inline status message

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│ ℹ️ Beoordeling gepland voor 18 april met Dr. P. Bakker   │
└────────────────────────────────────────────────────────────┘
```

### Measurements

```
Container
  Padding: 10px 12px
  Border radius: 8px
  Border: 1px solid (based on type)
  Background: Based on type
  Height: Auto (fits content)

Content
  Icon: 14px (left)
  Text: Inter Regular, 12px
  Gap: 8px
  Align: Center vertical
```

### Variants

**1. Info**
- Icon: Info, Blue
- Background: Blue Light
- Border: Blue Border
- Text: Blue Primary

**2. Success**
- Icon: CheckCircle2, Green
- Background: Green Light
- Border: Green Border
- Text: Green Primary

**3. Warning**
- Icon: AlertTriangle, Amber
- Background: Amber Light
- Border: Amber Border
- Text: Amber Primary

**4. Blocked**
- Icon: XCircle, Red
- Background: Red Light
- Border: Red Border
- Text: Red Primary

**5. Suggestion**
- Icon: Lightbulb, Purple
- Background: Purple Light
- Border: Purple Border
- Text: Purple Primary

### Auto Layout Settings

```
Direction: Horizontal
Gap: 8px
Padding: 10px 12px
Align: Center
Hug: Both
```

---

## 🧱 Component 6: AI / Block / Validatie

### Purpose
Show validation checklist with status

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│  Validatie                                                 │
│                                                            │
│  ✓ Beoordeling compleet                                   │
│  ✓ Matching bevestigd                                     │
│  ⚠️ Wachttijd hoger dan gemiddeld                         │
│                                                            │
│  Je kunt veilig doorgaan                                  │
└────────────────────────────────────────────────────────────┘
```

### Measurements

```
Container
  Padding: 16px
  Border radius: 8px
  Border: 2px solid Green Border (when all ready)
  Background: Green Light

Header
  Title: "Validatie"
  Font: Inter Semibold, 14px
  Margin bottom: 12px

Check Items
  Icon: 14px
    ✓ CheckCircle2 (Green)
    ⚠️ AlertCircle (Amber)
  Text: 14px, Foreground
  Gap: 8px
  Margin: 8px between items

Footer Message
  Text: Inter Medium, 14px, Green Primary
  Margin top: 12px
  Optional
```

### Variants

**1. All Ready (Green)**
- All checkmarks green
- Green border/background
- Positive message

**2. Mixed State**
- Mix of green/amber
- Border: Neutral or Amber
- Cautious message

**3. Not Ready (Amber)**
- Mostly amber warnings
- Amber border/background
- Warning message

### Auto Layout Settings

```
Direction: Vertical
Gap: 0
Padding: 16px
Hug: Vertical
Fill: Horizontal
```

---

## 🧱 Component 7: AI / Strip / NextAction

### Purpose
Full-width recommendation strip

### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│ Aanbevolen: Werk eerst open beoordelingen af (2 casussen) │
│                                           [Ga naar beoor.] │
└────────────────────────────────────────────────────────────┘
```

### Measurements

```
Container
  Height: 56px
  Padding: 0 20px
  Border radius: 8px
  Background: Purple Light
  Border: 1px solid Purple Border

Content
  Horizontal layout
  Gap: 16px
  Align: Center vertical

Label
  Font: Inter Semibold, 14px
  Color: Foreground
  "Aanbevolen:"

Text
  Font: Inter Regular, 14px
  Color: Muted
  Flex: 1

Button
  Height: 32px (compact)
  Padding: 0 16px
  Background: Purple Primary
  Border radius: 6px
```

### Variants

**1. With Button**
- Full structure

**2. Text Only**
- Remove button
- Center text

### Auto Layout Settings

```
Direction: Horizontal
Gap: 16px
Padding: 0 20px
Height: 56px
Align: Center
Fill: Horizontal
```

---

## 🎨 Design System Rules

### 1. Consistency

**ALL AI blocks MUST use:**
- Same spacing scale (4/8/12/16/20/24px)
- Same typography scale (12/14/16px)
- Same icon set (Lucide, 14-16px)
- Same border radius (8px cards, 6px buttons)
- Same semantic colors

### 2. Tone & Voice

**ALWAYS use:**
- "Aanbevolen" (not "We recommend")
- "Waarom" (not "Reason")
- "Let op" (not "Warning")
- "Overweeg" (not "Consider")

**NEVER use:**
- "AI suggests..."
- "We think..."
- Vague language
- Overly confident claims

### 3. Density Rules

**Per page maximum:**
- 1 primary AI block (Aanbevolen Actie)
- 2 secondary blocks (Risico, Samenvatting)
- Unlimited inline insights (but keep subtle)

### 4. Color Semantics

| Type | Color | Usage |
|------|-------|-------|
| Action | Purple | Recommendations, suggestions |
| Critical | Red | Blocking issues, urgent problems |
| Warning | Amber | Caution, trade-offs |
| Info | Blue | Explanations, neutral info |
| Success | Green | Ready states, validations |

### 5. Hierarchy

```
Primary:    Aanbevolen Actie (biggest, most prominent)
Secondary:  Risico, Samenvatting, Match (medium)
Tertiary:   Inline Insights (smallest, subtle)
```

---

## 📏 Component Matrix

| Component | Width | Padding | Border | Bg Opacity | Icon Size |
|-----------|-------|---------|--------|------------|-----------|
| Aanbevolen | Fill | 20px | 4px left + 2px all | 8% | 16px |
| Risico | Fill | 16px | 2px | 3% | 14px |
| Samenvatting | Fill | 16px | 1px | 3% | 14px |
| Match | Fill | 16px | 2px | 8% | 16px |
| Validatie | Fill | 16px | 2px | 10% | 14px |
| Insight (inline) | Hug | 10-12px | 1px | 10% | 14px |
| NextAction | Fill | 0 20px | 1px | 8% | 16px |

---

## 🔧 Figma Setup Instructions

### Step 1: Create Design Tokens

1. Create **Local Variables** in Figma:
   - Color/Purple/Primary → #8B5CF6
   - Color/Purple/Light → rgba(139, 92, 246, 0.08)
   - Color/Purple/Border → rgba(139, 92, 246, 0.40)
   - (Repeat for Red, Amber, Blue, Green)

2. Create **Text Styles**:
   - AI/Title → Inter Semibold 14px
   - AI/Body → Inter Regular 14px
   - AI/Small → Inter Regular 12px
   - AI/Button → Inter Semibold 14px

3. Create **Effect Styles**:
   - None (cards use borders, not shadows)

### Step 2: Create Base Components

1. Create page: **"Design System"**
2. Create section: **"AI Components"**
3. For each component:
   - Create base frame
   - Set Auto Layout
   - Add content
   - Name: "AI / Block / [Name]"

### Step 3: Add Variants

For each component:
1. Right-click → "Add variant"
2. Create variant properties:
   - **State**: Default, Empty, Loading
   - **Size**: Default, Compact
   - **Severity**: (for Risico/Insight)

### Step 4: Create Component Set

1. Select all variants of one component
2. Right-click → "Combine as variants"
3. Name the component set properly

### Step 5: Test & Document

1. Create example page showing all components
2. Test responsiveness (resize to mobile)
3. Document usage in Figma description

---

## ✅ Component Checklist

When creating each component, verify:

- [ ] Uses design tokens (colors, spacing)
- [ ] Uses text styles (not manual styling)
- [ ] Auto Layout configured correctly
- [ ] Responsive (fills container width)
- [ ] All variants created
- [ ] Proper naming convention
- [ ] Description added
- [ ] Example created
- [ ] Mobile tested
- [ ] Matches code implementation

---

## 📦 Export for Development

After creating components:

1. **For developers:**
   - Export design tokens as CSS variables
   - Export spacing/typography specs
   - Share Figma file with dev mode access

2. **For documentation:**
   - Export component screenshots
   - Export example compositions
   - Create usage guidelines

---

## 🎯 Success Criteria

Your Figma library is successful if:

1. ✅ All 7 components created with variants
2. ✅ Design tokens set up and used
3. ✅ Components work responsively
4. ✅ Naming is consistent
5. ✅ Examples page shows all states
6. ✅ Developers can inspect measurements
7. ✅ One voice, one system, one pattern

---

*This specification matches the React component implementation in `/components/ai/`*
