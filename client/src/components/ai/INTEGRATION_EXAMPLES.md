# AI Layer Integration - Before & After Examples

## Example 1: Casus Detail Page

### BEFORE (No AI Layer)

```tsx
export function CaseDetailPage({ caseId, onBack }) {
  const caseData = mockCases.find(c => c.id === caseId);

  return (
    <div className="space-y-6">
      <Button onClick={onBack}>Back</Button>
      
      <div className="premium-card p-6">
        <h1>{caseData.id}</h1>
        <p>{caseData.clientName}</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>Case info...</div>
        <div>Work area...</div>
        <div>Timeline...</div>
      </div>
    </div>
  );
}
```

### AFTER (With AI Layer)

```tsx
import { 
  AanbevolenActie, 
  Risicosignalen, 
  Samenvatting, 
  AIInsightPanel 
} from "@/components/ai";

export function CaseDetailPage({ caseId, onBack, onStartMatching }) {
  const caseData = mockCases.find(c => c.id === caseId);

  // ✨ AI Decision Logic
  const recommendation = {
    title: "Start matching proces",
    explanation: "Aanbieder Beoordeling is compleet. Systeem heeft 3 potentiële matches geïdentificeerd.",
    actionLabel: "Start matching",
    confidence: "high",
    onAction: () => onStartMatching(caseId)
  };

  const riskSignals = [
    { 
      severity: "warning",
      message: "Urgente casus - beoordeling loopt 3 dagen vertraging op"
    }
  ];

  const summary = [
    { text: "15 jaar, woonachtig in Amsterdam", type: "default" },
    { text: "Zorgvraag: Intensieve Ambulante Begeleiding", type: "info" },
      { text: "Hoge urgentie", type: "warning" }
  ];

  return (
    <div className="space-y-6">
      <Button onClick={onBack}>Back</Button>
      
      <div className="premium-card p-6">
        <h1>{caseData.id}</h1>
        <p>{caseData.clientName}</p>
      </div>

      {/* ✨ AI LAYER: Recommended Action */}
      <AanbevolenActie {...recommendation} />

      <div className="grid grid-cols-12 gap-6">
        {/* Left: Case info */}
        <div className="col-span-4">
          Case info...
        </div>

        {/* Center: Main content */}
        <div className="col-span-5 space-y-4">
          {/* ✨ AI LAYER: Summary */}
          <Samenvatting items={summary} />
          
          Work area...
        </div>

        {/* Right: AI Insights */}
        <div className="col-span-3">
          <AIInsightPanel>
            {/* ✨ AI LAYER: Risk Signals */}
            <Risicosignalen signals={riskSignals} />
            
            {/* Other insights */}
            <div>Status...</div>
          </AIInsightPanel>
        </div>
      </div>
    </div>
  );
}
```

**What changed:**
- ✅ Added `AanbevolenActie` at top for next action
- ✅ Added `Samenvatting` in center for quick overview
- ✅ Added `Risicosignalen` in right sidebar
- ✅ Wrapped right sidebar with `AIInsightPanel`
- ✅ Changed grid to 12-column for better control (4-5-3 split)

---

## Example 2: Matching Page - Provider Card

### BEFORE (No AI Explanation)

```tsx
<div className="premium-card p-5">
  <h3>{provider.name}</h3>
  <p>{provider.type}</p>
  
  <div className="grid grid-cols-4 gap-3">
    <div>
      <span>Regio</span>
      <p>{provider.region}</p>
    </div>
    <div>
      <span>Capaciteit</span>
      <p>{provider.availableSpots}/{provider.capacity}</p>
    </div>
    {/* ... more metrics */}
  </div>

  <div>
    <p>Specializations...</p>
  </div>
</div>
```

### AFTER (With AI Explanation)

```tsx
import { MatchExplanation } from "@/components/ai";

<div className="premium-card p-5">
  <div className="flex items-start justify-between mb-4">
    <div>
      <h3>{provider.name}</h3>
      <p>{provider.type}</p>
    </div>
    
    {/* Match score badge */}
    <div className="text-center">
      <div className="px-3 py-1 rounded-lg border-2 bg-green-500/10 border-green-500/30">
        <span className="text-xl font-bold text-green-400">94%</span>
      </div>
    </div>
  </div>
  
  <div className="grid grid-cols-4 gap-3 mb-4">
    <div>
      <MapPin size={12} />
      <span>Regio</span>
      <p>{provider.region}</p>
    </div>
    <div>
      <Users size={12} />
      <span>Capaciteit</span>
      <p>{provider.availableSpots}/{provider.capacity}</p>
    </div>
    {/* ... more metrics */}
  </div>

  {/* ✨ AI LAYER: Match Explanation */}
  <MatchExplanation
    score={94}
    strengths={[
      "Specialisatie match",
      "3 plekken beschikbaar",
      "Reactie binnen 4u"
    ]}
    tradeoffs={[
      "15km reisafstand"
    ]}
    confidence="high"
    compact
  />
</div>
```

**What changed:**
- ✅ Added match score badge in header
- ✅ Added `MatchExplanation` component explaining WHY this is a good match
- ✅ Shows both strengths and trade-offs transparently
- ✅ Displays confidence level

---

## Example 3: Adding Inline Insights

### BEFORE (Just status text)

```tsx
<div className="p-4 bg-muted rounded-lg">
  <p>Beoordeling gepland op 18 april</p>
</div>
```

### AFTER (With SystemInsight)

```tsx
import { SystemInsight } from "@/components/ai";

<SystemInsight
  type="info"
  message="Beoordeling gepland op 18 april"
/>
```

**What changed:**
- ✅ Consistent styling with semantic colors
- ✅ Icon indicates type (info/warning/success/etc)
- ✅ Part of unified AI design language

---

## Example 4: Risk Detection

### BEFORE (Generic warning)

```tsx
{provider.availableSpots === 0 && (
  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded">
    <p>No capacity available</p>
  </div>
)}
```

### AFTER (With Risicosignalen)

```tsx
import { Risicosignalen } from "@/components/ai";

const riskSignals = [];

if (provider.availableSpots === 0) {
  riskSignals.push({
    severity: "critical",
    message: "Geen beschikbare capaciteit in regio Amsterdam"
  });
}

if (caseData.urgency === "high" && provider.responseTime > 6) {
  riskSignals.push({
    severity: "warning",
    message: "Urgente casus met trage reactie"
  });
}

{riskSignals.length > 0 && (
  <Risicosignalen signals={riskSignals} compact />
)}
```

**What changed:**
- ✅ Centralized risk logic
- ✅ Multiple risks shown together
- ✅ Severity levels (critical/warning/info)
- ✅ Consistent styling and icons

---

## Example 5: Page-Level Integration Pattern

### Step-by-Step Integration

**1. Import AI Components**
```tsx
import { 
  AanbevolenActie,
  Risicosignalen,
  Samenvatting,
  MatchExplanation,
  SystemInsight,
  AIInsightPanel
} from "@/components/ai";
```

**2. Add Decision Logic**
```tsx
// At top of component, after data fetching
const recommendation = getRecommendation(caseData);
const riskSignals = getRiskSignals(caseData);
const summary = getSummary(caseData);
```

**3. Update Layout Structure**
```tsx
return (
  <div className="space-y-6">
    {/* Existing header */}
    
    {/* ✨ NEW: Recommended action at top */}
    <AanbevolenActie {...recommendation} />
    
    {/* Update grid to 12-column for better control */}
    <div className="grid grid-cols-12 gap-6">
      
      {/* Left column (4 cols) */}
      <div className="col-span-4">
        {/* Existing case info */}
      </div>
      
      {/* Center column (5 cols) */}
      <div className="col-span-5 space-y-4">
        {/* ✨ NEW: Summary */}
        <Samenvatting items={summary} />
        
        {/* Existing work area */}
        
        {/* ✨ NEW: Inline insights */}
        <SystemInsight type="info" message="..." />
      </div>
      
      {/* Right column (3 cols) - ✨ NEW: AI Panel */}
      <div className="col-span-3">
        <AIInsightPanel>
          <Risicosignalen signals={riskSignals} />
          {/* Other insights */}
        </AIInsightPanel>
      </div>
    </div>
  </div>
);
```

**4. Add Helper Functions**
```tsx
// Decision logic helpers
const getRecommendation = (caseData) => {
  if (caseData.status === "matching") {
    return {
      title: "Start matching proces",
      explanation: "Aanbieder Beoordeling is compleet...",
      actionLabel: "Start matching",
      confidence: "high",
      onAction: () => handleStartMatching()
    };
  }
  // ... more cases
};

const getRiskSignals = (caseData) => {
  const signals = [];
  
  if (caseData.urgency === "high" && isDelayed(caseData)) {
    signals.push({
      severity: "warning",
      message: "Urgente casus loopt vertraging op"
    });
  }
  
  return signals;
};

const getSummary = (caseData) => {
  return [
    { text: `${caseData.clientAge} jaar, ${caseData.region}`, type: "default" },
    { text: `Zorgvraag: ${caseData.caseType}`, type: "info" },
    // ... more items
  ];
};
```

---

## Common Patterns

### Pattern: Conditional AI Components

```tsx
// Only show if there are risks
{riskSignals.length > 0 && (
  <Risicosignalen signals={riskSignals} />
)}

// Only show recommendation if action needed
{requiresAction(caseData) && (
  <AanbevolenActie {...recommendation} />
)}

// Show different insights based on status
{caseData.status === "matching" && (
  <SystemInsight 
    type="success" 
    message="3 potentiële matches gevonden"
  />
)}
```

### Pattern: Dynamic Confidence

```tsx
const getConfidence = (score) => {
  if (score >= 90) return "high";
  if (score >= 75) return "medium";
  return "low";
};

<MatchExplanation
  score={matchScore}
  confidence={getConfidence(matchScore)}
  // ...
/>
```

### Pattern: Multiple Risk Severities

```tsx
const riskSignals = [
  ...criticalRisks.map(r => ({ severity: "critical", message: r })),
  ...warnings.map(w => ({ severity: "warning", message: w })),
  ...infos.map(i => ({ severity: "info", message: i }))
];
```

---

## Testing Your Integration

### Checklist

- [ ] AI components render without layout shift
- [ ] Text wraps properly (no overflow)
- [ ] Colors match semantic system (purple/red/amber/blue/green)
- [ ] Icons are consistent size (14-16px)
- [ ] Spacing is consistent (p-4, space-y-4)
- [ ] Mobile responsive (components stack properly)
- [ ] Decision logic returns correct recommendations
- [ ] Risk signals show in order of severity
- [ ] Confidence indicators are accurate
- [ ] Actions trigger correct handlers
- [ ] Dutch language is professional and clear
- [ ] 3-second comprehension test passes

### Manual Testing

1. **Load page** - AI components should appear smoothly
2. **Change case status** - recommendation updates
3. **Add risks** - signals appear in right panel
4. **Resize window** - components stack on mobile
5. **Long text** - everything wraps, no overflow
6. **Click actions** - handlers execute correctly

---

## Migration Guide

### If you have existing recommendation banners

**Replace this:**
```tsx
<div className="p-4 rounded-lg border-l-4 bg-primary/10 border-primary">
  <div className="flex items-start gap-3">
    <TrendingUp className="text-primary" size={20} />
    <div>
      <p className="font-medium">Klaar voor matching</p>
      <p className="text-sm text-muted-foreground">
        Systeem heeft 3 matches geïdentificeerd
      </p>
    </div>
    <Button onClick={handleStartMatching}>
      Start matching
    </Button>
  </div>
</div>
```

**With this:**
```tsx
<AanbevolenActie
  title="Start matching proces"
  explanation="Systeem heeft 3 potentiële matches geïdentificeerd in de regio."
  actionLabel="Start matching"
  confidence="high"
  onAction={handleStartMatching}
/>
```

### If you have existing risk alerts

**Replace this:**
```tsx
<div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30">
  <div className="flex items-start gap-2">
    <AlertCircle className="text-red-500" size={16} />
    <div>
      <p className="font-medium text-sm">Geen capaciteit</p>
      <p className="text-xs text-muted-foreground">
        Geen beschikbare providers in regio
      </p>
    </div>
  </div>
</div>
```

**With this:**
```tsx
<Risicosignalen
  signals={[
    {
      severity: "critical",
      message: "Geen beschikbare providers in regio Amsterdam"
    }
  ]}
/>
```

---

## Quick Reference

| Old Component | New AI Component | Location |
|--------------|------------------|----------|
| Custom recommendation banner | `AanbevolenActie` | Top of page |
| Custom risk alerts | `Risicosignalen` | Right sidebar |
| Custom summary lists | `Samenvatting` | Center column |
| Custom match explanations | `MatchExplanation` | Provider cards |
| Custom status messages | `SystemInsight` | Inline |
| Generic sidebar wrapper | `AIInsightPanel` | Right column |
