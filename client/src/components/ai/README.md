# AI Decision Intelligence Layer

Embedded intelligence components for the Careon Zorgregie platform.

## Design Principles

1. **NON-INTRUSIVE** - AI supports, does not overwhelm
2. **EXPLAINABLE** - Every recommendation includes reasoning
3. **ACTION-ORIENTED** - Always leads to clear next steps
4. **TRUSTWORTHY** - Professional, calm, authoritative tone
5. **CONSISTENT** - Same patterns across all pages

---

## Core Components

### 1. AanbevolenActie

**Primary decision card with recommended action**

```tsx
import { AanbevolenActie } from "@/components/ai";

<AanbevolenActie
  title="Start matching proces"
  explanation="Beoordeling is compleet. Systeem heeft 3 potentiële matches geïdentificeerd."
  actionLabel="Start matching"
  confidence="high" // "high" | "medium" | "low"
  variant="default" // "default" | "urgent"
  onAction={() => startMatching()}
/>
```

**When to use:**
- Top of Casus Detail page
- Top of Matching page  
- Top of Beoordeling page

**Placement:** Always at the top, before main content

---

### 2. Risicosignalen

**Compact warning/risk component**

```tsx
import { Risicosignalen } from "@/components/ai";

<Risicosignalen
  signals={[
    { 
      severity: "critical", // "critical" | "warning" | "info"
      message: "Geen beschikbare capaciteit in regio Amsterdam" 
    },
    { 
      severity: "warning",
      message: "Urgente casus met langere reactietijd" 
    }
  ]}
  compact={false} // optional, for tighter spacing
/>
```

**When to use:**
- Right sidebar on Casus Detail
- Right sidebar on Matching
- Right sidebar on Plaatsing

**Placement:** Right sidebar in "AI Insights Panel"

---

### 3. Samenvatting

**Clean summary panel with bullet points**

```tsx
import { Samenvatting } from "@/components/ai";

<Samenvatting
  title="Casus samenvatting" // optional
  items={[
    { 
      text: "15 jaar, woonachtig in Amsterdam",
      type: "default" // "success" | "warning" | "info" | "default"
    },
    { 
      text: "Zorgvraag: Intensieve Ambulante Begeleiding",
      type: "info"
    },
    { 
      text: "Hoge urgentie - spoedtraject vereist",
      type: "warning"
    }
  ]}
  compact={false} // optional
/>
```

**When to use:**
- Center column on Casus Detail
- Intake briefing page
- Top of Plaatsing page

**Placement:** Center/main content area

---

### 4. MatchExplanation

**Explains WHY a provider match was selected**

```tsx
import { MatchExplanation } from "@/components/ai";

<MatchExplanation
  score={94}
  strengths={[
    "Specialisatie match",
    "3 plekken beschikbaar",
    "Reactie binnen 4u"
  ]}
  tradeoffs={[
    "15km reisafstand",
    "Groepstherapie wachtlijst (2-3w)"
  ]}
  confidence="high" // "high" | "medium" | "low"
  compact={false} // optional
/>
```

**When to use:**
- Inside each provider card on Matching page
- On Plaatsing page for selected provider

**Placement:** Below provider details

---

### 5. SystemInsight

**Inline feedback strip for quick insights**

```tsx
import { SystemInsight } from "@/components/ai";

<SystemInsight
  type="info" // "info" | "warning" | "success" | "blocked" | "suggestion"
  message="Beoordeling gepland voor 18 april met Dr. P. Bakker"
  compact={false} // optional
/>
```

**When to use:**
- Inline status updates
- Quick feedback messages
- Blocking notifications

**Placement:** Anywhere inline with content

---

### 6. AIInsightPanel

**Container for AI components (right sidebar)**

```tsx
import { AIInsightPanel } from "@/components/ai";

<AIInsightPanel title="Beslissingsondersteuning">
  <Risicosignalen signals={risks} />
  {/* Other AI components */}
</AIInsightPanel>
```

**When to use:**
- Right sidebar wrapper
- Groups related AI insights

**Placement:** Right column (3-col grid)

---

## Page Integration Patterns

### Casus Detail Page

```
┌─────────────────────────────────────────────────────────┐
│ [Header: Case ID + Status Badges]                      │
├─────────────────────────────────────────────────────────┤
│ 🤖 AANBEVOLEN ACTIE                                    │
│    "Start matching proces"                              │
│    [Start matching button]                              │
├─────────────────────┬────────────────┬──────────────────┤
│ Case Information    │ Samenvatting   │ AI Insights      │
│                     │ 🤖             │ 🤖               │
│ • Cliënt           │ • Key points   │ Risicosignalen   │
│ • Regio            │                │                  │
│ • Zorgtype         │ SystemInsight  │ Process Status   │
│                     │ 🤖             │                  │
└─────────────────────┴────────────────┴──────────────────┘
```

### Matching Page

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 AANBEVOLEN ACTIE                                    │
│    "Match met Jeugdhulp Noord"                          │
├─────────────────────────────────────┬───────────────────┤
│ Provider Cards                      │ AI Insights       │
│                                     │ 🤖                │
│ ┌─────────────────────────────┐   │ Risicosignalen    │
│ │ Provider #1 (94%)            │   │                   │
│ │ MatchExplanation 🤖         │   │ Match Criteria    │
│ └─────────────────────────────┘   │                   │
│                                     │ SystemInsight 🤖  │
│ ┌─────────────────────────────┐   │                   │
│ │ Provider #2 (78%)            │   │                   │
│ │ MatchExplanation 🤖         │   │                   │
│ └─────────────────────────────┘   │                   │
└─────────────────────────────────────┴───────────────────┘
```

### Plaatsing Page

```
┌─────────────────────────────────────────────────────────┐
│ [Header]                                                │
├─────────────────────┬────────────────┬──────────────────┤
│ Case Summary        │ Selected       │ What Happens     │
│                     │ Provider       │ Next             │
│ Validation          │                │                  │
│ Checklist           │ MatchExpl 🤖  │ Timeline         │
│                     │                │                  │
│ SystemInsight 🤖   │                │ Notifications    │
└─────────────────────┴────────────────┴──────────────────┘
```

### Intake Page

```
┌─────────────────────────────────────────────────────────┐
│ [Header]                                                │
├─────────────────────┬────────────────┬──────────────────┤
│ Intake Briefing     │ Timeline       │ Critical Notes   │
│                     │                │ 🤖               │
│ Samenvatting 🤖    │ Events         │ Risicosignalen   │
│                     │                │                  │
│ Recommended         │                │                  │
│ Approach            │                │                  │
└─────────────────────┴────────────────┴──────────────────┘
```

---

## Visual Style Guide

### Colors

```
Purple (#8B5CF6)  - Actions, recommendations
Red    (#EF4444)  - Critical risks
Amber  (#F59E0B)  - Warnings
Blue   (#3B82F6)  - Info
Green  (#22C55E)  - Success, positive
```

### Typography

- **Titles**: 14px, font-semibold, text-foreground
- **Body**: 12px, text-muted-foreground
- **Explanations**: leading-relaxed, break-words

### Spacing

- **Component padding**: p-4 (16px)
- **Component gaps**: space-y-4 (16px)
- **Compact mode**: p-2.5, space-y-1.5

---

## Tone & Voice (Dutch)

### ✅ DO USE

- "Aanbevolen"
- "Waarom deze match?"
- "Let op"
- "Overweeg"
- "Systeem heeft geïdentificeerd"
- "Verwachte timeline"

### ❌ AVOID

- "AI denkt dat..."
- "Misschien..."
- "Waarschijnlijk..."
- "Wij raden aan..." (use "Aanbevolen")
- Overly confident language
- Vague wording

---

## Decision Logic Examples

### Recommended Action Logic

```tsx
const getRecommendation = (caseData) => {
  // Blocked cases
  if (caseData.status === "blocked") {
    return {
      title: "Escaleer naar capaciteitsmanager",
      explanation: "Geen geschikte aanbieders beschikbaar...",
      actionLabel: "Escaleer case",
      variant: "urgent"
    };
  }

  // Ready for matching
  if (caseData.status === "matching") {
    return {
      title: "Start matching proces",
      explanation: "Beoordeling is compleet. Systeem heeft 3 matches...",
      actionLabel: "Start matching",
      confidence: "high"
    };
  }

  // Default
  return {
    title: "Wacht op beoordeling",
    explanation: "Beoordeling is ingepland...",
    actionLabel: "Bekijk beoordeling"
  };
};
```

### Risk Signal Logic

```tsx
const getRiskSignals = (caseData, providers) => {
  const signals = [];

  // No capacity available
  if (providers.every(p => p.availableSpots === 0)) {
    signals.push({
      severity: "critical",
      message: "Geen providers met directe capaciteit in regio"
    });
  }

  // Urgent case with delay
  if (caseData.urgency === "high" && isDelayed) {
    signals.push({
      severity: "warning",
      message: "Urgente casus loopt vertraging op"
    });
  }

  return signals;
};
```

---

## Implementation Checklist

When adding AI layer to a page:

- [ ] Add `AanbevolenActie` at the top (if decision required)
- [ ] Add `Risicosignalen` to right sidebar (if risks exist)
- [ ] Add `Samenvatting` to center column (for overview)
- [ ] Add `SystemInsight` inline for status updates
- [ ] Use `AIInsightPanel` to wrap right sidebar AI components
- [ ] Keep text concise (< 15 words per bullet)
- [ ] Add `break-words` to all text elements
- [ ] Test with long text strings
- [ ] Verify 3-second comprehension rule
- [ ] Check semantic color usage

---

## Examples

See `/components/examples/` for full integration examples:

- `CaseDetailWithAI.tsx` - Complete case detail page
- `MatchingPageWithAI.tsx` - Provider matching page

---

## Notes

- This is NOT a chatbot
- This is NOT a separate AI page
- This IS an embedded intelligence layer
- Components should feel calm, structured, authoritative
- Always provide "why" with recommendations
- Use semantic colors consistently
- Keep cognitive load low
