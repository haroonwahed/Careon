# AI Decision Intelligence Layer - System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CAREON ZORGREGIE PLATFORM                       │
│                     (Healthcare Coordination)                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AI DECISION INTELLIGENCE LAYER                   │
│                    (Embedded across all pages)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Decision    │  │ Risk         │  │ Explanation  │             │
│  │ Engine      │  │ Detection    │  │ Generator    │             │
│  └─────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              UI COMPONENT LIBRARY                        │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │  • AanbevolenActie    (Recommendations)                  │    │
│  │  • Risicosignalen     (Risk Warnings)                    │    │
│  │  • Samenvatting       (Summaries)                        │    │
│  │  • MatchExplanation   (Match Reasoning)                  │    │
│  │  • SystemInsight      (Inline Feedback)                  │    │
│  │  • AIInsightPanel     (Container)                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW PAGES                              │
├─────────────────────────────────────────────────────────────────────┤
│  Regiekamer → Casussen → Beoordeling → Matching → Plaatsing → Intake│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. AanbevolenActie (Recommended Action)

```
INPUT                          PROCESSING                    OUTPUT
─────                          ──────────                    ──────

Case Status ──┐
              │
Urgency   ────┼──→  Decision Logic  ──→  ┌──────────────────┐
              │                          │ Title            │
Blockers  ────┘                          │ Explanation      │
                                         │ Action Button    │
                                         │ Confidence Badge │
                                         └──────────────────┘
```

**Decision Flow:**
```
if (status === "blocked") 
  → Urgent: "Escaleer naar capaciteitsmanager"

else if (status === "matching" && assessmentComplete)
  → Action: "Start matching proces"

else if (status === "assessment" && isDelayed)
  → Warning: "Neem contact op met beoordelaar"

else
  → Normal: "Volg standaard procedure"
```

---

### 2. Risicosignalen (Risk Detection)

```
INPUT                          PROCESSING                    OUTPUT
─────                          ──────────                    ──────

Capacity  ──┐
            │
Timeline ───┼──→  Risk Engine  ──→  ┌──────────────────┐
            │                        │ Critical Signals │
Urgency  ───┘                        │ Warnings         │
                                     │ Info             │
                                     └──────────────────┘
```

**Risk Priority:**
```
1. CRITICAL (Red)    - Blocking issues, no capacity
2. WARNING (Amber)   - Delays, sub-optimal conditions
3. INFO (Blue)       - Monitoring points, awareness
```

**Example Rules:**
```
if (providers.all(p => p.capacity === 0))
  → CRITICAL: "Geen beschikbare capaciteit"

if (urgency === "high" && responseTime > 6)
  → WARNING: "Urgente casus met lange reactietijd"

if (hasWaitlist)
  → INFO: "Monitor wekelijks voor escalatie"
```

---

### 3. MatchExplanation (Match Reasoning)

```
INPUT                          PROCESSING                    OUTPUT
─────                          ──────────                    ──────

Provider Data ──┐
                │
Match Score ────┼──→  Explanation  ──→  ┌──────────────────┐
                │      Generator        │ Score Badge      │
Case Needs  ────┘                       │ Strengths (✓)    │
                                        │ Trade-offs (⚠)   │
                                        │ Confidence       │
                                        └──────────────────┘
```

**Scoring Logic:**
```
Match Score = weighted_sum(
  specialization_match * 0.35,
  capacity_available * 0.25,
  response_time * 0.20,
  rating * 0.10,
  region_match * 0.10
)

Confidence = function(score, data_quality)
  if (score >= 90 && complete_data) → "high"
  if (score >= 75) → "medium"
  else → "low"
```

---

### 4. SystemInsight (Status Updates)

```
INPUT                          OUTPUT
─────                          ──────

Event Type ──→  ┌─────────────────────────┐
                │ [Icon] Message          │
Message    ──→  │                         │
                │ Semantic Color          │
                └─────────────────────────┘
```

**Type Mapping:**
```
info       → Blue    → ℹ️  "Informational update"
warning    → Amber   → ⚠️  "Caution needed"
success    → Green   → ✓  "Positive signal"
blocked    → Red     → ✕  "Process blocked"
suggestion → Purple  → 💡 "Consider this"
```

---

## Data Flow Architecture

### Page Load → AI Layer Activation

```
1. USER NAVIGATES TO PAGE
   │
   ▼
2. FETCH CASE DATA
   │
   ▼
3. RUN DECISION LOGIC
   ├─→ getRecommendation(caseData)
   ├─→ getRiskSignals(caseData, providers)
   ├─→ getSummary(caseData)
   └─→ getMatchExplanations(matches)
   │
   ▼
4. RENDER AI COMPONENTS
   ├─→ AanbevolenActie (top)
   ├─→ Samenvatting (center)
   ├─→ Risicosignalen (right)
   └─→ SystemInsight (inline)
   │
   ▼
5. USER TAKES ACTION
   │
   ▼
6. UPDATE STATE → RE-RUN LOGIC → UPDATE UI
```

---

## Page Integration Map

### Casus Detail Page

```
┌────────────────────────────────────────────────────────┐
│ [Header: Case ID + Badges]                            │
├────────────────────────────────────────────────────────┤
│ 🤖 AanbevolenActie                                    │
│    "Start matching proces"                             │
│    Decision Logic: status === "matching"               │
├──────────────┬──────────────────┬─────────────────────┤
│ Case Info    │ 🤖 Samenvatting  │ 🤖 AIInsightPanel   │
│ (Static)     │ (Dynamic summary)│ • Risicosignalen    │
│              │                  │ • Process status    │
│              │ 🤖 SystemInsight │                     │
│              │ (Status updates) │                     │
└──────────────┴──────────────────┴─────────────────────┘

AI Triggers:
- Status change → Update recommendation
- Risk detected → Add to signals
- Process update → SystemInsight
```

### Matching Page

```
┌────────────────────────────────────────────────────────┐
│ [Header]                                               │
├────────────────────────────────────────────────────────┤
│ 🤖 AanbevolenActie                                    │
│    "Match met Jeugdhulp Noord"                         │
│    Decision Logic: bestMatch.score > 90                │
├───────────────────────────────┬────────────────────────┤
│ Provider Cards                │ 🤖 AIInsightPanel      │
│                               │ • Risicosignalen       │
│ ┌──────────────────────────┐ │ • Match criteria       │
│ │ Provider #1              │ │ • Suggestions          │
│ │ 🤖 MatchExplanation     │ │                        │
│ │ (Why this match?)        │ │                        │
│ └──────────────────────────┘ │                        │
│                               │                        │
│ ┌──────────────────────────┐ │                        │
│ │ Provider #2              │ │                        │
│ │ 🤖 MatchExplanation     │ │                        │
│ └──────────────────────────┘ │                        │
└───────────────────────────────┴────────────────────────┘

AI Triggers:
- Match score calculated → Explanation generated
- No capacity → Risk signal
- High urgency → Suggestion shown
```

### Plaatsing Page

```
┌────────────────────────────────────────────────────────┐
│ [Header]                                               │
├──────────────┬──────────────────┬─────────────────────┤
│ Case Summary │ Selected Provider│ What Happens Next   │
│ (Static)     │                  │                     │
│              │ 🤖 MatchExpl.    │ Timeline            │
│ Validation   │ (Why selected?)  │ Notifications       │
│ Checklist    │                  │                     │
│              │                  │ 🤖 SystemInsight    │
│ 🤖 SystemIns.│                  │ "All ready"         │
└──────────────┴──────────────────┴─────────────────────┘

AI Triggers:
- Validation complete → Success insight
- Missing data → Warning insight
- Risk detected → Show in sidebar
```

---

## State Management

### AI Decision State

```typescript
interface AIDecisionState {
  recommendation: {
    title: string;
    explanation: string;
    actionLabel: string;
    confidence: "high" | "medium" | "low";
    variant?: "default" | "urgent";
    onAction: () => void;
  };
  
  riskSignals: Array<{
    severity: "critical" | "warning" | "info";
    message: string;
  }>;
  
  summary: Array<{
    text: string;
    type: "success" | "warning" | "info" | "default";
  }>;
  
  insights: Array<{
    type: "info" | "warning" | "success" | "blocked" | "suggestion";
    message: string;
  }>;
}
```

### Decision Logic Hooks

```typescript
// Custom hook pattern
function useAIDecisionLayer(caseData: Case) {
  const recommendation = useMemo(
    () => getRecommendation(caseData),
    [caseData.status, caseData.urgency]
  );
  
  const riskSignals = useMemo(
    () => getRiskSignals(caseData),
    [caseData.urgency, caseData.blockers]
  );
  
  const summary = useMemo(
    () => getSummary(caseData),
    [caseData]
  );
  
  return { recommendation, riskSignals, summary };
}
```

---

## Scalability & Future Enhancements

### Phase 1: Foundation (Current)
```
✅ Static decision rules
✅ Manual risk detection
✅ Template-based explanations
✅ Fixed confidence levels
```

### Phase 2: Data-Driven
```
🔄 Historical match success rates
🔄 Provider performance metrics
🔄 Waiting time predictions
🔄 Capacity forecasting
```

### Phase 3: Machine Learning
```
🔮 ML-based match scoring
🔮 Automated risk prediction
🔮 Natural language explanations
🔮 Personalized recommendations
```

### Phase 4: Adaptive Intelligence
```
🧠 Learning from user actions
🧠 Context-aware suggestions
🧠 Proactive risk detection
🧠 Workflow optimization
```

---

## Performance Considerations

### Component Optimization

```typescript
// Memoize expensive calculations
const recommendation = useMemo(() => 
  getRecommendation(caseData), 
  [caseData.status]
);

// Lazy load AI panel
const AIInsights = lazy(() => import('./AIInsightPanel'));

// Virtual scrolling for long risk lists
if (riskSignals.length > 10) {
  return <VirtualList items={riskSignals} />;
}
```

### Bundle Size

```
Core AI Components:  ~15KB gzipped
Icons (lucide):      ~3KB per icon
Total Addition:      ~20-25KB
```

---

## Monitoring & Analytics

### Key Metrics to Track

```
1. Recommendation Follow Rate
   - % of recommended actions taken
   
2. Risk Signal Accuracy
   - True positives vs false positives
   
3. Time to Decision
   - Time from page load to action
   
4. Explanation Clarity
   - User feedback on explanations
   
5. Confidence Calibration
   - High confidence → success rate
```

### Event Tracking

```typescript
// Track recommendation shown
trackEvent("ai_recommendation_shown", {
  caseId: caseData.id,
  recommendation: recommendation.title,
  confidence: recommendation.confidence
});

// Track action taken
trackEvent("ai_recommendation_followed", {
  caseId: caseData.id,
  action: recommendation.actionLabel
});

// Track risk signals
trackEvent("ai_risk_detected", {
  caseId: caseData.id,
  severity: signal.severity,
  type: signal.message
});
```

---

## Security & Privacy

### Data Handling

```
✅ No PII in explanations (use IDs only)
✅ Role-based AI features (show appropriate info per role)
✅ Audit trail for AI-assisted decisions
✅ Transparent reasoning (no black box)
```

### Compliance

```
✅ GDPR compliant (no personal data in AI layer)
✅ Explainable AI (all recommendations explained)
✅ Human-in-the-loop (AI assists, human decides)
✅ Audit logging (track AI influence on decisions)
```

---

## Summary

The AI Decision Intelligence Layer is:

- **Embedded** - Not a separate chatbot or page
- **Contextual** - Aware of workflow and case status
- **Explainable** - Every recommendation has reasoning
- **Action-oriented** - Always leads to next step
- **Scalable** - Built for future ML enhancements
- **Performant** - Minimal bundle size, optimized rendering
- **Compliant** - GDPR-friendly, explainable AI

**The system transforms Careon from a data display platform into an intelligent decision support system.**
