# Regiekamer Visual Design Guide

## Color Palette

### Primary Colors

```
Dark Background
└─ #0E0E18  →  Base background
└─ #12121C  →  Surface/cards

Purple (Brand)
└─ #8B5CF6  →  Primary actions
└─ #A78BFA  →  Light accent
└─ rgba(139,92,246,0.1)  →  Hover/selected states
```

### Semantic Colors

```
🔴 Critical/Error
└─ #EF4444 (Red)
└─ rgba(239,68,68,0.1)  →  Background
└─ rgba(239,68,68,0.3)  →  Border

🟡 Warning/Delay
└─ #F59E0B (Amber)
└─ rgba(245,158,11,0.1)  →  Background
└─ rgba(245,158,11,0.3)  →  Border

🟢 Success/Positive
└─ #10B981 (Green)
└─ rgba(16,185,129,0.1)  →  Background
└─ rgba(16,185,129,0.3)  →  Border

🔵 Info/Assessment
└─ #3B82F6 (Blue)
└─ rgba(59,130,246,0.1)  →  Background
└─ rgba(59,130,246,0.3)  →  Border

🔷 Placement
└─ #22D3EE (Cyan)
└─ rgba(34,211,238,0.1)  →  Background
└─ rgba(34,211,238,0.3)  →  Border
```

---

## Typography

### Hierarchy

```
H1 - Page Title
└─ text-3xl font-semibold
└─ Example: "Regiekamer"

H2 - Section Title
└─ text-xl font-semibold
└─ Example: "Actieve casussen"

H3 - Card Title
└─ text-lg font-semibold
└─ Example: Provider name

Body - Regular Text
└─ text-sm
└─ Default paragraph text

Small - Meta Info
└─ text-xs text-muted-foreground
└─ Timestamps, labels
```

---

## Spacing System

```
Gaps:
gap-1   →  4px   (tight spacing)
gap-2   →  8px   (compact)
gap-3   →  12px  (standard)
gap-4   →  16px  (comfortable)
gap-6   →  24px  (spacious)

Padding:
p-3     →  12px  (compact cards)
p-4     →  16px  (standard cards)
p-5     →  20px  (detailed sections)
p-6     →  24px  (hero cards)

Margins:
mb-2    →  8px   (small sections)
mb-3    →  12px  (standard sections)
mb-4    →  16px  (major sections)
mb-6    →  24px  (page sections)
```

---

## Component Patterns

### Card Pattern

```tsx
<div className="premium-card p-6">
  {/* Content */}
</div>

// premium-card applies:
// - bg-card
// - border border-border
// - rounded-xl
// - Shadow and backdrop blur
```

### KPI Card Pattern

```tsx
<CareKPICard
  title="Title"
  value={number}
  icon={IconComponent}
  urgency="critical" | "warning" | "normal" | "positive"
/>

Visual:
┌─────────────────────────────────┐
│ Title              [Icon]       │
│ 42                              │
│ ↑ 12% vs last week             │
└─────────────────────────────────┘

Urgency affects:
- Border color
- Value text color
- Icon background color
- Glow effect
```

### Badge Pattern

```tsx
<Badge>
  <Icon /> Label
</Badge>

Anatomy:
[🔴 Icon] Kritiek
│   │      └─ Label text
│   └─ Icon (optional)
└─ Status dot/icon

Sizes:
- sm: px-2 py-0.5 text-xs
- md: px-2.5 py-1 text-sm
```

### Case Row Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│ C-2026-0847                Type        [Status]    8 dagen  →   │
│ Cliënt A.M. · 14j         Intensief    [Urgent]   [Risk]       │
│ Amsterdam                                                        │
└─────────────────────────────────────────────────────────────────┘
   Case ID + Client         Type         Badges     Time   Action
```

---

## Layout Grid

### Regiekamer Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ Header + Search + Filters                                   │
├─────────────────────────────────────────────────────────────┤
│ [KPI] [KPI] [KPI] [KPI] [KPI] [KPI]                       │
├─────────────────────────────────────┬───────────────────────┤
│                                     │ Signalen              │
│ Actieve casussen                    │ [Alert]               │
│ [Case Row]                         │ [Alert]               │
│ [Case Row]                         │                       │
│ [Case Row]                         │ Volgende acties       │
│ [Case Row]                         │ [Action]              │
│ [Case Row]                         │ [Action]              │
│                                     │                       │
│                                     │ Capaciteit            │
│                                     │ [Progress bars]       │
└─────────────────────────────────────┴───────────────────────┘
   70% (2/3 width)                      30% (1/3 width)
```

### Case Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Regiekamer                                        │
├─────────────────────────────────────────────────────────────┤
│ Decision Header                                             │
│ [Case ID] [Status] [Urgency] [Risk]                        │
│ ⚠ Recommendation banner → [Action Button]                  │
├─────────────────────────────────────────────────────────────┤
│ Phase Indicator                                             │
│ ① Casus ──→ ② Beoordeling ──→ ③ Matching ──→ ④ Plaatsing │
├──────────────┬──────────────────┬───────────────────────────┤
│              │                  │                           │
│ Client Info  │  Active Work     │  System Intelligence      │
│ [Details]    │  Area            │  [Risks]                  │
│              │  (Changes by     │  [AI Suggestions]         │
│ Case Details │   phase)         │  [Similar Cases]          │
│ [Timeline]   │                  │                           │
│              │                  │                           │
└──────────────┴──────────────────┴───────────────────────────┘
    1/3 width       1/3 width           1/3 width

                ┌─────────────────┐
                │ Sticky Actions  │ ← Fixed at bottom
                └─────────────────┘
```

### Matching Page

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to case                                              │
├─────────────────────────────────────────────────────────────┤
│ Provider Matching · 3 matches found                         │
│ [Case Summary Box]                                          │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 🟢 Beste match          Jeugdzorg Amsterdam      94  │  │
│ │ [Metrics] [Specializations] [Explanation]            │  │
│ │ [Trade-offs] [Plaats direct]                         │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 🟣 Alternatief          De Brug                  78  │  │
│ │ [Metrics] [Specializations] [Explanation]            │  │
│ │ [Trade-offs] [Plaats]                                │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 🟡 Met risico           Horizon Youth Care       62  │  │
│ │ [Metrics] [Specializations] [Explanation]            │  │
│ │ [Trade-offs] [Plaats met risico]                     │  │
│ └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│ Beslissingsondersteuning                                    │
│ [Recommendations and warnings]                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Interactive States

### Hover States

```css
Cards:
hover:border-primary/40
hover:scale-[1.02]

Buttons:
Primary:
  hover:bg-primary/90

Ghost:
  hover:bg-surface-hover
  hover:text-primary

Case Rows:
  hover:border-primary/40
  group-hover:text-primary
```

### Focus States

```css
focus:ring-2
focus:ring-primary
focus:ring-offset-2
```

### Active/Selected States

```css
bg-primary/15
border-primary/40
text-primary
```

---

## Icon Usage

### Status Icons

```
Intake       → FileText
Assessment   → ClipboardList
Matching     → Search
Placement    → MapPin
Active       → Activity
Completed    → CheckCircle2
Blocked      → XCircle
```

### Action Icons

```
View/Open    → ArrowRight
Back         → ArrowLeft
Confirm      → CheckCircle2
Alert        → AlertCircle
Warning      → AlertTriangle
Info         → Info
```

### System Icons

```
Users        → Users
Time         → Clock
Region       → MapPin
Risk         → Shield / ShieldAlert
Capacity     → TrendingDown
Recommendation → Sparkles / Lightbulb
```

---

## Shadows & Glows

### Card Shadows

```css
Default:
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1)

Elevated:
box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1)

Hero/Focus:
box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1)
```

### Urgency Glows

```css
Critical:
shadow-[0_0_20px_rgba(239,68,68,0.15)]

Warning:
shadow-[0_0_20px_rgba(245,158,11,0.15)]

Positive:
shadow-[0_0_20px_rgba(16,185,129,0.15)]
```

---

## Animation

### Transitions

```css
Standard:
transition-all duration-200

Colors:
transition-colors duration-200

Transform:
transition-transform duration-200

Hover Scale:
hover:scale-[1.02]
hover:scale-[1.01]
```

### Loading States

```css
Spinner:
animate-spin

Pulse:
animate-pulse
```

---

## Responsive Breakpoints

```css
Mobile:
  default (< 640px)

Tablet:
  md: @media (min-width: 768px)

Desktop:
  lg: @media (min-width: 1024px)
  xl: @media (min-width: 1280px)

Grid Adjustments:
- KPIs: grid-cols-1 md:grid-cols-2 xl:grid-cols-6
- Layout: xl:grid-cols-3 (3-column layout on large screens)
- Case Row: grid-cols-12 (12-column grid system)
```

---

## Accessibility

### Contrast Ratios

```
Text on Background:
- Foreground text: 13:1 (AAA)
- Muted text: 7:1 (AA)

Interactive Elements:
- Minimum 4.5:1 for all text
- Minimum 3:1 for large text
```

### Focus Indicators

```css
Always visible:
focus:ring-2 ring-primary ring-offset-2

Never use:
outline: none (without replacement)
```

### Keyboard Navigation

```
Tab Order:
1. Primary actions first
2. Secondary actions
3. Navigation elements

Shortcuts:
- Escape: Close modals/return
- Enter: Confirm actions
- Arrow keys: Navigate lists
```

---

## Best Practices

### Do's ✅

1. **Use color to communicate meaning**
   - Red = urgent/blocked
   - Amber = warning/delay
   - Green = success/low risk

2. **Maintain visual hierarchy**
   - Most important = largest/boldest
   - Actions = purple
   - Information = muted

3. **Provide immediate feedback**
   - Hover states
   - Loading indicators
   - Success confirmations

4. **Be consistent**
   - Same patterns throughout
   - Predictable interactions
   - Unified spacing

### Don'ts ❌

1. **Don't use color alone**
   - Always pair with icons/labels
   - Consider colorblind users

2. **Don't clutter**
   - Use white space
   - Group related items
   - Hide less important details

3. **Don't surprise users**
   - Destructive actions need confirmation
   - Changes should be reversible
   - Clear action outcomes

4. **Don't forget mobile**
   - Touch targets ≥ 44px
   - Readable text sizes
   - Simplified layouts

---

## Component Checklist

When creating new components:

- [ ] Follows color system
- [ ] Respects spacing scale
- [ ] Has hover/focus states
- [ ] Works on mobile
- [ ] Accessible (ARIA, keyboard)
- [ ] Consistent with existing patterns
- [ ] Loading/error states
- [ ] Documentation in code

---

**Last Updated**: April 16, 2026
