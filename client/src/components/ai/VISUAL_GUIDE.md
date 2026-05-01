# AI Components - Visual Reference Guide

## Component Anatomy

### 1. AanbevolenActie (Recommended Action)

```
┌────────────────────────────────────────────────────────┐
│ ✨ AANBEVOLEN ACTIE              [Confidence Badge]   │ ← Header
│                                                        │
│ Start matching proces                                  │ ← Title (bold)
│                                                        │
│ Casus is compleet. 3 matches klaar.                   │ ← Explanation
│                                                        │
│ ┌──────────────────┐                                  │
│ │ Start matching → │                                  │ ← CTA Button
│ └──────────────────┘                                  │
└────────────────────────────────────────────────────────┘

Border: Purple (default) or Red (urgent)
Background: Purple/5 or Red/5
Padding: 20px
```

---

### 2. Risicosignalen (Risk Signals)

```
┌────────────────────────────────────────────────────────┐
│ ⚠️  Risicosignalen                          3 signalen │ ← Header
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🔴 Geen beschikbare capaciteit in regio         │ │ ← Critical
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🟠 Urgente casus met trage reactie              │ │ ← Warning
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🔵 Monitor wekelijks voor escalatie             │ │ ← Info
│ └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘

Border: Red (if critical) or Amber (if warnings only)
Each signal: Icon + Message
Text size: 12px
```

---

### 3. Samenvatting (Summary)

```
┌────────────────────────────────────────────────────────┐
│ 📄 Samenvatting                                         │ ← Header
│                                                        │
│ ✓ 15 jaar, woonachtig in Amsterdam                    │ ← Success item
│                                                        │
│ ℹ️ Zorgvraag: Intensieve Ambulante Begeleiding        │ ← Info item
│                                                        │
│ ⚠️ Hoge urgentie                                       │ ← Warning item
│                                                        │
│ ✓ Beoordeling gepland                                 │ ← Default item
└────────────────────────────────────────────────────────┘

Icon: 14px (left aligned)
Text: 14px, muted-foreground
Spacing: 10px between items
Max items: 3-5 bullets
```

---

### 4. MatchExplanation

```
┌────────────────────────────────────────────────────────┐
│ 📈 Waarom deze match?                      ┌────────┐ │
│                                             │  94%   │ │ ← Score badge
│                                             └────────┘ │
│ 🎯 Hoog vertrouwen                                    │ ← Confidence
│                                                        │
│ Sterke punten                                         │
│ ✓ Specialisatie match                                │
│ ✓ 3 plekken beschikbaar                              │
│ ✓ Reactie binnen 4u                                  │
│                                                        │
│ Aandachtspunten                                       │
│ ⚠️ 15km reisafstand                                   │
│ ⚠️ Groepstherapie wachtlijst (2-3w)                   │
└────────────────────────────────────────────────────────┘

Background: Blue/5
Border: Blue/20
Score colors:
  90-100% = Green
  75-89%  = Amber
  <75%    = Red
```

---

### 5. SystemInsight (Inline Strip)

```
┌────────────────────────────────────────────────────────┐
│ ℹ️ Beoordeling gepland op 18 april                    │
└────────────────────────────────────────────────────────┘

Types & Colors:
  info       → Blue    (ℹ️)
  warning    → Amber   (⚠️)
  success    → Green   (✓)
  blocked    → Red     (✕)
  suggestion → Purple  (💡)

Height: Auto
Padding: 10-12px
Border radius: 8px
```

---

## Layout Patterns

### 3-Column Grid Layout

```
┌──────────────────────────────────────────────────────────────────┐
│                         FULL WIDTH                               │
│  🤖 Aanbevolen Actie                                            │
│                                                                  │
├────────────────┬─────────────────────┬─────────────────────────┤
│   4 COLS       │      5 COLS         │       3 COLS            │
│                │                     │                         │
│  Left Panel    │  Center/Main        │  Right Panel            │
│                │                     │  (AI Insights)          │
│  • Case info   │  • Samenvatting 🤖 │  • Risicosignalen 🤖  │
│  • Details     │  • Work area        │  • Status               │
│  • Contact     │  • SystemInsight 🤖│  • Suggestions          │
│                │                     │                         │
└────────────────┴─────────────────────┴─────────────────────────┘

Breakpoint: xl (1280px)
On mobile: Stack vertically
Gap: 24px (gap-6)
```

---

## Color Semantics

### Purple (#8B5CF6)
- **Use for**: Actions, recommendations, suggestions
- **Components**: AanbevolenActie, SystemInsight (suggestion)
- **Meaning**: "Take action", "Recommended next step"

### Red (#EF4444)
- **Use for**: Critical issues, blocking problems
- **Components**: Risicosignalen (critical), SystemInsight (blocked)
- **Meaning**: "Urgent attention required", "Process blocked"

### Amber (#F59E0B)
- **Use for**: Warnings, caution, trade-offs
- **Components**: Risicosignalen (warning), MatchExplanation (tradeoffs)
- **Meaning**: "Be aware", "Consider this"

### Blue (#3B82F6)
- **Use for**: Information, explanations, neutral
- **Components**: MatchExplanation, SystemInsight (info), Samenvatting
- **Meaning**: "Informational", "Explanation"

### Green (#22C55E)
- **Use for**: Success, positive signals, ready state
- **Components**: Samenvatting (success items), validation checks
- **Meaning**: "All good", "Ready to proceed"

---

## Typography Scale

```
Component Titles:   14px  font-semibold  text-foreground
Body Text:          14px  font-normal   text-muted-foreground
Small Text:         12px  font-normal   text-muted-foreground
Button Text:        14px  font-semibold  text-primary-foreground
Scores/Badges:      18-24px font-bold   (semantic color)
```

---

## Spacing System

```
Component Padding:
  Default:  p-4  (16px)
  Large:    p-5  (20px)
  Compact:  p-2.5 (10px)

Vertical Spacing (between components):
  Default:  space-y-4  (16px)
  Compact:  space-y-2  (8px)
  Large:    space-y-6  (24px)

Horizontal Grid Gaps:
  Desktop:  gap-6  (24px)
  Mobile:   gap-4  (16px)
```

---

## Icon Usage

### Sizes
- **Component headers**: 16px
- **Inline items**: 14px
- **Small indicators**: 12px

### Common Icons (lucide-react)
- **Sparkles** - AI/recommendation indicator
- **AlertTriangle** - Warnings/risks
- **AlertOctagon** - Critical issues
- **Info** - Information
- **CheckCircle2** - Success/completion
- **Lightbulb** - Suggestions
- **TrendingUp** - Matching/improvement
- **Brain** - AI insights panel header
- **Target** - Confidence indicator

---

## Responsive Behavior

### Desktop (>1280px)
```
3-column grid layout
All components visible
Right sidebar fixed width (25%)
```

### Tablet (768-1279px)
```
2-column or stacked layout
AI insights move below main content
Compact spacing
```

### Mobile (<768px)
```
Single column stack
Priority order:
  1. Aanbevolen Actie
  2. Risicosignalen
  3. Main content
  4. Other AI insights
```

---

## Accessibility

- All icons have semantic meaning (not decorative)
- Color is not the only indicator (icons + text)
- Sufficient contrast ratios (WCAG AA)
- Focus states on interactive elements
- Screen reader friendly component structure

---

## Animation (Subtle)

```css
/* Confidence badge pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

/* Fade in on mount */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Keep animations minimal** - this is an operational system, not a marketing site.

---

## Component Combinations

### High Urgency Case
```
AanbevolenActie (urgent variant)
  +
Risicosignalen (critical signals)
  +
SystemInsight (warning)
```

### Ready for Action
```
AanbevolenActie (default)
  +
Samenvatting
  +
SystemInsight (success)
```

### Matching Flow
```
AanbevolenActie (match recommendation)
  +
MatchExplanation (per provider)
  +
Risicosignalen (if capacity issues)
```

---

## Don'ts ❌

1. **Don't** use chatbot-style bubbles
2. **Don't** use conversational language ("Hi there!")
3. **Don't** overload with too many signals (max 3-4)
4. **Don't** use vague confidence language
5. **Don't** create separate AI page/modal
6. **Don't** use playful/casual tone
7. **Don't** hide critical information
8. **Don't** use distracting animations

---

## Do's ✅

1. **Do** keep text concise (<15 words per bullet)
2. **Do** always explain "why"
3. **Do** use semantic colors consistently
4. **Do** provide clear next actions
5. **Do** embed AI in workflow context
6. **Do** use professional, calm tone
7. **Do** test with real data lengths
8. **Do** follow 3-second comprehension rule
