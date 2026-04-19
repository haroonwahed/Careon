# Map-Enhanced Matching Page - Documentation

## 🎯 Overview

The Matching Page is where care coordinators select a provider for a case. This enhanced version integrates an interactive map to support spatial decision-making while maintaining the AI-powered decision intelligence layer.

**Key Principle:** This is a **decision interface with map support**, not a map-first interface.

---

## 📐 Layout Architecture

### Split-Screen Design

```
┌──────────────────────────────────────────────────────────────────┐
│                         TOP BAR                                  │
│  [← Back]                    Case Info              [Status]     │
├────────────────────────────────┬─────────────────────────────────┤
│                                │                                 │
│  LEFT SIDE (60%)               │  RIGHT SIDE (40%)              │
│  Decision Area                 │  Map Area                       │
│                                │                                 │
│  ┌──────────────────────────┐ │  ┌───────────────────────────┐ │
│  │ 🤖 Aanbevolen Actie     │ │  │                           │ │
│  │ "Plaats bij Provider X" │ │  │      Interactive Map      │ │
│  └──────────────────────────┘ │  │                           │ │
│                                │  │  • Provider pins          │ │
│  🤖 Distance Insight           │  │  • Client location        │ │
│                                │  │  • Radius circle          │ │
│  🤖 Risk Signals               │  │  • Controls               │ │
│                                │  │                           │ │
│  ┌──────────────────────────┐ │  └───────────────────────────┘ │
│  │ Provider Card #1         │ │                                 │
│  │ 🟢 Beste match           │ │  [Radius: 10/20/50km]          │
│  │                          │ │  [Filter]                       │
│  │ 🤖 Match Explanation    │ │  [Reset View]                   │
│  │ • Strengths              │ │  [Toggle Full Map]              │
│  │ • Trade-offs             │ │                                 │
│  │                          │ │  ┌─────────────────────────┐   │
│  │ [Plaats direct]          │ │  │ Selected Provider Mini  │   │
│  └──────────────────────────┘ │  │ Preview (when active)   │   │
│                                │  └─────────────────────────┘   │
│  [Provider Card #2]            │                                 │
│  [Provider Card #3]            │                                 │
│                                │                                 │
└────────────────────────────────┴─────────────────────────────────┘
```

---

## 🧱 Component Breakdown

### 1. Top Bar

**Purpose:** Navigation and context

**Contains:**
- Back button to case detail
- Case identifier and client name
- Status badge ("Klaar voor matching")

**Layout:**
```tsx
<div className="border-b border-border bg-card p-4">
  <div className="flex items-center justify-between">
    <Button>← Terug naar case</Button>
    <div className="flex items-center gap-3">
      <span>Case ID · Client Name</span>
      <Badge>Klaar voor matching</Badge>
    </div>
  </div>
</div>
```

---

### 2. Left Side: Decision Area (60%)

#### 2A. AI Recommended Action

**Component:** `AanbevolenActie`

**Purpose:** Primary AI recommendation

**Content:**
- Title: "Plaats bij [Provider Name]"
- Explanation: Why this is the best match
- Confidence: High/Medium/Low
- Action: "Plaats direct" button

**Example:**
```tsx
<AanbevolenActie
  title="Plaats bij Jeugdhulp Noord"
  explanation="Beste match op basis van beschikbaarheid binnen 3 dagen, 
               sterke match met zorgtype, en hoge acceptatiegraad."
  actionLabel="Plaats direct"
  confidence="high"
  onAction={() => confirmMatch(bestMatch.id)}
/>
```

---

#### 2B. Distance Insight

**Component:** `SystemInsight`

**Purpose:** Alert about distance constraints

**Triggers when:**
- No providers within preferred radius (10km)
- Best match is far from client

**Example:**
```tsx
<SystemInsight
  type="warning"
  message="Geen geschikte aanbieder binnen 10km → 3 opties binnen 20km"
/>
```

---

#### 2C. Risk Signals

**Component:** `Risicosignalen`

**Purpose:** Highlight blocking issues

**Common signals:**
- No capacity available
- Best match outside preferred radius
- High urgency with slow response time

**Example:**
```tsx
<Risicosignalen
  signals={[
    {
      severity: "critical",
      message: "Geen providers met directe capaciteit binnen radius"
    },
    {
      severity: "warning",
      message: "Beste match ligt buiten voorkeursradius (>15km)"
    }
  ]}
/>
```

---

#### 2D. Provider Decision Cards

**Purpose:** Detailed provider information with AI explanations

**Card Structure:**

```
┌────────────────────────────────────────────────────┐
│ Provider Name              [94%]  🟢 Beste match   │
│ Provider Type                                      │
│                                                    │
│ [Afstand] [Capaciteit] [Rating] [Reactie]        │
│   8km       3/10        4.5       4u              │
│                                                    │
│ 🤖 Waarom deze match?              [94%]          │
│ 🎯 Hoog vertrouwen                                │
│                                                    │
│ Sterke punten                                     │
│ ✓ Beschikbaarheid binnen 3 dagen                 │
│ ✓ Sterke match met zorgtype                      │
│ ✓ Hoge acceptatiegraad (92%)                     │
│                                                    │
│ [Plaats direct]  [Bekijk details]                │
└────────────────────────────────────────────────────┘
```

**Match Type Badges:**
- 🟢 **Beste match** (Green) - Score ≥90%, best option
- 🟡 **Alternatief** (Amber) - Score 75-89%, good backup
- 🔴 **Risicovol** (Red) - Score <75%, use with caution

**Core Metrics:**

| Metric | Icon | Color Logic |
|--------|------|-------------|
| Afstand | MapPin | Green ≤10km, Amber ≤20km, Red >20km |
| Capaciteit | Users | Green if spots available, Red if full |
| Rating | Star | Always green (positive metric) |
| Reactie | Clock | Green ≤6h, Amber >6h |

---

#### 2E. Match Explanation

**Component:** `MatchExplanation` (embedded in card)

**Purpose:** Transparent AI reasoning

**Structure:**
- Match score badge (large, colored)
- Confidence indicator
- Strengths section (green checkmarks)
- Trade-offs section (amber warnings)

**Example:**
```tsx
<MatchExplanation
  score={94}
  strengths={[
    "Beschikbaarheid binnen 3 dagen",
    "Sterke match met zorgtype",
    "Hoge acceptatiegraad (92%)"
  ]}
  tradeoffs={[]} // Best match has no trade-offs
  confidence="high"
/>
```

---

### 3. Right Side: Map Area (40%)

#### 3A. Map Container

**Purpose:** Visual spatial context

**Features:**
- Dark theme map (desaturated)
- Minimal labels
- Focus on provider locations

**Map Elements:**

1. **Client Location (Center)**
   - Purple pulsing pin
   - Starting point for radius

2. **Radius Circle**
   - Transparent overlay
   - Border in primary color
   - Shows search area (10/20/50km)

3. **Provider Pins**
   - Color-coded by match type:
     - Green: Best match
     - Amber: Alternative
     - Red: Risky
   - Purple ring when selected
   - Subtle glow on hover

---

#### 3B. Map Controls

**Position:** Top-right of map

**Controls:**

1. **Radius Selector**
   ```tsx
   [10km] [20km] [50km]  // Toggle buttons
   ```
   - Active: Purple background
   - Inactive: Muted background

2. **Filter Button**
   - Opens filter overlay
   - Icon: Filter

3. **Reset View Button**
   - Centers map on client
   - Icon: Navigation

4. **Toggle Full Map**
   - Expands map to full screen
   - Icon: Maximize2

---

#### 3C. Selected Provider Mini Preview

**Position:** Bottom of map (overlaid)

**Appears when:**
- Provider card clicked
- Map pin clicked

**Content:**
```
┌────────────────────────────────────┐
│ Provider Name                      │
│ 8km · Match 94%              [Plaats]│
└────────────────────────────────────┘
```

---

## 🔗 Synced Interactions

### Card → Map

**When user clicks provider card:**
1. Card gets purple border (selected state)
2. Map pin scales up (+25%)
3. Map pin gets purple ring
4. Map centers on provider location
5. Mini preview appears at bottom

**When user hovers provider card:**
1. Card gets subtle purple border
2. Map pin scales up slightly (+10%)
3. Map pin gets subtle glow

### Map → Card

**When user clicks map pin:**
1. Corresponding card scrolls into view
2. Card gets purple border
3. Pin scales up and gets purple ring
4. Mini preview appears

**When user hovers map pin:**
1. Corresponding card gets subtle highlight
2. Pin scales up slightly

---

## 🎨 Visual Design

### Color Semantics

```
Match Quality:
  Green  (#22C55E) → Best match (90-100%)
  Amber  (#F59E0B) → Alternative (75-89%)
  Red    (#EF4444) → Risky (<75%)

Actions:
  Purple (#8B5CF6) → Primary actions, selections

Metrics:
  Green  → Positive (good distance, capacity available)
  Amber  → Caution (medium distance, slow response)
  Red    → Negative (far, no capacity)
```

### Typography

```
Card Title:     Inter Bold 18px
Badge Text:     Inter Semibold 12px
Body Text:      Inter Regular 14px
Small Text:     Inter Regular 12px
Score Badge:    Inter Bold 24px
```

### Spacing

```
Card padding:          20px
Card gap:              16px
Section margins:       24px
Metric grid gap:       12px
Button gap:            12px
```

---

## 🧠 AI Decision Logic

### Recommendation Logic

```typescript
const getRecommendation = (matches: Provider[]) => {
  const bestMatch = matches[0];
  
  return {
    title: `Plaats bij ${bestMatch.name}`,
    explanation: generateExplanation(bestMatch),
    confidence: calculateConfidence(bestMatch),
    onAction: () => confirmMatch(bestMatch.id)
  };
};

const generateExplanation = (provider: Provider) => {
  const reasons = [];
  
  if (provider.availableSpots > 0) {
    reasons.push(`Beschikbaarheid binnen ${provider.responseTime} dagen`);
  }
  
  if (provider.rating >= 4.5) {
    reasons.push("Hoge acceptatiegraad");
  }
  
  return reasons.join(", ");
};
```

### Risk Detection Logic

```typescript
const getRiskSignals = (matches: Provider[], radius: number) => {
  const signals = [];
  
  // No capacity
  if (matches.every(p => p.availableSpots === 0)) {
    signals.push({
      severity: "critical",
      message: "Geen providers met directe capaciteit binnen radius"
    });
  }
  
  // Distance warning
  if (getBestMatchDistance() > 15) {
    signals.push({
      severity: "warning",
      message: "Beste match ligt buiten voorkeursradius (>15km)"
    });
  }
  
  // Urgency mismatch
  if (caseData.urgency === "high" && bestMatch.responseTime > 6) {
    signals.push({
      severity: "warning",
      message: "Urgente casus met langere reactietijd dan gewenst"
    });
  }
  
  return signals;
};
```

### Match Scoring

```typescript
const calculateMatchScore = (provider: Provider, caseData: Case) => {
  let score = 0;
  
  // Specialization match (35%)
  if (provider.type === caseData.caseType) {
    score += 35;
  }
  
  // Capacity (25%)
  if (provider.availableSpots > 0) {
    score += 25;
  }
  
  // Response time (20%)
  if (provider.responseTime <= 6) {
    score += 20;
  } else if (provider.responseTime <= 12) {
    score += 10;
  }
  
  // Rating (10%)
  score += (provider.rating / 5) * 10;
  
  // Distance (10%)
  const distance = getDistance(provider);
  if (distance <= 10) {
    score += 10;
  } else if (distance <= 20) {
    score += 5;
  }
  
  return Math.round(score);
};
```

---

## 📱 Responsive Behavior

### Desktop (>1280px)
- Split-screen 60/40 layout
- All features visible
- Map remains fixed on scroll

### Tablet (768-1279px)
- Map moves to top
- Decision area below
- Map height: 400px (fixed)

### Mobile (<768px)
- Stack vertically
- Map collapsible
- Cards fill width
- Touch-optimized controls

---

## ♿ Accessibility

### Keyboard Navigation

```
Tab       → Move between cards
Enter     → Select provider
Space     → Expand card details
Esc       → Deselect/close
Arrow ↑↓  → Navigate cards
```

### Screen Reader

- Card announces: "Provider [Name], Match score [Score]%, [Match type]"
- Map pins announce: "Provider location, [Distance]km from client"
- Actions announce: "Place client with [Provider]"

---

## 🚀 Performance Optimization

### Lazy Loading

```typescript
// Map component lazy loaded
const MapComponent = lazy(() => import('./MapComponent'));

// Load only when tab visible
{isMapVisible && (
  <Suspense fallback={<MapSkeleton />}>
    <MapComponent />
  </Suspense>
)}
```

### Memoization

```typescript
// Memoize expensive calculations
const topMatches = useMemo(
  () => calculateMatches(providers, caseData),
  [providers, caseData]
);

const riskSignals = useMemo(
  () => detectRisks(topMatches, caseData),
  [topMatches, caseData]
);
```

---

## 🎯 Success Metrics

### Key Performance Indicators

1. **Decision Speed**
   - Time from page load to placement confirmation
   - Target: <2 minutes

2. **Match Accuracy**
   - % of AI recommendations followed
   - Target: >80%

3. **Map Usage**
   - % of users who interact with map
   - Track: pin clicks, radius changes

4. **Cognitive Load**
   - Can user understand recommendation in <5 seconds?
   - User testing validation

---

## 🔧 Implementation Checklist

**Phase 1: Core Layout**
- [ ] Split-screen layout (60/40)
- [ ] Top bar with navigation
- [ ] Decision area scrollable
- [ ] Map area fixed

**Phase 2: AI Components**
- [ ] Aanbevolen Actie at top
- [ ] SystemInsight for distance
- [ ] Risicosignalen for warnings
- [ ] MatchExplanation in cards

**Phase 3: Provider Cards**
- [ ] Card structure with badges
- [ ] Core metrics grid
- [ ] AI explanation embedded
- [ ] Action buttons

**Phase 4: Map Integration**
- [ ] Map container
- [ ] Provider pins (color-coded)
- [ ] Client location marker
- [ ] Radius circle overlay

**Phase 5: Interactions**
- [ ] Card click → map sync
- [ ] Card hover → pin highlight
- [ ] Pin click → card sync
- [ ] Pin hover → card highlight

**Phase 6: Controls**
- [ ] Radius selector (10/20/50km)
- [ ] Filter button
- [ ] Reset view button
- [ ] Toggle full map

**Phase 7: Polish**
- [ ] Smooth transitions
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling

**Phase 8: Testing**
- [ ] Desktop responsive
- [ ] Mobile responsive
- [ ] Keyboard navigation
- [ ] Screen reader support

---

## 📚 Files Created

```
/components/care/
  ├─ MatchingDecisionEnginePage.tsx       (Main component)
  ├─ MapProviderPin.tsx             (Map pin component)
  └─ MapRadiusCircle.tsx            (Radius overlay)

/components/examples/
  └─ MatchingWorkflowDemo.tsx       (Complete demo)

/docs/
  └─ MATCHING_PAGE_MAP_DOCS.md      (This file)
```

---

## 🎓 Usage Example

```tsx
import { MatchingPageWithMap } from "@/components/care/MatchingDecisionEnginePage";

function App() {
  const handleConfirmMatch = (providerId: string) => {
    // Navigate to placement page
    router.push(`/placement/${providerId}`);
  };

  const handleBack = () => {
    router.push(`/cases/${caseId}`);
  };

  return (
    <MatchingPageWithMap
      caseId={caseId}
      onBack={handleBack}
      onConfirmMatch={handleConfirmMatch}
    />
  );
}
```

---

## 🎨 Design Principles Achieved

✅ **Decision-first, map-supportive**
- Left side (decision) is dominant (60%)
- Map provides context, not primary interface

✅ **AI-powered decision support**
- Clear recommendation at top
- Transparent reasoning
- Risk awareness

✅ **Spatial awareness**
- Distance visible in metrics
- Map shows geographic context
- Radius control for flexibility

✅ **Calm, structured interface**
- Clean visual hierarchy
- No overwhelming animations
- Professional, operational feel

✅ **Synced interactions**
- Card ↔ map bidirectional sync
- Smooth transitions
- Intuitive hover states

---

**This is a decision engine with map support, not a map-first interface.** ✅
