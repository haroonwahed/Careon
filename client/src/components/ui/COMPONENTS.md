# Design System Components Library

## Overview

Six minimal, composable components that enforce the Design System Governance Addendum rules. These components map directly to the operational contract fields and prevent system drift through strict prop validation and fixed variants.

**Build Status**: ✅ All components compile without errors  
**Governance Alignment**: ✅ All components enforce DESIGN_SYSTEM_GOVERNANCE_ADDENDUM.md rules  

---

## Operational Contract Mapping

Every component maps to one or more fields from the standard operational contract:

```json
{
  "recommended_action": { "label": "", "reason": "" },
  "impact_summary": "",
  "attention_band": "now|today|monitor|waiting",
  "priority_rank": 1-5,
  "bottleneck_state": "matching|placement|aanbieder beoordeling",
  "escalation_recommended": false
}
```

---

## 1. RecommendedActionBlock

### Operational Contract Field
- Maps to: `recommended_action`

### Governance Rule
- **Mandatory** when user can take action
- **Rule**: No action without impact (enforced by requiring ImpactSummary as separate component)
- **Rule**: No business logic inside component

### Props Interface

```typescript
interface RecommendedActionBlockProps {
  label: string;                              // From: recommended_action.label
  reason: string;                             // From: recommended_action.reason
  icon?: ReactNode;
  onAction?: () => void;
  severity?: "critical" | "warning" | "info" | "neutral";  // From: attention_band
}
```

### Usage Example

```tsx
<RecommendedActionBlock
  label="Rond beoordeling af"
  reason="Zonder dit kan matching niet starten"
  severity="critical"
  onAction={() => navigateToCasusDetail()}
/>
```

**Important**: Use `ImpactSummary` component alongside this to show impact.

```tsx
<RecommendedActionBlock {...props} />
<ImpactSummary text="Ontgrendelt vervolgstap" type="accelerating" />
```

---

## 2. OperationalSignalStrip

### Operational Contract Field
- Maps to: Derived from `attention_band` or `bottleneck_state`

### Governance Rule
- **Only allowed when**:
  - Real operational issue exists (not informational)
  - Affects multiple items or system state
- **NOT allowed for**: Empty states, soft issues, generic information
- **Max 1 per page** (prevents signal overload)

### Props Interface

```typescript
interface OperationalSignalStripProps {
  severity: "critical" | "warning" | "info";
  message: string;           // No vague language (e.g., "2 casussen overschrijven wachttijdnorm")
  icon?: ReactNode;
  onAction?: () => void;
  actionLabel?: string;      // Must be actionable if onAction provided
}
```

### Usage Example

```tsx
<OperationalSignalStrip
  severity="critical"
  message="2 casussen overschrijden wachttijdnorm"
  actionLabel="Bekijk problematische casussen"
  onAction={() => scrollToProblemCases()}
/>
```

### Anti-Patterns (❌ Forbidden)

```tsx
// ❌ WRONG: Informational, not operational
<OperationalSignalStrip
  severity="info"
  message="Dit is een leuke tip"
/>

// ❌ WRONG: Empty state
<OperationalSignalStrip
  severity="info"
  message="Geen actieve casussen"
/>

// ❌ WRONG: Vague language
<OperationalSignalStrip
  severity="warning"
  message="Let op"
/>
```

---

## 3. PriorityBadge

### Operational Contract Field
- Maps to: `priority_rank` (and indirectly `escalation_recommended`)

### Governance Rule
- **Only allowed when**: Items are ranked or triaged (NOT for flat lists)
- **Fixed variants only**: No custom variants allowed (prevents vocabulary drift)
- **No business logic**: Backend decides which variant, UI only renders it
- **Max 1 badge per item**

### Props Interface

```typescript
interface PriorityBadgeProps {
  variant: "first" | "soon" | "monitor" | "waiting" | "escalate";
  compact?: boolean;  // Compact mode for space-constrained layouts
}
```

### Variant Meanings

| Variant | Label | Meaning |
|---------|-------|---------|
| `first` | Hoogste prioriteit | Act immediately |
| `soon` | Eerst oppakken | Schedule first |
| `monitor` | Monitoren | Watch for changes |
| `waiting` | Wacht op externe partij | Blocked externally |
| `escalate` | Escalatie aanbevolen | Requires escalation |

### Usage Example

```tsx
<PriorityBadge variant="first" />        {/* Red, highest priority */}
<PriorityBadge variant="soon" />         {/* Orange, upcoming */}
<PriorityBadge variant="monitor" />      {/* Yellow, watch */}
<PriorityBadge variant="waiting" />      {/* Blue, blocked */}
<PriorityBadge variant="escalate" />     {/* Red, escalation */}
```

### Anti-Patterns (❌ Forbidden)

```tsx
// ❌ WRONG: Custom variant
<PriorityBadge variant="custom-urgent" />

// ❌ WRONG: Creating new priority language
const customVariants = ["ultra-urgent", "somewhat-later"];
```

---

## 4. BottleneckBadge

### Operational Contract Field
- Maps to: `bottleneck_state`

### Governance Rule
- **Only allowed when**: Item actually blocks critical flow (NOT for general warnings)
- **Fixed variants only**: 3 variants (matching, placement, aanbieder beoordeling)
- **No duplicates**: Signal only the PRIMARY blocker, not every warning

### Props Interface

```typescript
interface BottleneckBadgeProps {
  variant: "matching" | "placement" | "aanbieder beoordeling";
}
```

### Variant Meanings

| Variant | Label | Meaning |
|---------|-------|---------|
| `matching` | Blokkeert matching | Prevents provider search |
| `placement` | Blokkeert plaatsing | Prevents placement completion |
| `aanbieder beoordeling` | Vertraagt beoordeling | Slows aanbieder beoordeling process |

### Usage Example

```tsx
{/* Only show if this item actually blocks a flow stage */}
{casusBlocksMatching && (
  <BottleneckBadge variant="matching" />
)}
```

### Anti-Patterns (❌ Forbidden)

```tsx
// ❌ WRONG: Multiple bottleneck badges on one item (signal overload)
<BottleneckBadge variant="matching" />
<BottleneckBadge variant="aanbieder beoordeling" />

// ❌ WRONG: For soft issues
<BottleneckBadge variant="matching" />  {/* When it might be a bottleneck */}
```

---

## 5. ImpactSummary

### Operational Contract Field
- Maps to: `impact_summary`

### Governance Rule
- **Mandatory** when action is shown (Rule: "No action without impact")
- **Type inferred** from text pattern OR explicitly set by backend logic
- **No business logic**: Text comes from backend, component only renders it
- **Must answer**: "What will this action change?"

### Props Interface

```typescript
interface ImpactSummaryProps {
  text: string;                                           // From: impact_summary
  type?: "positive" | "protective" | "accelerating";     // Optional (defaults to positive)
}
```

### Type Meanings

| Type | Icon | Meaning | Examples |
|------|------|---------|----------|
| `positive` | ↗️ | Increases likelihood or improves | "Vergroot kans op match" |
| `protective` | 🛡️ | Prevents or avoids issue | "Voorkomt SLA-overschrijding" |
| `accelerating` | ⚡ | Speeds up or unblocks | "Versnelt plaatsing" |

### Usage Example

```tsx
<RecommendedActionBlock
  label="Rond beoordeling af"
  reason="Blokt matching"
  severity="critical"
/>
<ImpactSummary 
  text="Ontgrendelt vervolgstap"
  type="accelerating"
/>
```

### Approved Impact Language

✅ **Approved**:
- "Vergroot kans op match"
- "Voorkomt SLA-overschrijding"
- "Versnelt plaatsing"
- "Vermindert capaciteitsdruk"
- "Ontgrendelt vervolgstap"

❌ **Forbidden**:
- "Dit kan helpen" (too vague)
- "Bekijk resultaten" (not an outcome)
- "Meer informatie" (not impact)

---

## 6. AttentionBand

### Operational Contract Field
- Maps to: `attention_band` (app-wide urgency vocabulary)

### Governance Rule
- **Single app-wide language**: 4 fixed levels only (ONE vocabulary across all pages)
- **No custom variants**: No page-specific urgency language allowed (prevents drift)
- **No business logic**: Backend decides level, UI only renders it
- **Consistent across all pages**: Same meaning everywhere

### Props Interface

```typescript
interface AttentionBandProps {
  level: "now" | "today" | "monitor" | "waiting";
}
```

### Level Meanings

| Level | Icon | Label | Meaning |
|-------|------|-------|---------|
| `now` | 🔴 | Directe actie | Immediate action required |
| `today` | 🟠 | Vandaag oppakken | Schedule for today |
| `monitor` | 🟡 | Monitoren | Watch and wait |
| `waiting` | 🔵 | Wacht op externe partij | Blocked by external party |

### Usage Example

```tsx
<AttentionBand level="now" />     {/* Red: immediate */}
<AttentionBand level="today" />   {/* Orange: today */}
<AttentionBand level="monitor" /> {/* Yellow: monitor */}
<AttentionBand level="waiting" /> {/* Blue: blocked */}
```

### Critical Rule

All pages use the same `AttentionBand` language. This prevents users from seeing conflicting urgency levels:

```tsx
// ✅ CORRECT: Same case shows consistent urgency across all pages
<AttentionBand level="now" />  // On Casussen page
<AttentionBand level="now" />  // On Regiekamer page
<AttentionBand level="now" />  // On Matching page

// ❌ WRONG: Would break user trust
// Page A: <AttentionBand level="now" />
// Page B: <AttentionBand level="monitor" />  // Different meaning for same case!
```

---

## Composition Patterns

### Pattern 1: Recommended Action with Impact

```tsx
<div className="space-y-2">
  <RecommendedActionBlock
    label="Vraag beoordeling aan"
    reason="Aanbieder Beoordeling ontbreekt"
    severity="critical"
    onAction={handleRequestAssessment}
  />
  <ImpactSummary 
    text="Maakt matching mogelijk"
    type="accelerating"
  />
</div>
```

### Pattern 2: Signal Strip with Action

```tsx
<OperationalSignalStrip
  severity="critical"
  message="3 casussen blokkeren op beoordeling"
  actionLabel="Werklijst"
  onAction={goToPendingAssessments}
/>
```

### Pattern 3: Item with Priority and Status

```tsx
<div className="flex items-center gap-2">
  <PriorityBadge variant="first" />
  <AttentionBand level="now" />
  {blocksMatching && <BottleneckBadge variant="matching" />}
  <span className="text-sm">{casusLabel}</span>
</div>
```

---

## Governance Enforcement Summary

### Rule 1: Page Intensity Limits
Components respect page intensity levels:
- **HIGH** (Regiekamer): Multiple signal strips, all badges possible
- **MEDIUM-HIGH** (Casussen, Matching): Max 1 signal strip, limited badges
- **MEDIUM** (Aanbieder Beoordelingen, Plaatsingen): Minimal signals

### Rule 2: No Business Logic
Components contain ZERO business logic:
- ✅ Receive props from backend services
- ❌ Never decide urgency, priority, or bottlenecks internally

### Rule 3: Fixed Variants Only
Every component has exactly 3-5 fixed variants:
- ✅ `PriorityBadge`: 5 variants
- ✅ `BottleneckBadge`: 3 variants
- ✅ `AttentionBand`: 4 variants
- ❌ No custom variants allowed

### Rule 4: Single Source of Truth
Same operational logic flows through all pages:
- Service layer calculates `recommended_action`, `priority_rank`, `bottleneck_state`
- All pages consume same logic
- No logic duplication or divergence

### Rule 5: Mandatory Impact
Every action MUST show impact:
- Component enforces this by existing separately
- Backend MUST provide both `recommended_action` AND `impact_summary`
- UI cannot show action without ImpactSummary

---

## Integration Checklist

When adding these components to a page:

- [ ] Import all 6 components you'll use
- [ ] Props come from backend service/API response
- [ ] No hardcoded text (all text from backend)
- [ ] No business logic for determining severity/priority (from backend)
- [ ] Max 1 signal strip per page
- [ ] Respect page intensity limits
- [ ] Use only approved vocabulary
- [ ] Every action includes ImpactSummary
- [ ] Build passes with no errors
- [ ] Approved in design review before merge

---

## Files

```
client/src/components/ui/
├── RecommendedActionBlock.tsx     (Verb + reason + impact structure)
├── OperationalSignalStrip.tsx     (System-wide alerts)
├── PriorityBadge.tsx              (5 priority levels)
├── BottleneckBadge.tsx            (3 flow-blocking states)
├── ImpactSummary.tsx              (Outcome language)
├── AttentionBand.tsx              (4 urgency levels)
└── COMPONENTS.md                  (This file)
```

---

## Build Verification

```bash
cd client/
npm run build
# ✅ All components compile
# ✅ No TypeScript errors
# ✅ Production build succeeds
```

---

## Next Steps

**Phase 2**: Audit Regiekamer for consistency with primitives  
**Phase 3**: Implement on Casussen (add inherited decision signals)  
**Phase 4**: Implement on Aanbieder Beoordelingen (bottleneck language, action blocks)  
**Phase 5**: Implement on Matching (no-match signals, capacity language)  
**Phase 6**: Implement on Plaatsingen (provider response state, escalation)  
**Phase 7**: Extend to Providers, Regional, Reports  
