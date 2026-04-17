# Regiekamer Control Center - Complete Documentation

## 🎯 Vision

The **Regiekamer** is NOT a dashboard. It is a **command center** - an operational control tower where users monitor the system, detect issues, prioritize work, and navigate to cases that need action.

**Users do NOT execute workflows here. They decide WHERE to act.**

---

## 🔄 Transformation

### Before: Passive Dashboard
```
❌ Static data display
❌ Manual scanning required
❌ No prioritization
❌ Unclear next steps
❌ Dashboard feel
```

### After: Active Control Tower
```
✅ System actively communicates
✅ Intelligent prioritization
✅ Clear next actions
✅ Guided navigation
✅ Operational cockpit feel
```

---

## 📐 Page Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER                                                          │
│  Regiekamer                                                      │
│  Casussen die aandacht nodig hebben      [Exporteer rapport]    │
├──────────────────────────────────────────────────────────────────┤
│  🤖 AI COMMAND STRIP (NEW - PRIMARY FEATURE)                    │
│  2 casussen vereisen directe actie • 3 dossiers blokkeren       │
│  matching • Capaciteitstekort in regio Utrecht                  │
│                                      [Bekijk urgente casussen]   │
├──────────────────────────────────────────────────────────────────┤
│  KPI BLOCKS (ENHANCED - CLICKABLE)                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │ Zonder  │ │ Open    │ │ Plaatsing│ │ Wachttijd│ │ Hoog   │ │
│  │ Match   │ │ Beoor.  │ │ Bezig   │ │ (dagen) │ │ Risico  │ │
│  │   12    │ │    8    │ │    15   │ │    6    │ │    5    │ │
│  │ +2 ↑    │ │ -1 ↓    │ │ +3 ↑    │ │ ⚠ boven │ │ +1 ↑    │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  🤖 INLINE AI SIGNALS                                           │
│  ⚠️ 3 casussen wachten langer dan 7 dagen                       │
│  ℹ️ 2 casussen zonder beschikbare aanbieder binnen 48 uur       │
├──────────────────────────────────────────────────────────────────┤
│  FILTER + SEARCH BAR                                            │
│  [Search...] [Regio] [Status] [Urgentie]                       │
│  Gefilterd op: urgentie hoog                                    │
├──────────────────────────────────────────────────────────────────┤
│  ACTIEVE CASUSSEN (CORE WORKING AREA)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CASE-001         [Beoordeling] 12d ⚠️   Start beoordeling →│  │
│  │ Ambulant                                                    │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ CASE-002         [Matching] 8d ⚠️   Controleer matching →  │  │
│  │ Residentieel                                                │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🆕 New Features

### 1. AI Command Strip (PRIMARY INNOVATION)

**Purpose:** Tell the user what's happening NOW

**Location:** Full-width strip directly under header

**Content:**
```
2 casussen vereisen directe actie • 
3 dossiers blokkeren matching • 
Capaciteitstekort in regio Utrecht

[Bekijk urgente casussen] →
```

**Behavior:**
- Each segment is clickable
- Clicking filters the case list
- Optional CTA button for primary action
- Updates in real-time based on system state

**Design:**
```
Container:
  Padding: 20px
  Border left: 4px solid Primary
  Background: Primary/5%
  Border radius: 8px
  Border: 1px solid Primary/20%

Text:
  Font: Inter Regular 14px
  Clickable segments: Font semibold, colored (red/amber)
  Separators: " • " in muted color

CTA Button:
  Background: Red (for urgent)
  Size: Small
  Icon: ChevronRight
```

**Dynamic Content Logic:**
```typescript
const urgentCount = cases.filter(c => c.urgency === "high" || c.urgency === "critical").length;
const blockedCount = cases.filter(c => c.status === "blocked").length;
const capacityIssues = getCapacityIssues();

"${urgentCount} casussen vereisen directe actie • 
 ${blockedCount} dossiers blokkeren matching • 
 Capaciteitstekort in regio ${capacityIssues.region}"
```

---

### 2. Enhanced KPI Blocks (CLICKABLE)

**Old:** Static metrics  
**New:** Interactive filters with micro context

**Structure:**
```
┌─────────────────────┐
│ [Icon]           ● │  ← Active indicator (if clicked)
│                    │
│ 12                 │  ← Value (large, bold)
│ Casussen zonder    │  ← Label (small, muted)
│ match              │
│ +2 ↑               │  ← Context (colored, semantic)
└─────────────────────┘
```

**Micro Context Examples:**
- `+2` (green if down, red if up - depends on KPI)
- `↑ boven norm` (amber warning)
- `-1` (good for "open assessments")
- `urgent` (red critical status)

**Interaction:**
- **Click:** Filters case list to show only relevant cases
- **Active state:** Purple border, subtle shadow
- **Hover:** Scale up slightly (1.02)

**Status Colors:**
```
Good:     Green  #22C55E  (e.g., placements increasing)
Normal:   Blue   #3B82F6  (neutral metrics)
Warning:  Amber  #F59E0B  (above threshold)
Critical: Red    #EF4444  (urgent attention needed)
```

---

### 3. Next Action Column (CRITICAL ADDITION)

**Purpose:** Tell user exactly what to do next for each case

**Location:** Right side of each case row

**Examples:**
```
Status: intake       → "Start beoordeling"
Status: assessment   → "Voltooi beoordeling"
Status: matching     → "Controleer matching"
Status: placement    → "Bevestig plaatsing"
Status: blocked      → "Los blokkade op"
Status: completed    → "Archiveren"
Default:             → "Wacht op aanbieder reactie"
```

**Action Types:**
- **Urgent** (Red): Requires immediate action
- **Normal** (White): Standard next step
- **Waiting** (Muted): Passive state

**Visual:**
```
┌────────────────────────────────┐
│ Volgende actie:                │  ← Small label
│ Start beoordeling              │  ← Action (bold, colored)
└────────────────────────────────┘
```

---

### 4. Inline AI Signals

**Purpose:** Surface important patterns above case list

**Examples:**
```
⚠️ 3 casussen wachten langer dan 7 dagen
ℹ️ 2 casussen zonder beschikbare aanbieder binnen 48 uur
🔴 Capaciteitstekort: 5 urgente casussen, 0 beschikbare plekken
```

**Component:** Uses `SystemInsight` from AI components

**Types:**
- Warning: Delays, above-threshold wait times
- Info: System observations, trends
- Critical: Blocking issues

---

### 5. Intelligent Sorting

**Old:** Cases sorted by creation date  
**New:** Cases sorted by urgency + delay

**Algorithm:**
```typescript
cases.sort((a, b) => {
  // Priority 1: Urgency (critical > high > medium > low)
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  
  if (urgencyDiff !== 0) return urgencyDiff;
  
  // Priority 2: Waiting days (descending - longest wait first)
  return b.waitingDays - a.waitingDays;
});
```

**Result:**
- Critical + long wait → Top
- Critical + short wait → High
- High + long wait → High
- Low urgency → Bottom

---

## 🎨 Visual Design

### Layout

```
Container:
  Max width: 1920px
  Padding: 24px
  Space between sections: 24px

Command Strip:
  Full width
  Border left: 4px Purple
  Background: Purple/5%
  Padding: 20px

KPI Grid:
  Columns: 6 (desktop), 3 (laptop), 2 (tablet), 1 (mobile)
  Gap: 16px
  Card size: Auto (responsive)

Case List:
  Gap between rows: 8px
  Row padding: 16px
  Border left: 4px (urgency color)
```

### Color System

**Urgency Colors (Border Left):**
```
Critical: #EF4444 (Red)
High:     #F59E0B (Amber)
Medium:   rgba(59, 130, 246, 0.30) (Blue, subtle)
Low:      rgba(255, 255, 255, 0.10) (Muted)
```

**Status Colors (Badges):**
```
Intake:       Blue    #3B82F6
Beoordeling:  Purple  #8B5CF6
Matching:     Amber   #F59E0B
Plaatsing:    Green   #22C55E
Geblokkeerd:  Red     #EF4444
Afgerond:     Muted
```

**KPI Status Colors:**
```
Good:     Green #22C55E + bg-green-500/5
Normal:   Blue  #3B82F6 + bg-blue-500/5
Warning:  Amber #F59E0B + bg-amber-500/5
Critical: Red   #EF4444 + bg-red-500/5
```

### Typography

```
Page Title:       Inter Bold 30px
Section Headers:  Inter Bold 18px
KPI Values:       Inter Bold 24px
KPI Labels:       Inter Regular 11px
Case ID:          Inter Semibold 14px
Next Action:      Inter Semibold 14px
Body Text:        Inter Regular 14px
Small Labels:     Inter Regular 12px
```

---

## 🎬 Interactions

### Command Strip

**Clickable Segments:**
```
Default:
  Color: Semantic (red/amber)
  Font weight: Semibold
  Cursor: Pointer

Hover:
  Text decoration: Underline
  
Click:
  Apply filter to case list
  Scroll to case list
```

---

### KPI Cards

**States:**
```
Default:
  Border: 1px solid Border
  Background: Card
  Cursor: Pointer

Hover:
  Transform: scale(1.02)
  Transition: 200ms ease

Active (clicked):
  Border: 2px solid Primary
  Shadow: 0 8px 24px Primary/20%
  Active indicator: Pulsing dot (top-right)

Click:
  Toggle filter on/off
  Update case list
```

---

### Case Rows

**States:**
```
Default:
  Border left: 4px urgency color
  Background: Conditional (urgent cases get tint)
  Cursor: Pointer

Hover:
  Background: rgba(255,255,255,0.05)
  Next action color: Primary
  Chevron color: Primary
  Transition: 200ms ease

Click:
  Navigate to case detail page
```

---

## 📊 Data Logic

### System State Intelligence

```typescript
const systemState = {
  urgentCount: cases.filter(c => 
    c.urgency === "high" || c.urgency === "critical"
  ).length,
  
  blockedCount: cases.filter(c => 
    c.status === "blocked"
  ).length,
  
  delayedCount: cases.filter(c => 
    c.waitingDays > 7
  ).length,
  
  noMatchCount: cases.filter(c => 
    c.status === "matching" && c.waitingDays > 3
  ).length,
  
  capacityIssues: getRegionalCapacityIssues()
};
```

---

### KPI Calculations

```typescript
const kpis = {
  casesWithoutMatch: {
    value: cases.filter(c => 
      c.status === "matching" || c.status === "blocked"
    ).length,
    change: compareToYesterday(),  // "+2"
    trend: "up",
    status: "warning"
  },
  
  avgWaitingTime: {
    value: Math.round(
      cases.reduce((sum, c) => sum + c.waitingDays, 0) / cases.length
    ),
    change: compareToThreshold(7),  // "↑ boven norm" if > 7
    trend: "up",
    status: value > 7 ? "warning" : "normal"
  }
  
  // ... etc
};
```

---

### Next Action Logic

```typescript
const getNextAction = (caseItem: Case) => {
  const actionMap = {
    intake: { action: "Start beoordeling", type: "urgent" },
    assessment: { action: "Voltooi beoordeling", type: "urgent" },
    matching: { action: "Controleer matching", type: "urgent" },
    placement: { action: "Bevestig plaatsing", type: "normal" },
    blocked: { action: "Los blokkade op", type: "urgent" },
    completed: { action: "Archiveren", type: "waiting" }
  };
  
  return actionMap[caseItem.status] || 
    { action: "Wacht op aanbieder reactie", type: "waiting" };
};
```

---

## 🔗 User Flow

### Scenario 1: User Opens Regiekamer

**Step 1:** Page loads
- Header appears
- AI Command Strip shows: "2 casussen vereisen directe actie"
- KPIs load with context
- Cases sorted by urgency

**Step 2:** User scans (F-pattern)
1. Reads command strip → Sees 2 urgent cases
2. Glances at KPIs → Sees +2 cases without match (warning)
3. Sees inline signal → "3 casussen wachten langer dan 7 dagen"
4. Looks at case list → First row is critical case

**Step 3:** User takes action
- Option A: Click "Bekijk urgente casussen" button
- Option B: Click "Casussen zonder match" KPI
- Option C: Click specific case row

**Time:** <5 seconds to understand priorities

---

### Scenario 2: Filtering by KPI

**Step 1:** User clicks "Hoog risico casussen" KPI

**Step 2:** System responds
- KPI gets active state (purple border, dot)
- Case list filters to show only high-risk cases
- Filter chip appears: "Hoog risico"
- Count updates: "5 casussen"

**Step 3:** User reviews filtered cases
- All visible cases have risk icon
- Next actions visible for each
- Click case to investigate

**Step 4:** User clears filter
- Click KPI again OR
- Click "Wis filters" button

---

### Scenario 3: Navigating to Case

**Step 1:** User hovers case row
- Row highlights
- Next action text turns primary color
- Chevron animates

**Step 2:** User clicks row
- Navigate to case detail page
- Case detail shows full workflow

**Step 3:** User completes action
- Returns to Regiekamer
- Case status updated
- KPIs recalculated

---

## 📱 Responsive Behavior

### Desktop (1920px)
```
Layout: Full grid
KPIs: 6 columns
Command strip: Full width
Case rows: All columns visible
```

### Laptop (1440px)
```
Layout: Slightly condensed
KPIs: 3 columns
Command strip: Full width, may wrap
Case rows: All columns visible
```

### Tablet (1024px)
```
Layout: Vertical stack
KPIs: 2 columns
Command strip: Stacked content
Case rows: Simplified (2 rows)
  Row 1: ID, status, next action
  Row 2: Type, wait time, risk
```

### Mobile (375px)
```
Layout: Single column
KPIs: 1 column (cards)
Command strip: Stacked, no CTA
Case rows: Card layout
  - ID + Status
  - Next action prominent
  - Waiting time + risk
```

---

## ♿ Accessibility

### Keyboard Navigation

```
Tab:       Navigate between interactive elements
Enter:     Activate filter/case
Space:     Toggle filter
Esc:       Clear filters
Arrow ↑↓:  Navigate case list
```

### Screen Reader

**Command Strip:**
```
"System alert: 2 cases require immediate action. 
 3 cases are blocking matching. 
 Capacity shortage in region Utrecht. 
 Button: View urgent cases"
```

**KPI Cards:**
```
"Cases without match: 12. 
 Change: increased by 2 since yesterday. 
 Status: warning. 
 Click to filter cases."
```

**Case Rows:**
```
"Case CASE-001, Type: Ambulant, 
 Status: Assessment, Waiting 12 days, Risk: high. 
 Next action: Start assessment. 
 Click to open case."
```

---

## 🎯 Success Metrics

### Understanding Speed

**Target:** User knows what needs attention in <5 seconds

**Baseline:** 30-60 seconds scanning dashboard

**Improvement:** 83-90% faster

**Measure:**
- Eye tracking (first fixation)
- Think-aloud protocol
- Time to first action

---

### Decision Quality

**Target:** >90% of users act on correct priority

**Baseline:** Manual prioritization (inconsistent)

**Measure:**
- % following AI recommendation
- % clicking urgent cases first
- Reversal rate (% who backtrack)

---

### Navigation Efficiency

**Target:** <2 clicks to reach relevant case

**Baseline:** 3-5 clicks (search, filter, navigate)

**Improvement:** 33-60% fewer clicks

**Measure:**
- Click path analysis
- Time to case detail
- Bounce rate

---

## 🚀 Implementation Checklist

**Phase 1: Core Structure**
- [ ] Page layout with header
- [ ] AI Command Strip component
- [ ] Enhanced KPI grid
- [ ] Filter bar with defaults

**Phase 2: Case List**
- [ ] Actionable case row component
- [ ] Next action logic
- [ ] Intelligent sorting
- [ ] Empty states

**Phase 3: Intelligence**
- [ ] System state calculation
- [ ] KPI with micro context
- [ ] Inline AI signals
- [ ] Dynamic command strip

**Phase 4: Interactions**
- [ ] Command strip clickability
- [ ] KPI filter toggle
- [ ] Case row navigation
- [ ] Filter management

**Phase 5: Polish**
- [ ] Hover states
- [ ] Transitions
- [ ] Loading states
- [ ] Responsive breakpoints

**Phase 6: Testing**
- [ ] User testing (5-second test)
- [ ] Accessibility audit
- [ ] Performance optimization
- [ ] Analytics integration

---

## 📚 Files Created

```
Implementation:
  /components/care/RegiekamerControlCenter.tsx

Examples:
  /components/examples/RegiekamerDemo.tsx

AI Components (reused):
  /components/ai/SystemInsight.tsx

Documentation:
  /REGIEKAMER_REDESIGN_DOCS.md (this file)
  /REGIEKAMER_FIGMA_SPEC.md (design specs)
```

---

## 🎓 Design Principles Achieved

✅ **System Speaks:** AI Command Strip tells user what's happening  
✅ **Clear Priorities:** Urgency-based sorting + visual hierarchy  
✅ **Actionable:** Next action for every case  
✅ **Guided:** Clickable KPIs and command strip segments  
✅ **Operational Feel:** Control tower, not dashboard  

---

## 💡 Key Innovations

### 1. AI Command Strip
**Before:** User scans entire page  
**After:** System tells user in one sentence  

### 2. Next Action Column
**Before:** User opens case to see what to do  
**After:** User knows immediately  

### 3. Clickable KPIs
**Before:** Passive metrics  
**After:** Interactive filters  

### 4. Intelligent Sorting
**Before:** Chronological (meaningless)  
**After:** Urgency + delay (meaningful)  

---

## 🎉 Result

**User opens page and instantly knows:**

> "What needs my attention right now?"

**Answer visible in <5 seconds:**
- 2 casussen vereisen directe actie
- First case in list: CASE-001, Start beoordeling
- Click → Navigate → Act

**This is a control tower, not a dashboard.** ✅
