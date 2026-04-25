# Matching Page (Enhanced) - AI-Powered Recommendation Engine

## Overview

The **Matching page** is an AI-powered recommendation interface where care coordinators match cases to care providers. This is **NOT a search results page**—it's a decision assistant that:

- Recommends the best provider with clear reasoning
- Explains WHY each provider is suitable
- Highlights trade-offs and risks
- Guides users to confident placement decisions

---

## Design Philosophy

### Mental Model

The page feels like:
> **"A recommendation engine + Decision assistant + Control system"**

NOT:
> ❌ "A search engine"  
> ❌ "A provider directory"  
> ❌ "A static list"

### Core Principles

1. **RECOMMENDATION-FIRST**: Best option is obvious immediately
2. **EXPLAINABILITY**: Users understand WHY a provider is suggested
3. **TRADE-OFF CLARITY**: Every option shows pros and cons
4. **CONFIDENCE**: Users feel safe making decisions
5. **LOW FRICTION**: Decisions take seconds, not minutes

---

## Page Structure

### 3-Panel Layout

```
┌──────────────────────────────────────────────────────┐
│          TOP DECISION HEADER                          │
│   "Aanbevolen: Plaats bij Zorggroep Horizon"        │
│   Match 94% · Confidence 95% · [Plaats direct]      │
└──────────────────────────────────────────────────────┘

┌─────────┬──────────────────┬──────────┐
│  LEFT   │     CENTER       │  RIGHT   │
│  PANEL  │     PANEL        │  PANEL   │
│         │                  │          │
│ Case    │  Top 3 Provider  │ System   │
│ Context │  Match Cards     │Intelligence│
│         │                  │          │
│ (Sticky)│  🟢 Best match   │ (Sticky) │
│         │  🟡 Alternative  │          │
│         │  🔴 Risky        │Risks     │
│         │                  │Suggestions│
│         │  [Alt Actions]   │Insights  │
└─────────┴──────────────────┴──────────┘
```

**Grid:** 12 columns
- Left: 3 columns (case context)
- Center: 6 columns (match cards)
- Right: 3 columns (intelligence panel)

---

## TOP DECISION HEADER

### Purpose

Immediately present the system's top recommendation with a clear call-to-action.

### Layout

```
┌────────────────────────────────────────────────────────┐
│ 🎯 Aanbevolen plaatsing                               │
│    Beste match voor [Client Name]                     │
│                                                        │
│ ┌────────────────────────────────────────────────┐   │
│ │ ⚡ Zorggroep Horizon                            │   │
│ │                                                 │   │
│ │ Zorggroep Horizon biedt de beste match met     │   │
│ │ een score van 94%. Specialisatie in complexe   │   │
│ │ gedragsproblematiek, directe capaciteit        │   │
│ │ beschikbaar, en snelle reactietijd van 4 uur.  │   │
│ └────────────────────────────────────────────────┘   │
│                                                        │
│ • Match score: 94%  • Confidence: 95%  • 3 plekken    │
│                                                        │
│                                    [Plaats direct]    │
└────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- Green gradient background (subtle)
- Green border (2px solid)
- Prominent heading with target icon
- Highlighted recommendation summary
- Key metrics in row
- Primary CTA (green button)

**Content:**
- **Title**: "Aanbevolen plaatsing"
- **Subtitle**: Case context
- **Recommendation block**:
  - Provider name (large, bold)
  - Reason summary (1-2 sentences)
  - Why it's the best match
- **Quick stats**:
  - Match score %
  - Confidence %
  - Available spots
- **CTA**: "Plaats direct" (green, prominent)

---

## LEFT PANEL: Case Context

### Purpose

Always-visible case information for reference during matching decision.

### Content

```
┌─────────────────────────┐
│ Casus context           │
│                         │
│ Case ID                 │
│ C-001                   │
│                         │
│ Cliënt                  │
│ [Name]                  │
│                         │
│ Leeftijd                │
│ 14 jaar                 │
│                         │
│ Regio                   │
│ 📍 Amsterdam            │
│                         │
│ Zorgtype                │
│ Intensieve begeleiding  │
│                         │
│ Urgentie                │
│ [HOOG badge]            │
│ ─────────────────────   │
│ Status                  │
│ Klaar voor matching     │
└─────────────────────────┘
```

**Behavior:**
- Sticky positioning (top: 96px)
- Premium card styling
- Compact information display
- Urgency color-coded badge
- Status indicator

**Fields:**
- Case ID
- Client name
- Age
- Region (with map pin icon)
- Care type needed
- Urgency level (badge)
- Current status

---

## CENTER PANEL: Provider Match Cards

### Section Header

```
Provider matches          3 gevonden
```

- Left: Section title
- Right: Count of matches
- Margin bottom before cards

---

### Match Card Structure

Each of the top 3 providers gets a detailed card:

```
┌────────────────────────────────────────────────────┐
│ Zorggroep Horizon         [🟢 Beste match]   94%  │ ← Header
│ Intensieve jeugdhulp                         /100 │
│                                                    │
│ [📍 Regio] [👥 Capaciteit] [⭐ Rating] [🕐 Reactie]│ ← Metrics
│ Amsterdam   3/15 ✓        4.7 ✓         4u ✓     │
│                                                    │
│ Specialisaties                                     │ ← Specializations
│ [Gedragsproblematiek] [Trauma] [ADHD]             │
│                                                    │
│ 📈 Waarom deze match?                             │ ← Explanation
│ ✅ Perfecte specialisatie match...                │
│ ✅ Beschikbare capaciteit (3 plekken vrij)        │
│ ✅ Snelle reactietijd (gemiddeld 4 uur)           │
│ ✅ Hoge succesratio (78%) bij vergelijkbare cases │
│                                                    │
│ Voorspelde succeskans           95%               │ ← Confidence
│ ████████████████████░░░░░░░                       │
│                                                    │
│ [Plaats direct]  [Meer details]                   │ ← CTAs
└────────────────────────────────────────────────────┘
```

---

### Card Components

**1. Header Section**

```
┌──────────────────────────────────────────┐
│ Provider Name    [🟢 Beste match]   94% │
│ Provider Type                       /100 │
└──────────────────────────────────────────┘
```

**Elements:**
- **Provider name**: Large (18px), semibold
- **Match label badge**: Color-coded
  - 🟢 Beste match (green)
  - 🟡 Alternatief (purple/primary)
  - 🔴 Met risico (amber/yellow)
- **Match score**: Large (32px), bold, colored
- **Provider type**: Small, muted

---

**2. Key Metrics Row**

4-column grid showing critical data:

| Metric | Icon | Example | Status |
|--------|------|---------|--------|
| Regio | 📍 MapPin | Amsterdam | - |
| Capaciteit | 👥 Users | 3/15 | Green if >0, Red if 0 |
| Rating | ⭐ Star | 4.7 | Green if >4.0 |
| Reactietijd | 🕐 Clock | 4u | Green if ≤6h, Amber if >6h |

**Status colors:**
- Positive: Green
- Warning: Amber
- Negative: Red

---

**3. Specializations**

```
Specialisaties
[Gedragsproblematiek] [Trauma] [ADHD] [Autisme]
```

- Label: "Specialisaties" (small, muted)
- Pills: Gray background, rounded, compact
- Wrap to multiple rows if needed

---

**4. Match Explanation Block**

```
┌────────────────────────────────────────┐
│ 📈 Waarom deze match?                 │
│                                        │
│ ✅ Perfecte specialisatie match...    │
│ ✅ Beschikbare capaciteit...          │
│ ✅ Snelle reactietijd...              │
│ ✅ Hoge succesratio...                │
└────────────────────────────────────────┘
```

**Design:**
- Background: Blue/5% opacity
- Border: Blue/20% opacity
- Heading: Small, semibold, with TrendingUp icon
- List items: Check icons (green ✅ or amber ⚠️)
- Text: Small (12px), muted, relaxed line-height

**Content varies by match type:**

**Best Match:**
- All positive reasons
- Green checkmarks
- Highlights strengths

**Alternative:**
- Mix of positive and warning
- Green checks + amber triangles
- Balanced view

**Risky:**
- Mix with clear risks
- Red alert icons for problems
- Green for positives

---

**5. Trade-Offs Block** (Alternative/Risky only)

```
┌────────────────────────────────────────┐
│ 🛡️ Overwegingen                       │
│                                        │
│ + Voordelen          − Nadelen        │
│ • Meer capaciteit    • Langere reactie│
│ • Lagere kosten      • Minder ervaring│
└────────────────────────────────────────┘
```

**Design:**
- Background: Muted/30%
- Border: Muted/20%
- 2-column grid (pros | cons)
- Green (+) and Red (−) sections
- Bullet lists

**Not shown for "Beste match"** (no trade-offs needed)

---

**6. Confidence Indicator**

```
Voorspelde succeskans           95%
████████████████████░░░░░░░
```

**Design:**
- Purple background (10% opacity)
- Purple border (20% opacity)
- Label + percentage on same line
- Progress bar below
- Purple fill, muted background
- Smooth transition animation

**Meaning:**
AI-predicted likelihood of successful placement based on:
- Historical data
- Provider match score
- Case complexity
- Provider capacity
- Response time patterns

---

**7. CTA Buttons**

**Best Match:**
```
[Plaats direct ✅]  [Meer details]
```
- Primary: Green background, white text
- Secondary: Outline

**Alternative:**
```
[Plaats]  [Meer details]
```
- Primary: Purple (primary color)
- Secondary: Outline

**Risky:**
```
[Plaats met risico ⚠️]  [Meer details]
```
- Primary: Amber background
- Warning icon
- Secondary: Outline

---

### Card Visual Treatment

**Best Match:**
- Border: Green (40% opacity), 2px
- Glow: Green shadow (subtle)
- Background: Slight green tint
- No trade-offs block (all positive)

**Alternative:**
- Border: Primary/Purple (40% opacity), 2px
- No glow
- Standard background
- Trade-offs shown

**Risky:**
- Border: Amber (40% opacity), 2px
- No glow
- Standard background
- Trade-offs shown with risks

**Selected State:**
- Border: Primary (100% opacity)
- Ring: Purple ring-2
- Elevated slightly

---

### Alternative Actions Section

Below match cards:

```
┌────────────────────────────────────────┐
│ Alternatieve acties                    │
│                                        │
│ [🔍 Zoek handmatig] [⚙️ Pas filters aan]│
│ [⚠️ Escaleren]                         │
└────────────────────────────────────────┘
```

**Actions:**
1. **Zoek handmatig**: Open manual search interface
2. **Pas filters aan**: Modify search criteria (expand region, change care type)
3. **Escaleren**: Flag case for supervisor review

**Design:**
- Premium card
- 3 outline buttons in row
- Icons + text labels

---

## RIGHT PANEL: System Intelligence

### Purpose

Provide AI-powered insights, risk signals, and suggestions to guide decision-making.

### Sticky Behavior

- Position: top: 96px
- Scrolls with page but stays in viewport
- Space-y: 4 (16px gap between blocks)

---

### 1. Risk Signals Block

```
┌─────────────────────────────┐
│ ⚠️ Risicosignalen          │
│                             │
│ ⚠️ Geen providers met      │
│    directe capaciteit      │
│    in regio                │
│                             │
│ ⚠️ Urgente casus met       │
│    langere reactietijd     │
└─────────────────────────────┘
```

**Conditional:** Only shows if risks detected

**Severity Levels:**

**High (Red):**
- Background: Red/10%
- Border: Red/30%
- Text: Red/300
- Examples:
  - No providers in region
  - Critical capacity shortage
  - All providers declining

**Medium (Amber):**
- Background: Amber/10%
- Border: Amber/30%
- Text: Amber/300
- Examples:
  - Long wait times
  - Urgent case with slower response
  - Limited specialization match

**Design:**
- Small heading with AlertTriangle icon
- Stacked risk cards
- Each risk in its own colored block
- Small text (12px)

---

### 2. Suggestions Block

```
┌─────────────────────────────┐
│ 💡 Suggesties               │
│                             │
│ 💡 Vergroot zoekradius     │
│    naar aangrenzende       │
│    regio's                 │
│    [Toepassen]             │
│                             │
│ 💡 Overweeg alternatief    │
│    zorgtype voor betere    │
│    matches                 │
│    [Toepassen]             │
└─────────────────────────────┘
```

**Conditional:** Only shows if suggestions available

**Triggers:**
- Match score <80% → Suggest expand region
- No capacity → Suggest alternative care type
- High urgency + slow response → Suggest escalation

**Design:**
- Purple background (10% opacity)
- Purple border (20% opacity)
- Lightbulb icon
- Optional "Toepassen" button
- Action applies suggestion automatically

---

### 3. Matching Insights Block

```
┌─────────────────────────────┐
│ ✨ Matching insights        │
│                             │
│ ℹ️  Top match heeft 95%    │
│    voorspelde succeskans   │
│                             │
│ ℹ️  2 van 3 providers      │
│    hebben directe capaciteit│
│                             │
│ ℹ️  Gemiddelde acceptatie- │
│    ratio in regio: 82%     │
└─────────────────────────────┘
```

**Always visible**

**Content:**
- Confidence prediction
- Capacity availability
- Regional statistics
- Historical success rates
- Response time averages

**Design:**
- Blue background (5% opacity)
- Sparkles icon in header
- Info icons per insight
- Small text (12px)
- Blue accent color

---

### 4. System Confidence Block

```
┌─────────────────────────────┐
│ Systeemvertrouwen           │
│                             │
│ Match kwaliteit      94%    │
│ ████████████████████░░      │
│                             │
│ Voorspelde succes    95%    │
│ ████████████████████░░      │
└─────────────────────────────┘
```

**Metrics:**

**Match kwaliteit:**
- How well provider fits case requirements
- Based on: specialization, capacity, location, rating
- Green progress bar

**Voorspelde succes:**
- AI prediction of placement success
- Based on: historical data, provider patterns, case type
- Green progress bar

**Design:**
- Premium card
- Label + percentage justified
- Progress bars below each
- Green fill color
- Muted background

---

## Sticky Action Bar

### When Provider Selected

```
┌──────────────────────────────────────────────────────┐
│ Zorggroep Horizon                                    │
│ Geselecteerd voor plaatsing                          │
│                       [Annuleer] [✅ Bevestig plaatsing]│
└──────────────────────────────────────────────────────┘
```

**Position:** Fixed bottom, full width (accounts for sidebar)  
**Background:** Semi-transparent with backdrop blur  
**Border:** Top border only  

**Content:**
- Left: Selected provider name + subtitle
- Right: Cancel button (outline) + Confirm button (primary)

**Behavior:**
- Appears when user clicks any match card
- Disappears on cancel or confirm
- Confirms placement on button click

---

## Empty State

### When No Matches Found

```
┌─────────────────────────────────────────┐
│                                         │
│            [⚠️ Icon]                    │
│                                         │
│  Geen geschikte aanbieders gevonden    │
│                                         │
│  Er zijn geen providers die voldoen    │
│  aan de zorgvraag in deze regio.       │
│                                         │
│  💡 Suggesties:                         │
│  • Vergroot de zoekradius              │
│  • Overweeg een alternatief zorgtype   │
│  • Escaleer naar supervisor            │
│                                         │
│  [Vergroot regio] [Pas filters aan]    │
│  [Escaleren]                            │
└─────────────────────────────────────────┘
```

**Design:**
- Premium card
- Large warning icon (amber, gradient background)
- Centered layout
- Title + description
- Bulleted suggestions
- Action buttons

---

## Color System

| Color | Meaning | Usage |
|-------|---------|-------|
| **Green** | Best match / Safe / Positive | Best match card, success indicators, positive reasons |
| **Purple** | Alternative / Actions | Alternative matches, CTAs, suggestions |
| **Amber** | Risky / Warning | Risky matches, warnings, trade-offs |
| **Red** | Critical / Error | No capacity, high severity risks |
| **Blue** | Information | Insights, explanations, neutral info |

---

## Match Scoring Algorithm

### Factors (Weighted)

1. **Specialization Match** (35%)
   - Provider specializations vs case needs
   - Perfect match = 100%
   - Partial match = 50-80%
   - No match = 0%

2. **Capacity Availability** (25%)
   - Available spots > 0 = 100%
   - Waitlist < 1 week = 60%
   - Waitlist > 1 week = 20%
   - No capacity = 0%

3. **Geographic Proximity** (20%)
   - Same region = 100%
   - Adjacent region = 70%
   - Distant region = 30%

4. **Provider Rating** (10%)
   - Rating ≥4.5 = 100%
   - Rating 4.0-4.4 = 80%
   - Rating <4.0 = 50%

5. **Response Time** (10%)
   - ≤4 hours = 100%
   - 4-8 hours = 80%
   - 8-12 hours = 60%
   - >12 hours = 30%

### Final Score

```
Score = (Spec × 0.35) + (Cap × 0.25) + (Geo × 0.20) + (Rate × 0.10) + (Resp × 0.10)
```

**Categorization:**
- **Score ≥85%** → Best match (green)
- **Score 70-84%** → Alternative (purple)
- **Score <70%** → Risky (amber)

---

## Confidence Prediction

### ML Model Factors

1. **Historical success rate** with similar cases
2. **Provider acceptance rate** for this case type
3. **Match score** strength
4. **Capacity availability**
5. **Response time** patterns
6. **Regional completion** rates

### Confidence Levels

- **≥90%**: Very high confidence
- **80-89%**: High confidence
- **70-79%**: Moderate confidence
- **<70%**: Low confidence

---

## User Workflows

### Scenario 1: Accept Best Match (Fast Path)

```
1. Page loads with top recommendation header
2. User sees: "Aanbevolen: Plaats bij Zorggroep Horizon"
3. Reads quick summary (94% match, 95% confidence)
4. Clicks "Plaats direct" in header
5. Confirmation → Placement created
```

**Time:** <10 seconds

---

### Scenario 2: Review Options, Choose Alternative

```
1. User sees top recommendation
2. Scrolls to review all 3 match cards
3. Reads explanations and trade-offs
4. Decides alternative provider has better capacity
5. Clicks alternative card
6. Sticky action bar appears
7. Clicks "Bevestig plaatsing"
8. Confirmation → Placement created
```

**Time:** 30-60 seconds

---

### Scenario 3: Risk Aanbieder Beoordeling

```
1. User sees risky match (amber border)
2. Reads trade-offs section
3. Checks right panel "Risicosignalen"
4. Sees warning: "Geen directe capaciteit"
5. Reviews suggestion: "Vergroot zoekradius"
6. Clicks "Pas filters aan"
7. Modifies search criteria
8. New matches appear
```

**Time:** 1-2 minutes

---

### Scenario 4: No Good Matches

```
1. Page loads with 3 mediocre matches (all <70%)
2. Right panel shows risks
3. Suggestions appear: "Vergroot regio" or "Escaleer"
4. User clicks "Escaleren" in alternative actions
5. Case flagged for supervisor review
6. Returns to case detail
```

**Time:** <30 seconds

---

## Responsive Behavior

### Desktop (1400px+)
- 3-column layout (3-6-3)
- All panels visible
- Sticky side panels work well

### Laptop (1024-1399px)
- Same layout, tighter spacing
- All features visible

### Tablet (768-1023px)
- 2-column: Form + Intelligence combined
- Context panel collapses to accordion
- Match cards stack vertically

### Mobile (<768px)
- 1-column stack
- Context panel: Collapsible header
- Match cards: Full width
- Intelligence panel: Below matches
- Action bar: Full width

---

## Performance

### Optimization

- Match scoring runs client-side (instant)
- Provider data pre-loaded (no lag)
- Sticky panels use CSS position (no JS)
- Confidence bars animate with CSS transitions
- No external API calls during viewing

### Expected Load Times

- Initial load: <500ms
- Match calculation: <100ms (client-side)
- Provider selection: Instant
- Confirmation: <1s (API call)

---

## Accessibility

### Keyboard Navigation

```
Tab         → Navigate between cards and buttons
Enter       → Select card / activate button
Space       → Toggle card selection
Arrows      → Scroll through match cards
Esc         → Deselect / cancel
```

### Screen Reader Support

```html
<article 
  aria-label="Provider match: Zorggroep Horizon, 94% match score"
  role="option"
  aria-selected="false"
>
  <div role="region" aria-label="Match explanation">
    ...
  </div>
  
  <div role="region" aria-label="Trade-offs">
    ...
  </div>
  
  <button aria-label="Place with Zorggroep Horizon">
    Plaats direct
  </button>
</article>
```

### Focus Management

- Clear purple focus rings
- Logical tab order (top to bottom, left to right)
- Focus returns to trigger after modal close
- Skip links to jump between panels (future)

---

## Integration Points

### From Case Detail

```
User clicks "Start matching" →
Matching page opens →
Case context pre-loaded →
Match calculation runs →
Top 3 matches displayed
```

### From Aanbieder Beoordelingen

```
Aanbieder Beoordeling complete →
"Aanbieder Beoordeling afronden" clicked →
Navigate to Matching with case ID →
Matching algorithm executes
```

### To Plaatsing

```
User confirms match →
POST /api/placements →
Placement record created →
Provider notified →
Navigate back to Regiekamer
```

### Data Flow

```
MatchingPage
  ↓ (receives)
Case ID from navigation
  ↓ (fetches)
GET /api/cases/:id
GET /api/providers/match?caseId=:id
  ↓ (calculates)
Match scores client-side
  ↓ (displays)
Top 3 matches with explanations
  ↓ (on confirm)
POST /api/placements
  ↓ (navigates)
Back to Regiekamer
```

---

## Component Architecture

### Components Created

1. **MatchingPageEnhanced.tsx**
   - Main page container
   - 3-panel layout
   - Match calculation logic
   - Intelligence generation

2. **EnhancedProviderMatchCard** (inline)
   - Match card with full explainability
   - Reasons list
   - Trade-offs section
   - Confidence indicator
   - Action buttons

3. **MetricItem** (inline)
   - Reusable metric display
   - Icon + label + value
   - Status color coding

---

## Future Enhancements

### Phase 2: Advanced Features

- **Provider comparison**: Side-by-side comparison view
- **Historical data**: Past placements with this provider
- **Client preferences**: Factor in family preferences
- **Cost comparison**: Show relative costs
- **Availability calendar**: Visual capacity timeline

### Phase 3: ML Intelligence

- **Predictive scoring**: ML model for success prediction
- **Similar cases**: Show comparable past matches
- **Provider patterns**: Learn provider acceptance patterns
- **Optimal timing**: Suggest best time to contact provider

### Phase 4: Collaboration

- **Peer input**: Request colleague opinion on match
- **Provider communication**: In-app messaging
- **Multi-option placement**: Send to multiple providers
- **Automated follow-up**: Track provider responses

---

## Summary

The **Enhanced Matching page** transforms provider selection from a manual search process into an **AI-guided recommendation experience**. The system:

1. **Recommends the best match** prominently at the top
2. **Explains reasoning** with transparent scoring
3. **Shows trade-offs** clearly for all options
4. **Provides intelligence** via risk signals and suggestions
5. **Enables fast decisions** with one-click placement

**Key Innovation:** Explainable AI + Decision support = Confident, fast placements.

---

**Page Version:** 2.0.0 (Enhanced)  
**Design Date:** April 17, 2026  
**Status:** Production Ready  
**Documentation:** Complete
