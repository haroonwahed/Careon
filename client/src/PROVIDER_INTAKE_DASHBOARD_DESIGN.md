# Provider Intake Dashboard - Professional Work Queue

## Overview

The **Provider Intake Dashboard** is the primary workspace for care providers (zorgaanbieders) who receive case referrals from municipalities after placement. This is **NOT a generic dashboard**—it's a **professional inbox and decision queue** that enables fast accept/reject decisions with minimal friction.

**Core Purpose:** Enable providers to quickly review incoming cases, understand urgency, and make confident accept/reject decisions in seconds.

---

## Design Philosophy

### Mental Model

The interface feels like:
> **"A professional inbox + Task queue + Decision workspace"**

NOT:
> ❌ "A generic dashboard with charts"  
> ❌ "A complex case management system"  
> ❌ "A passive data table"

### Core Principles

1. **INBOX-FIRST**: Newest and most urgent cases stand out
2. **FAST DECISION**: Accept/reject must be easy and clear
3. **CLARITY**: Provider understands case within seconds
4. **LOW FRICTION**: Minimal clicks to act
5. **TRUST**: Information feels complete and reliable

---

## Page Structure

```
┌────────────────────────────────────────────────────────────┐
│  HEADER                                                    │
│  Intake                                                    │
│  Nieuwe en lopende casussen                               │
└────────────────────────────────────────────────────────────┘

┌─────────────┬─────────────┬─────────────┬─────────────┐
│  KPI STRIP                                              │
│  Nieuwe: 2  │ Wacht: 1    │ Gepland: 1  │ Afgewezen: 0│
└─────────────┴─────────────┴─────────────┴─────────────┘

┌────────────────────────────────────────────────────────────┐
│  SEARCH & FILTERS                                          │
│  [Search...........................] [Filters (2)]        │
│  Status: All | Urgentie: All | Zorgtype: All             │
└────────────────────────────────────────────────────────────┘

┌──────────────────────────┬─────────────────────┐
│  CASE QUEUE (9 cols)     │  INFO PANEL(3 cols) │
│                          │                     │
│  ┌──────────────────┐    │  ┌───────────────┐ │
│  │ Case Card        │    │  │  Capaciteit   │ │
│  │ [NEW]            │    │  │  7/10 bezet   │ │
│  │ ✅ Accept        │    │  └───────────────┘ │
│  │ ❌ Reject        │    │                     │
│  └──────────────────┘    │  ┌───────────────┐ │
│                          │  │  Tips         │ │
│  ┌──────────────────┐    │  │  • 24u react  │ │
│  │ Case Card        │    │  └───────────────┘ │
│  └──────────────────┘    │                     │
│                          │  ┌───────────────┐ │
│  ┌──────────────────┐    │  │  Stats        │ │
│  │ Case Card        │    │  │  Deze week    │ │
│  └──────────────────┘    │  └───────────────┘ │
└──────────────────────────┴─────────────────────┘
```

**Layout:** 12-column grid
- **Left (9 cols):** Case queue with filters
- **Right (3 cols):** Info panel (sticky)

---

## Header Section

```
┌────────────────────────────────┐
│ Intake                         │
│ Nieuwe en lopende casussen     │
└────────────────────────────────┘
```

**Elements:**
- **Title:** "Intake" (3xl, bold)
- **Subtitle:** "Nieuwe en lopende casussen" (muted)

**Tone:** Professional, calm, clear purpose

---

## KPI Strip

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 🕒          │ 🕒          │ 📅          │ ❌          │
│ Nieuwe      │ Wacht op    │ Intake      │ Afgewezen   │
│ casussen    │ reactie     │ gepland     │             │
│             │             │             │             │
│      2      │      1      │      1      │      0      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**4 Metrics:**

1. **Nieuwe casussen** (blue)
   - Icon: Clock
   - Count of cases with status "nieuw"
   - Indicates: Action required

2. **Wacht op reactie** (amber)
   - Icon: Clock
   - Count of cases pending provider response
   - Indicates: Urgent attention needed

3. **Intake gepland** (green)
   - Icon: Calendar
   - Count of cases with scheduled intake
   - Indicates: On track

4. **Afgewezen** (gray)
   - Icon: XCircle
   - Count of rejected cases
   - Indicates: Historical data

**Design:**
- Grid: 4 columns, equal width
- Card style: Premium card with colored accents
- Hover effect: Slight scale up (1.02)
- Large number (3xl, bold)
- Icon + label layout

---

## Search & Filters

### Search Bar

```
┌────────────────────────────────────────────┐
│ 🔍 Zoek op naam of case ID...              │
└────────────────────────────────────────────┘
```

**Features:**
- Full-width search input
- Search icon (left side)
- Placeholder: "Zoek op naam of case ID..."
- Real-time filtering
- Clear visual focus state

**Filters:**
- Client name (partial match)
- Case ID (exact or partial)

---

### Filter Panel

```
┌────────────────────────────────────────────┐
│  Filters (2) ▼                             │
│                                            │
│  Status          Urgentie       [Reset]   │
│  ▼ Alle          ▼ Alle                    │
└────────────────────────────────────────────┘
```

**Filter Toggle Button:**
- Icon: Filter
- Badge: Active filter count (e.g., "(2)")
- Toggles filter panel visibility
- Primary style when active

**Filter Options:**

1. **Status Filter**
   - All statuses (default)
   - Nieuw
   - Wacht op reactie
   - Geaccepteerd
   - Intake gepland
   - Afgewezen

2. **Urgency Filter**
   - All urgency levels (default)
   - Hoge urgentie
   - Gemiddelde urgentie
   - Lage urgentie

3. **Reset Button**
   - Clears all filters + search
   - Disabled when no filters active

**Behavior:**
- Filters combine (AND logic)
- Real-time results update
- Filter count badge on toggle button
- Collapsible panel to reduce clutter

---

## Case Queue (Main Area)

### Results Header

```
5 casussen gevonden                    [Reset filters]
```

**Elements:**
- Count of filtered results
- "Reset filters" link (if filters active)

---

### Case Card Component

```
┌────────────────────────────────────────────────────┐
│ Emma de Jong                          [NIEUW]      │
│ Case ID: C-001 · Geplaatst door Gemeente Amsterdam │
│                                                    │
│ ┌──────┬──────┬──────────────┬──────────┐         │
│ │ 👤   │ 📍   │ Zorgtype     │ 🕒       │         │
│ │14 jr │ Amst │ Intensief    │ 2 uur    │         │
│ └──────┴──────┴──────────────┴──────────┘         │
│                                                    │
│ Probleemschets                                     │
│ Complexe gedragsproblematiek met agressie...       │
│                                                    │
│ [✅ Accepteren] [❌ Afwijzen] [👁️ Bekijk details]  │
│                                                    │
│ ⚠️ Let op: Hoge urgentie. Reactie binnen 24u.    │
└────────────────────────────────────────────────────┘
```

**Card Structure:**

1. **Header**
   - Client name (bold, large)
   - "NIEUW" badge (if status = new)
   - Case ID + municipality
   - Status badge (right side)
   - Urgency badge (right side, color-coded)

2. **Core Info Grid** (4 columns)
   - Leeftijd (age)
   - Regio (region)
   - Zorgtype (care type)
   - Wachttijd (waiting time)

3. **Problem Summary**
   - Label: "Probleemschets"
   - 2-3 line summary of the problem
   - Readable, relaxed line height

4. **Actions** (Critical!)
   - **Accepteren** (green button, full icon)
   - **Afwijzen** (outline button, red accent)
   - **Bekijk details** (outline button)
   - Full width buttons on new/pending cases
   - Reduced buttons on accepted/completed cases

5. **Urgency Warning** (conditional)
   - Only shown for high urgency + actionable cases
   - Red background
   - Warning icon
   - Text: "Let op: Hoge urgentie. Reactie binnen 24u vereist."

**Visual States:**

- **New cases:**
  - Blue border (2px)
  - Blue background (5% opacity)
  - "NIEUW" badge
  - Full action buttons

- **High urgency:**
  - Red left border (4px)
  - Warning message at bottom

- **Accepted/In progress:**
  - No special border
  - Status badge shows state
  - Only "Bekijk details" button

---

### Case Card Priority Sorting

**Sorting Logic:**

1. **Priority 1:** Status = "nieuw" (newest first)
2. **Priority 2:** Urgency level (high → medium → low)
3. **Priority 3:** Placement date (newest first)

**Result:** Urgent new cases always at the top of the queue.

---

### Empty State

```
┌────────────────────────────────────┐
│          🎯                        │
│                                    │
│  Geen casussen gevonden            │
│                                    │
│  Probeer je filters aan te passen. │
│                                    │
│  [Reset alle filters]              │
└────────────────────────────────────┘
```

**Two Scenarios:**

1. **No results (with filters):**
   - Message: "Probeer je filters aan te passen."
   - Reset button visible

2. **No results (no filters):**
   - Message: "Geen nieuwe casussen. Goed bezig! 🎯"
   - Positive reinforcement

**Design:**
- Centered layout
- Large target icon
- Clear message
- Optional action button

---

## Right Panel (Info Sidebar)

### Capacity Overview

```
┌─────────────────────────┐
│ 🎯 Jouw capaciteit      │
│                         │
│ Bezet          7 / 10   │
│ [████████░░] 70%        │
│                         │
│ Lopende intakes    3    │
│ Beschikbare plekken 3   │
└─────────────────────────┘
```

**Metrics:**
- Total capacity (current / max)
- Visual progress bar
- Gradient: green → amber (based on %)
- Breakdown:
  - Lopende intakes
  - Beschikbare plekken (green text)

**Purpose:** Help provider make accept/reject decisions based on available capacity.

---

### Tips Panel

```
┌─────────────────────────┐
│ 💡 Tips                 │
│                         │
│ • Reageer binnen 24 uur │
│ • Urgente cases sneller │
│ • Download documenten   │
└─────────────────────────┘
```

**Design:**
- Blue background (5% opacity)
- Blue border
- Lightbulb icon
- 3 bullet points
- Small text (12px)

**Content:**
- Best practices
- SLA reminders
- Process guidance

---

### Weekly Stats

```
┌─────────────────────────┐
│ Deze week               │
│                         │
│ Geaccepteerd        4   │
│ Afgewezen           1   │
│ Gem. reactietijd  3.2u  │
└─────────────────────────┘
```

**Metrics:**
- Accepted count
- Rejected count
- Average response time

**Purpose:** Performance tracking and awareness

---

### Performance Indicator

```
┌─────────────────────────┐
│ ✅ Sterke prestaties    │
│                         │
│ Je reactietijd ligt     │
│ onder het gemiddelde.   │
│ Blijf zo werken!        │
└─────────────────────────┘
```

**Design:**
- Green background (5% opacity)
- Green border
- Checkmark icon
- Positive reinforcement message

**Conditional Display:**
- Shows when provider performs above average
- Hidden if performance is below target

---

## User Workflows

### Workflow 1: Fast Accept (Urgent Case)

```
1. Provider opens dashboard
2. Sees "2" in "Nieuwe casussen" KPI
3. Top card has red left border + [NIEUW] badge
4. Scans header: "Emma de Jong (14 jaar)"
5. Reads urgency: "Hoge urgentie"
6. Scans core info: Amsterdam, Intensief, 2 uur
7. Reads problem summary (10 sec)
8. Sees warning: "Reactie binnen 24u vereist"
9. Clicks "Accepteren" (green button)
10. Card updates to status "Geaccepteerd"
11. KPI updates: "Nieuwe: 1" (decremented)
```

**Time:** 15-30 seconds

**Decision point:** Accept based on urgency + capacity

---

### Workflow 2: Detailed Review Before Decision

```
1. Provider sees new case
2. Clicks "Bekijk details"
3. Opens full IntakePage (new tab/view)
4. Reads complete briefing
5. Downloads assessment report
6. Reviews documents
7. Checks contact info
8. Returns to dashboard
9. Clicks "Accepteren"
```

**Time:** 3-5 minutes

**Decision point:** Accept after thorough review

---

### Workflow 3: Reject with Reason

```
1. Provider reviews case
2. Determines mismatch (e.g., no capacity, wrong specialization)
3. Clicks "Afwijzen"
4. Modal appears: "Reden voor afwijzing"
5. Selects reason from dropdown:
   - Geen capaciteit
   - Specialisatie mismatch
   - Regio niet ondersteund
   - Anders (vrij veld)
6. Optional: Adds note
7. Clicks "Bevestig afwijzing"
8. Case status updates to "Afgewezen"
9. Municipality receives notification
```

**Time:** 1-2 minutes

**Decision point:** Reject with clear reasoning

---

### Workflow 4: Filter by Urgency

```
1. Provider wants to focus on urgent cases
2. Clicks "Filters" button
3. Filter panel expands
4. Selects "Urgentie: Hoge urgentie"
5. Results filter to show only high urgency cases
6. Processes them in order
7. Clicks "Reset filters" when done
```

**Time:** 5 seconds to filter

**Purpose:** Prioritize urgent work

---

## Status Badge Component

### Visual Design

```
┌─────────────────┐
│ • Nieuw         │  Blue, animated dot
├─────────────────┤
│ In beoordeling  │  Amber
├─────────────────┤
│ Geaccepteerd    │  Green
├─────────────────┤
│ Intake gepland  │  Purple
├─────────────────┤
│ Afgewezen       │  Gray
└─────────────────┘
```

**Status Types:**

1. **Nieuw** (blue)
   - Animated pulsing dot
   - New case, requires action
   - Priority: High

2. **Wacht op reactie** (amber)
   - Pending provider decision
   - Priority: High

3. **In beoordeling** (amber)
   - Provider reviewing
   - Priority: Medium

4. **Geaccepteerd** (green)
   - Provider accepted
   - Next: Plan intake
   - Priority: Medium

5. **Intake gepland** (purple)
   - Intake scheduled
   - Date/time shown
   - Priority: Low (on track)

6. **Afgewezen** (gray)
   - Provider rejected
   - Historical record
   - Priority: None

**Badge Sizes:**
- **Small (sm):** px-2 py-1, text-xs
- **Medium (md):** px-3 py-1.5, text-sm

---

## Color System

| Color | Meaning | Usage |
|-------|---------|-------|
| **Blue (#3B82F6)** | New / Information | New cases, new badge, status badges |
| **Amber (#F59E0B)** | Pending / Warning | Medium urgency, waiting statuses |
| **Green (#22C55E)** | Accepted / Positive | Accept button, completed states, capacity available |
| **Red (#EF4444)** | Urgent / Critical | High urgency, reject button, warnings |
| **Purple (#8B5CF6)** | Scheduled / Action | Intake planned, primary actions |
| **Gray (#6B7280)** | Inactive / Historical | Rejected cases, disabled states |

---

## Interactions & Feedback

### Hover States

**Case Card:**
- Slight shadow increase
- Subtle scale animation (if not already prominent)
- Smooth transition

**Buttons:**
- Background color change
- Border color intensifies
- Cursor: pointer

**KPI Cards:**
- Scale up to 1.02
- Shadow increase

---

### Click Feedback

**Accept Button:**
```
1. Click
2. Loading state (spinner icon)
3. API call
4. Success toast: "Casus geaccepteerd"
5. Card updates to "Geaccepteerd" status
6. KPI count decrements
7. Confetti animation (optional)
```

**Reject Button:**
```
1. Click
2. Modal opens: "Reden voor afwijzing"
3. Select reason
4. Confirm
5. Loading state
6. Success toast: "Casus afgewezen"
7. Card updates to "Afgewezen" status
8. Card fades out (optional)
```

**View Details:**
```
1. Click
2. Navigate to IntakePage
3. Or: Open in modal overlay
```

---

## Responsive Behavior

### Desktop (1400px+)
- 12-column grid (9 + 3)
- All panels visible
- Optimal layout

### Laptop (1024-1399px)
- Same layout, tighter spacing
- Right panel sticky

### Tablet (768-1023px)
- 2-column: Cases full width
- Right panel becomes accordion at bottom

### Mobile (<768px)
- 1-column stack
- KPIs in 2x2 grid
- Case cards full width
- Filters collapse by default

---

## Performance Optimization

### Data Loading

```typescript
// Initial load
GET /api/provider/cases?status=all&limit=50

// Filters
GET /api/provider/cases?status=nieuw&urgency=high

// Real-time updates (WebSocket)
ws://api/provider/cases/subscribe
  → New case notification
  → Status update
  → KPI refresh
```

### Client-side Filtering

- Search: Client-side (instant)
- Status filter: Client-side
- Urgency filter: Client-side
- No server round-trip for basic filters

### Caching

- Cases cached for 5 minutes
- Manual refresh button available
- Auto-refresh on focus return

---

## Accessibility

### Keyboard Navigation

```
Tab         → Navigate cards
Enter       → Accept case (when focused)
Shift+Tab   → Navigate backwards
Arrows      → Scroll list
/           → Focus search
Esc         → Close modal
```

### Screen Reader

```html
<main aria-label="Provider intake dashboard">
  <section aria-label="Key performance indicators">
    <div role="status">2 nieuwe casussen</div>
  </section>
  
  <section aria-label="Case queue">
    <article aria-label="Case C-001: Emma de Jong, high urgency">
      <button aria-label="Accept case Emma de Jong">
        Accepteren
      </button>
    </article>
  </section>
</main>
```

### Focus Management

- Clear purple focus rings
- Logical tab order
- Focus trap in modals
- Skip to main content link

---

## Integration Points

### From Municipality (Placement)

```
Municipality places case →
Provider receives notification →
Case appears in "Nieuwe casussen" →
Provider dashboard updates
```

### To Intake Planning

```
Provider accepts case →
Status: "Geaccepteerd" →
Provider clicks "Plan intake" →
Navigate to planning modal →
Select date/time →
Status: "Intake gepland"
```

### To Case Rejection

```
Provider rejects case →
Modal: Select reason →
Confirm rejection →
Municipality receives notification →
Case removed from queue →
Municipality can re-match
```

---

## Business Rules

### SLA Requirements

1. **Response time:**
   - High urgency: 24 hours
   - Medium urgency: 48 hours
   - Low urgency: 72 hours

2. **Capacity management:**
   - Provider can't accept beyond capacity
   - System warns at 80% capacity

3. **Rejection reasons:**
   - Required for audit trail
   - Municipality receives notification

### Notifications

**Provider receives:**
- New case assignment
- Urgency escalation
- Intake deadline reminder

**Municipality receives:**
- Case accepted
- Case rejected (with reason)
- Intake scheduled confirmation

---

## Success Metrics

### Provider Performance

- **Average response time:** Target <4 hours
- **Acceptance rate:** Target >80%
- **Intake planning rate:** Target >90% within 3 days

### System Performance

- **Page load time:** <500ms
- **Search latency:** <100ms (client-side)
- **Action confirmation:** <200ms

### User Satisfaction

- **Clarity:** Provider understands case in <30 seconds
- **Efficiency:** Accept decision in <1 minute
- **Confidence:** <5% rejection-reversal requests

---

## Summary

The **Provider Intake Dashboard** transforms case intake from a manual, email-based process into a **streamlined, inbox-style work queue**. The system:

1. **Prioritizes urgency** with visual cues and smart sorting
2. **Enables fast decisions** with one-click accept/reject
3. **Provides complete context** with embedded case summaries
4. **Reduces friction** with minimal navigation
5. **Builds confidence** with capacity tracking and performance feedback

**Key Innovation:** Inbox-first design + Decision-oriented layout + Low-friction actions = Professional intake experience.

---

**Component Version:** 1.0.0  
**Design Date:** April 17, 2026  
**Status:** Production Ready  
**Documentation:** Complete
