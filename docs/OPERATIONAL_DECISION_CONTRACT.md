# Operational Decision Contract
## Shared Unified Layer for All Pages

Foundation reference:

- `docs/ZORG_OS_FOUNDATION_APPROACH.md`
- `docs/FOUNDATION_LOCK.md`

This contract must remain aligned with the system-first workflow and backend source-of-truth rules defined there.

### Overview

The **Operational Decision Contract** is a centralized service that computes all operational decisions consistently across all pages in Careon.

**Problem Solved**: Previously, decision logic was scattered across:
- `views.py` (embedded in view functions)
- `regiekamer_service.py` (issue buckets, priority ranking)
- `case_intelligence.py` (SLA detection)
- `governance.py` (logging decisions)
- `provider_metrics.py` (behavioral signals)

This created:
- ❌ Logic duplication across pages
- ❌ Inconsistent decisions for same case data
- ❌ Hard to test and maintain
- ❌ No shared vocabulary for decisions

**Solution**: One unified service that:
- ✅ Computes all 6 decision fields consistently
- ✅ Reusable by all pages (Regiekamer, Casussen, Aanbieder Beoordelingen, Matching, Plaatsingen)
- ✅ Zero business logic in UI components
- ✅ Comprehensive fallback handling
- ✅ Fully tested

---

## The 6 Decision Fields

### 1. `recommended_action: Optional[RecommendedAction]`

**What**: The next action the operator should take now

**Example**:
```
{
    "label": "Rond beoordeling af",
    "reason": "Nodig voordat matching kan starten",
    "action_type": "review",
    "target_url": "/beoordeling/123/bewerk/"
}
```

**Possible actions**:
- `review`: Perform/complete an aanbieder beoordeling
- `assign`: Select and assign a provider
- `rematch`: Start matching over
- `escalate`: Escalate to management
- `monitor`: Watch for changes

### 2. `impact_summary: Optional[ImpactSummary]`

**What**: Why this action matters (outcome-focused language)

**Example**:
```
{
    "text": "Ontgrendelt vervolgstap",
    "impact_type": "accelerating"  # positive|protective|accelerating
}
```

**When shown**: Always paired with recommended action
**When hidden**: When no action needed

### 3. `attention_band: AttentionBandLevel`

**What**: App-wide urgency vocabulary (ONE source of truth)

**Values**:
- `NOW` — Direct immediate action
- `TODAY` — Schedule today
- `MONITOR` — Watch for changes
- `WAITING` — External party has ball

**Example logic**:
```
if escalation_signal_open:
    band = NOW
elif bottleneck and high_urgency:
    band = NOW
elif bottleneck:
    band = TODAY
elif placement_pending:
    band = MONITOR
elif placement_approved:
    band = WAITING
else:
    band = MONITOR (default)
```

### 4. `priority_rank: int` (1-100)

**What**: Numeric ranking for sorting/triage (1 = highest)

**Formula**:
```
base_urgency_weight (CRISIS=400, HIGH=300, MEDIUM=200, LOW=100)
  + waiting_days (capped at 30)
  - 15 (if bottleneck exists)
  - 20 (if escalation signal)
  
capped to [1, 100]
```

**Bands**:
- `FIRST` (1-5): Highest priority
- `SOON` (6-15): Soon
- `MONITOR` (16-30): Monitor
- `WAITING` (31-50): Waiting
- `ESCALATE` (51+): Escalation needed

### 5. `bottleneck_state: BottleneckState`

**What**: Which flow stage is blocked (if any)

**Values**:
- `ASSESSMENT` — Aanbieder Beoordeling incomplete/missing
- `MATCHING` — No provider match found
- `PLACEMENT` — Provider response stalled
- `NONE` — Case flowing normally

**Detection logic**:
```
if assessment_incomplete and status in [ASSESSMENT, MATCHING, DECISION]:
    ASSESSMENT
elif no_match_found and status in [MATCHING, DECISION]:
    MATCHING
elif placement_stalled:
    PLACEMENT
else:
    NONE
```

### 6. `escalation_recommended: bool`

**What**: Whether escalation to management is suggested

**Triggers**:
- Open escalation signal
- Critical risk signal
- Placement rejected + multiple reminders

---

## Architecture

### The Flow

```
Case Data
    ↓
OperationalDecisionBuilder
    ├─ Loads: intake, aanbieder beoordeling, placement, signals
    ├─ Computes 6 fields independently
    └─ Returns: OperationalDecision (complete, immutable)
    ↓
Pages consume ↓
    ├─ Regiekamer (dashboard)
    ├─ Casussen (case list)
    ├─ Aanbieder Beoordelingen (aanbieder beoordeling)
    ├─ Matching (provider selection)
    └─ Plaatsingen (placement status)
```

### Key Design Principles

1. **Single Responsibility**: Each field computed independently
2. **Fallback Safe**: Always returns valid default if data missing
3. **Immutable**: OperationalDecision is a frozen dataclass
4. **No Side Effects**: Pure computation, no updates to database
5. **Testable**: Each decision sub-function independently tested
6. **Consistent**: Same case always produces same decision

---

## Usage

### Simple: Get Decision for One Case

```python
from contracts.operational_decision_contract import build_operational_decision_for_intake

# Single case
decision = build_operational_decision_for_intake(intake_id=42)

if decision:
    print(f"Action: {decision.recommended_action.label}")
    print(f"Priority: {decision.priority_rank}")
    print(f"Attention: {decision.attention_band.value}")
```

### Advanced: Build Decisions for Organization

```python
from contracts.operational_decision_contract import build_operational_decisions_for_organization

# All active cases in org
decisions = build_operational_decisions_for_organization(org_id=5)

# Sort by priority
sorted_decisions = sorted(decisions, key=lambda d: d.priority_rank)

for decision in sorted_decisions[:10]:
    print(f"{decision.case_title}: {decision.attention_band.value}")
```

### In a View

```python
def regiekamer_dashboard(request):
    org = get_user_organization(request.user)
    decisions = build_operational_decisions_for_organization(org.id)
    
    # Group by attention band
    by_band = {}
    for decision in decisions:
        band = decision.attention_band.value
        if band not in by_band:
            by_band[band] = []
        by_band[band].append(decision)
    
    return render(request, 'regiekamer.html', {
        'by_band': by_band,
        'total_now': len(by_band.get('now', [])),
    })
```

### In a Template

```jinja2
{% for decision in now_decisions %}
  <div class="operational-signal">
    <div class="recommended-action">
      <label>{{ decision.recommended_action.label }}</label>
      <reason>{{ decision.recommended_action.reason }}</reason>
      <a href="{{ decision.recommended_action.target_url }}">
        {{ decision.recommended_action.action_type }}
      </a>
    </div>
    
    <div class="impact-summary">
      {% if decision.impact_summary %}
        <text>{{ decision.impact_summary.text }}</text>
        <type>{{ decision.impact_summary.impact_type }}</type>
      {% endif %}
    </div>
    
    <div class="priority">
      <rank>{{ decision.priority_rank }}</rank>
      <band>{{ decision.priority_band }}</band>
    </div>
    
    <div class="blocker">
      {{ decision.blocker_label }}
    </div>
  </div>
{% endfor %}
```

### Serialization for API

```python
decision = build_operational_decision_for_intake(42)
json_data = decision.to_dict()

# Ready for JSON response
from django.http import JsonResponse
return JsonResponse(json_data)
```

---

## Data Model

### OperationalDecision (Immutable)

```python
@dataclass
class OperationalDecision:
    # Core
    case_id: int
    case_title: str
    case_status: str
    urgency: str
    
    # The 6 Decision Fields
    recommended_action: Optional[RecommendedAction]
    impact_summary: Optional[ImpactSummary]
    attention_band: AttentionBandLevel
    priority_rank: int
    bottleneck_state: BottleneckState
    escalation_recommended: bool
    
    # Supporting Context
    priority_band: PriorityRankBand
    blocker_key: Optional[str]
    blocker_label: Optional[str]
    waiting_days: int
    open_signal_count: int
    assessment_status: Optional[str]
    placement_status: Optional[str]
    provider_response_status: Optional[str]
    sla_state: Optional[str]
    
    # Flags
    is_urgent: bool
    is_stalled: bool
    requires_action: bool
    
    # Metadata
    computed_at: datetime
```

### RecommendedAction

```python
@dataclass
class RecommendedAction:
    label: str              # "Rond beoordeling af"
    reason: str             # "Nodig voor matching"
    action_type: str        # review|assign|rematch|escalate|monitor
    target_url: Optional[str]  # Where to click
```

### ImpactSummary

```python
@dataclass
class ImpactSummary:
    text: str              # "Ontgrendelt vervolgstap"
    impact_type: str       # positive|protective|accelerating
```

---

## Testing

### Run Tests

```bash
# All operational decision tests
python manage.py test tests.test_operational_decision_contract

# Specific test class
python manage.py test tests.test_operational_decision_contract.AttentionBandTests

# With coverage
coverage run --source='contracts.operational_decision_contract' manage.py test
coverage report
```

### Test Coverage

✅ Basic decision building (different case states)
✅ Attention band logic (all urgency levels)
✅ Priority ranking (urgency vs waiting time)
✅ Bottleneck detection (all flow stages)
✅ Escalation logic (signals & conditions)
✅ Recommended actions (all action types)
✅ Impact summaries (action-to-impact mapping)
✅ Serialization (to_dict() output)
✅ Organization-level decisions
✅ Edge cases (missing data, invalid IDs)

---

## Migration Guide: Refactor Existing Pages

### Before (Scattered Logic)

**regiekamer_service.py**:
```python
def _compute_issue_buckets(intakes):
    # Duplicated issue detection
    blocked_cases = [...]
    open_beoordelingen = [...]
    # ... scattered logic
```

**views.py**:
```python
def regiekamer_dashboard(request):
    buckets = _compute_issue_buckets(intakes)
    priority_queue = _build_priority_queue(buckets)
    # ... more scattered logic
```

### After (Unified)

**views.py**:
```python
from contracts.operational_decision_contract import (
    build_operational_decisions_for_organization
)

def regiekamer_dashboard(request):
    org = get_user_organization(request.user)
    decisions = build_operational_decisions_for_organization(org.id)
    
    # Organize by attention band
    by_band = {}
    for decision in decisions:
        band = decision.attention_band.value
        if band not in by_band:
            by_band[band] = []
        by_band[band].append(decision)
    
    return render(request, 'regiekamer.html', {'by_band': by_band})
```

### Benefits

✅ No duplicate issue detection logic
✅ Consistent decisions across all pages
✅ Easier to test (single source of truth)
✅ Cleaner view code
✅ Easy to add new pages (just call the service)

---

## Vocabulary Guarantees

### Attention Band (App-Wide Standard)

This is THE vocabulary for urgency across all pages:

| Band | Meaning | Examples |
|------|---------|----------|
| NOW | Direct action now | Escalation signal, crisis + aanbieder beoordeling incomplete |
| TODAY | Schedule for today | Bottleneck + high urgency, stalled case |
| MONITOR | Watch for changes | Provider response pending |
| WAITING | External party | Placement approved, provider deciding |

✅ **Single source**: `AttentionBandLevel` enum in operational_decision_contract.py
✅ **No custom bands**: Components must use these 4 values only
✅ **Enforced**: Governance prevents drift

### Action Types

| Type | Trigger | Example |
|------|---------|---------|
| `review` | Incomplete aanbieder beoordeling | Aanbieder Beoordeling ontbreekt |
| `assign` | No provider | Matching | 
| `rematch` | Provider rejected | Plaatsing afgewezen |
| `escalate` | Escalation signal | High risk |
| `monitor` | Default | Case flowing |

### Priority Bands

| Band | Ranks | Examples |
|------|-------|----------|
| FIRST | 1-5 | Crisis + bottleneck |
| SOON | 6-15 | High urgency |
| MONITOR | 16-30 | Medium priority |
| WAITING | 31-50 | Low priority |
| ESCALATE | 51+ | Out of range |

---

## Troubleshooting

### "Decision is None"

→ Intake doesn't exist or was deleted
→ Check intake_id exists before calling

### "Bottleneck shows NONE but case is blocked"

→ May need to review bottleneck detection logic
→ Check: aanbieder beoordeling status, placement status, signals
→ Add debug print to understand which condition was hit

### "Same case, different decision on second call"

→ Suggests case was updated between calls
→ Decisions are computed fresh each time (not cached)
→ If consistency needed, add caching layer

### "Tests fail after model change"

→ Ensure CaseIntakeProcess/CaseAssessment test fixtures still valid
→ Check field defaults in model migrations
→ Update test expectations if logic should change

---

## Performance Considerations

### Query Optimization

```python
# Good: Prefetch related data
intakes = CaseIntakeProcess.objects.select_related(
    'case_assessment',
).prefetch_related(
    'indications',
).all()

# Each build_for_intake call uses prefetched data
for intake in intakes:
    decision = OperationalDecisionBuilder.build_for_intake(intake)
```

### Caching

```python
# Optional: Cache decisions for dashboard display
from django.core.cache import cache

def get_org_decisions_cached(org_id, ttl=300):
    key = f'org_decisions_{org_id}'
    decisions = cache.get(key)
    if decisions is None:
        decisions = build_operational_decisions_for_organization(org_id)
        cache.set(key, decisions, ttl)
    return decisions
```

### Batch Processing

```python
# Efficient: Process in batches
BATCH_SIZE = 100
for offset in range(0, total_intakes, BATCH_SIZE):
    batch = intakes[offset:offset+BATCH_SIZE]
    for intake in batch:
        decision = OperationalDecisionBuilder.build_for_intake(intake)
```

---

## Future Extensions

### Planned Features

1. **Decision Caching**: Cache decisions for 5min dashboard display
2. **Decision History**: Track how decisions change over time
3. **Decision Explainability**: API showing which rules triggered
4. **Decision Overrides**: Allow operators to override system recommendations
5. **A/B Testing**: Compare decision strategies without changing code

### How to Add

All logic is in `operational_decision_contract.py`:

```python
# To add new decision factor:
# 1. Update OperationalDecision dataclass
# 2. Add computation method
# 3. Call from build_for_intake()
# 4. Add tests
# 5. Document here
```

---

## Support

For questions about the operational decision contract:

1. Check test cases for examples
2. Review `_determine_*` methods in OperationalDecisionBuilder
3. Check governance/design system docs
4. Add issue to ticket tracker
