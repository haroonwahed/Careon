# Design System Inheritance Model

## Core Principle

**Regiekamer owns orchestration. Other pages own execution.**

Every operational page should inherit decision intelligence from Regiekamer's command center logic, but only Regiekamer should present the full command center experience. Each page type has a specific role, inheritance level, and design constraints.

---

## Page Type Specifications

### 1. Regiekamer (Strategic Control Tower)

**Role**: Full operational command center

**Uniquely Keeps**:
- Full command bar with tone-driven state
- Bottleneck stage visualization across full flow
- Cross-flow signal strips
- Predictive signals and forecasting
- Global operational prioritization

**Answers**:
- What is wrong now?
- What is about to go wrong?
- What should we do first?
- Where is the bottleneck in the chain?

**Borrows From Others**: Very little. This is the source page.

**Design Inheritance Level**: N/A (source)

---

### 2. Casussen (Tactical Triage Workspace)

**Role**: Front-line case routing and urgency sorting

**Should Inherit**:
- Recommended action guidance
- Why this matters language
- Impact summary per action
- Priority ranking
- Local signal badges
- Triage band classification
- Escalation recommendation

**Should NOT Inherit**:
- Full-width command bar
- Full-page tone system
- Global forecasting strip overload

**Best Pattern**:
Each casus card shows:
- Title / case reference
- Urgency / stage / phase
- 1–2 strongest signals only
- Recommended action
- Impact of that action
- Subtle rank/priority marker

**Ideal Top Strip**:
```
"2 casussen blokkeren matching door ontbrekende beoordeling"
"3 casussen hebben verhoogd risico op wachttijdoverschrijding"
```
Context without stealing Regiekamer's job.

**Design Inheritance Level**: **HIGH** — Most like Regiekamer's operational child

---

### 3. Beoordelingen (Decision Completion Workspace)

**Role**: Assessment bottleneck management

**Should Inherit**:
- Bottleneck language
- Downstream impact language
- Urgency-aware sorting
- Local signal strip
- Recommended next action on each item

**Should NOT Inherit**:
- Predictive overload
- Multi-signal command architecture
- Complex system-tone dominance

**Best Pattern**:
Each beoordeling row answers:
- What is missing?
- What is blocked because of it?
- What should happen now?

Example:
```
"Psychiatrische beoordeling ontbreekt"
"Blokkeert matching voor deze casus"
"Vraag beoordeling aan → maakt matching mogelijk"
```

**Ideal Header Pattern**:
```
Light local action banner:
"2 urgente beoordelingen blokkeren doorstroom"
CTA: "Werk beoordelingen af"
```

**Design Inheritance Level**: **MEDIUM-HIGH** — Sharp and consequential, calmer than Regiekamer

---

### 4. Matching (Friction Resolution Workspace)

**Role**: Provider fit and capacity problem-solving

**Should Inherit**:
- No-match signals
- Capacity-pressure language
- Reason-for-failure explanations
- Action impact summaries
- Bottleneck-aware badges
- Local predictive signals only when relevant

**Should NOT Inherit**:
- Global orchestration UI
- Full predictive layer at all times
- Heavy command-center framing

**Best Pattern**:
Each matching item shows:
- Provider fit status
- Blockers
- Capacity/wait explanation
- Next best action
- Impact of action

Example:
```
"Geen passende aanbieder gevonden"
"Capaciteitstekort in regio Utrecht"
"Vergroot zoekgebied → verhoogt kans op match"
```

**Ideal Top Strip**:
```
"3 casussen hebben geen match door capaciteitsdruk"
CTA: "Bekijk matchingproblemen"
```

**Design Inheritance Level**: **HIGH** — Very operational; matching is a main pressure zone

---

### 5. Plaatsingen (Follow-Through Workspace)

**Role**: Provider response and deadline protection

**Should Inherit**:
- Waiting-on-provider signals
- Escalation recommendations
- Deadline risk language
- Action impact summaries
- Local urgency strip

**Should NOT Inherit**:
- Full flow-bar command experience
- Broad predictive summaries unrelated to placement
- Too many competing signals

**Best Pattern**:
Each placement item shows:
- Current status
- Provider response state
- Whether it is stalled
- Next action
- Impact of action

Example:
```
"Providerreactie blijft uit"
"Plaatsing vertraagt"
"Herinner aanbieder → verkleint kans op vertraging"

OR

"Geen reactie na 2 reminders"
"Escalatie aanbevolen"
"Escaleren → versnelt besluitvorming"
```

**Design Inheritance Level**: **MEDIUM-HIGH** — Flow protection, not discovery

---

### 6. Zorgaanbieders (Capacity and Capability Workspace)

**Role**: Provider availability and pressure monitoring

**Should Inherit**:
- Capacity warning chips
- Wait pressure indicators
- Operational badges
- Subtle risk summaries

**Should NOT Inherit**:
- Command bar
- Triage ranking like cases
- Heavy predictive framing across the page

**Best Pattern**:
Provider cards/rows show:
- Capacity state
- Wait pressure
- Care type fit
- Operational availability signal

Example:
```
"Volgepland"
"Gem. wachttijd 18 dagen"
"Capaciteitsdruk hoog"
```

**Ideal Top Strip**:
```
"4 aanbieders in regio Amsterdam zitten op of boven capaciteit"
```

**Design Inheritance Level**: **LOW-MEDIUM** — More resource-oriented than decision-oriented

---

### 7. Gemeenten / Regio / Institution Pages (Oversight Workspace)

**Role**: Regional policy and capacity planning

**Should Inherit**:
- Aggregated signal language
- Bottleneck summaries
- Capacity and wait pressure indicators
- Trend/pattern strips

**Should NOT Inherit**:
- Case-level tactical action UI
- Full command bar drama
- High-frequency operational CTA behavior everywhere

**Best Pattern**:
Shows:
- Where pressure is rising
- Which providers/flows are under strain
- What regional intervention may help

Example:
```
"Capaciteitstekort in jeugd GGZ in regio Utrecht"
"3 casussen wachten langer dan norm"
"Herzie regionale spreiding"
```

**Design Inheritance Level**: **MEDIUM** — Informed and strategic, not tactical

---

### 8. Reports / Analytics (Reflection and Monitoring Workspace)

**Role**: Historical pattern and intervention analysis

**Should Inherit**:
- Bottleneck concepts
- Signal categorization
- Severity levels
- Flow-based framing

**Should NOT Inherit**:
- Urgent command styling
- Action-heavy cards everywhere
- Strong CTA language unless operationally actionable

**Best Pattern**:
Reports answer:
- Where pressure accumulates
- Where delays repeat
- What pattern needs intervention

This is where Regiekamer's logic becomes historical and analytical.

**Design Inheritance Level**: **MEDIUM** — Analytical reflection on orchestration

---

## App-Wide Design Primitives

These 6 components should be standardized and reusable across all operational pages (Regiekamer → Beoordelingen → Matching → Plaatsingen):

### 1. Recommended Action Block

**Structure**:
- Action (verb + target)
- Why now (the blocker or opportunity)
- Impact (outcome of action)

**Component**: `RecommendedActionBlock`

**Example**:
```
Action: "Rond beoordeling af"
Why: "Zonder dit kan matching niet starten"
Impact: "Ontgrendelt vervolgstap"
```

**Usage**: Every action-oriented page should use this for consistency.

---

### 2. Operational Signal Strip

**Structure**:
- Severity badge (critical / warning / info)
- Short issue summary
- Optional CTA

**Component**: `OperationalSignalStrip`

**Example**:
```
Severity: critical
Issue: "2 casussen overschrijden wachttijdnorm"
CTA: (optional)
```

**Usage**: Local action banners on Casussen, Beoordelingen, Matching, Plaatsingen

---

### 3. Priority Badge

**Variants**:
- `priority-first` — Hoogste prioriteit
- `priority-soon` — Eerst oppakken
- `priority-monitor` — Monitoren
- `priority-waiting` — Wacht op externe partij
- `priority-escalate` — Escalatie aanbevolen

**Component**: `PriorityBadge`

**Usage**: On every casus card and actionable item across operational pages

---

### 4. Bottleneck Badge

**Variants** (used locally on pages):
- `bottleneck-matching` — Blokkeert matching
- `bottleneck-placement` — Blokkeert plaatsing
- `bottleneck-assessment` — Vertraagt beoordeling

**Component**: `BottleneckBadge`

**Usage**: Signal that an item is blocking critical flow stages

---

### 5. Impact Summary

**Structure**: Short outcome-focused language

**Component**: `ImpactSummary`

**Examples**:
- "Vergroot kans op match"
- "Voorkomt SLA-overschrijding"
- "Versnelt plaatsing"
- "Vermindert wachttijd"

**Usage**: Appear alongside every action recommendation

---

### 6. Risk / Attention Band

**Shared app-wide language** (severity/urgency):
- `attention-now` — Directe actie
- `attention-today` — Vandaag oppakken
- `attention-monitor` — Monitoren
- `attention-waiting` — Wacht op externe partij

**Component**: `AttentionBand`

**Usage**: Standardizes urgency language across all pages

---

## Implementation Roadmap

### Phase 1: Create Core Primitives
1. `RecommendedActionBlock.tsx`
2. `OperationalSignalStrip.tsx`
3. `PriorityBadge.tsx`
4. `BottleneckBadge.tsx`
5. `ImpactSummary.tsx`
6. `AttentionBand.tsx`

### Phase 2: Update Regiekamer
- Already implements most patterns
- Audit for consistency with primitives
- Ensure it remains the source of truth

### Phase 3: Implement on Casussen
- Add inherited decision signals
- Use primitives for action blocks and badges
- Top strip with local operational insight

### Phase 4: Implement on Beoordelingen
- Bottleneck language throughout
- Recommended actions with impact
- Local urgency strip

### Phase 5: Implement on Matching
- No-match signals with capacity language
- Reason-for-failure explanations
- Local predictive signals only

### Phase 6: Implement on Plaatsingen
- Provider response state signals
- Deadline risk language
- Escalation recommendations

### Phase 7: Extend to Providers, Regional, Reports
- Apply inheritance model at appropriate level
- Use primitives for consistency

---

## Design Governance Rules

1. **Only Regiekamer decides global state** (tone, bottleneck, predictive signals)
2. **Other pages inherit signals, not orchestration**
3. **Every action must have impact language**
4. **Every signal must indicate why it matters**
5. **Use the 6 primitives consistently across pages**
6. **Local context trumps global command framing**
7. **Calm pages should never feel like Regiekamer**
8. **Decision pages should always show recommended next action**

---

## Vocabulary Standardization

### Operational Tone (Regiekamer → Casussen inheritance)
- ❌ "Alert" or "Notice" (too generic)
- ✅ "Blokkeert matching" (why it matters)
- ✅ "Overschrijdt wachttijd" (operational impact)

### Recommended Action Language
- ❌ "Open casus"
- ✅ "Rond beoordeling af → maakt matching mogelijk"

### Impact Language
- ✅ "Vergroot kans op match"
- ✅ "Voorkomt SLA-overschrijding"
- ✅ "Versnelt plaatsing"
- ✅ "Vermindert capaciteitsdruk"

### Priority Language
- Use only the 5 variants defined above
- Never invent new urgency/priority language
