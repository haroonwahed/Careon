# 🏗️ REGIEKAMER PLATFORM - CORRECTED ARCHITECTURE

## 🎯 THE GOLDEN RULE

**ONE PLACE TO EXECUTE, MANY PLACES TO DISCOVER**

---

## 📊 PAGE HIERARCHY

```
┌─────────────────────────────────────────────────────────────┐
│                    DISCOVERY LAYER                          │
│  "Where should I focus?"                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟣 REGIEKAMER          →  Prioritize urgent cases         │
│     • AI command strip                                      │
│     • KPI filters                                           │
│     • Next action per case                                  │
│     ↓ Click case → CASUS CONTROL CENTER                    │
│                                                             │
│  🔵 CASUSSEN            →  Find any case                   │
│     • Strong search                                         │
│     • Quick filters                                         │
│     • List/Board views                                      │
│     • Bulk actions                                          │
│     ↓ Click case → CASUS CONTROL CENTER                    │
│                                                             │
│  🟡 BEOORDELINGEN       →  Assessment queue                │
│     • List of pending assessments                           │
│     • "Start" button only                                   │
│     • NO FORM EXECUTION                                     │
│     ↓ Click "Start" → CASUS CONTROL CENTER                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  INTELLIGENCE LAYER                          │
│  "What's wrong? What should I do?"                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔴 SIGNALEN            →  What is wrong                   │
│     • Critical/warning/info signals                         │
│     • Capacity issues                                       │
│     • Delays and quality problems                           │
│     • NO TASK EXECUTION                                     │
│     ↓ Click signal → Related cases → CASUS CONTROL CENTER  │
│                                                             │
│  🟢 ACTIES              →  What to do                      │
│     • Overdue/Today/Upcoming                                │
│     • Clear actions per case                                │
│     • Priority indicators                                   │
│     ↓ Click action → CASUS CONTROL CENTER                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EXPLORATION LAYER                          │
│  "What's the landscape?"                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔵 ZORGAANBIEDERS      →  Provider landscape              │
│     • Map view (primary)                                    │
│     • Capacity indicators                                   │
│     • Specializations                                       │
│     • NO DECISION UI                                        │
│                                                             │
│  🟣 GEMEENTEN           →  Governance view                 │
│     • Table of municipalities                               │
│     • Performance metrics                                   │
│     • Capacity tracking                                     │
│                                                             │
│  🟢 REGIO'S             →  System distribution             │
│     • Geographical overview                                 │
│     • Regional capacity                                     │
│     • Problem hotspots                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   DECISION LAYER                             │
│  "Confirm my choice"                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟠 MATCHING            →  Confirm provider match          │
│     • Top recommendation                                    │
│     • Top 3 providers                                       │
│     • Match explanation                                     │
│     • "Plaats direct" CTA                                   │
│                                                             │
│  🔵 PLAATSING           →  Validate placement              │
│     • List of pending placements                            │
│     • Validation checklist                                  │
│     • Confirm/Reject                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ⭐ EXECUTION LAYER ⭐                           │
│  "Do ALL the work"                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟢 CASUS CONTROL CENTER  →  Single execution point        │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │ TOP:                                               │    │
│  │  • Status badges                                   │    │
│  │  • Phase stepper: [Intake → Beoordeling →         │    │
│  │                    Matching → Plaatsing]           │    │
│  │  • AI recommendation banner                        │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────┬────────────────────┬──────────────┐      │
│  │ LEFT:       │ CENTER:            │ RIGHT:       │      │
│  │             │                    │              │      │
│  │ • Client    │ DYNAMIC CONTENT:   │ • Risks      │      │
│  │   info      │                    │ • Timeline   │      │
│  │ • Case      │ Based on phase:    │ • AI         │      │
│  │   details   │                    │   suggestions│      │
│  │ • Timeline  │ ┌────────────────┐ │ • Similar    │      │
│  │             │ │ INTAKE         │ │   cases      │      │
│  │             │ │ • Form         │ │              │      │
│  │             │ └────────────────┘ │              │      │
│  │             │ ┌────────────────┐ │              │      │
│  │             │ │ BEOORDELING    │ │              │      │
│  │             │ │ • Assessment   │ │              │      │
│  │             │ │ • Form steps   │ │              │      │
│  │             │ └────────────────┘ │              │      │
│  │             │ ┌────────────────┐ │              │      │
│  │             │ │ MATCHING       │ │              │      │
│  │             │ │ • Top matches  │ │              │      │
│  │             │ │ • Select       │ │              │      │
│  │             │ └────────────────┘ │              │      │
│  │             │ ┌────────────────┐ │              │      │
│  │             │ │ PLAATSING      │ │              │      │
│  │             │ │ • Validate     │ │              │      │
│  │             │ │ • Confirm      │ │              │      │
│  │             │ └────────────────┘ │              │      │
│  └─────────────┴────────────────────┴──────────────┘      │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │ BOTTOM (Sticky):                                   │    │
│  │  • Context-aware actions                           │    │
│  │  • Primary CTA button                              │    │
│  │  • Save/Cancel options                             │    │
│  └───────────────────────────────────────────────────┘    │
│                                                             │
│  ✅ Can complete ENTIRE case without leaving this page     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 USER FLOW EXAMPLES

### Example 1: Urgent Case Needs Attention

```
1. User opens Regiekamer
   ↓
2. AI command strip says: "5 casussen vereisen directe actie"
   ↓
3. User clicks urgent case row
   ↓
4. CASUS CONTROL CENTER opens (modal overlay)
   ↓
5. See status: "Matching"
   See AI banner: "Klaar voor matching - 3 matches gevonden"
   See risk: "Lange wachttijd - 8 dagen"
   ↓
6. Click "Start matching" button
   ↓
7. Center area switches to matching view
   Shows top 3 providers
   ↓
8. User selects provider
   ↓
9. Click "Bevestig match"
   ↓
10. Case moves to placement phase
    All without leaving Casus Control Center ✅
```

### Example 2: Assessment Queue

```
1. User opens Beoordelingen page
   ↓
2. Sees list of pending assessments
   ↓
3. Clicks "Start" on assessment card
   ↓
4. CASUS CONTROL CENTER opens
   Phase: Beoordeling
   ↓
5. Center shows assessment form
   Right shows validation panel
   ↓
6. User fills form across multiple steps
   ↓
7. Click "Beoordeling afronden"
   ↓
8. Case automatically moves to matching phase
   Center switches to matching view ✅
```

### Example 3: Problem Detection

```
1. User opens Signalen page
   ↓
2. Sees critical signal: "Capaciteitstekort in Utrecht"
   ↓
3. Signal shows: "7 casussen affected"
   ↓
4. User clicks signal
   ↓
5. Opens Casussen page filtered to affected cases
   ↓
6. User clicks specific case
   ↓
7. CASUS CONTROL CENTER opens
   Shows why case is stuck
   AI suggests: "Verbreed zoekgebied"
   ↓
8. User can take action immediately ✅
```

### Example 4: Action List

```
1. User opens Acties page
   ↓
2. Sees "Te laat" section with 2 overdue tasks
   ↓
3. First action: "Bel beoordelaar - C-001"
   ↓
4. User clicks action
   ↓
5. CASUS CONTROL CENTER opens for C-001
   Phase: Beoordeling
   Shows work area with "Bel beoordelaar" button
   ↓
6. User clicks button, makes call, updates status
   ↓
7. Action automatically marked complete
   Removed from Acties page ✅
```

---

## ⚖️ BEFORE vs AFTER

### ❌ BEFORE (WRONG)

```
Beoordelingen Page:
├── Queue List
└── Detail View
    ├── Full Assessment Form
    ├── Stepper Navigation
    └── Validation Panel
    
❌ Workflow execution in wrong place
❌ User does work without seeing full case context
❌ Duplication with Casus Control Center
```

### ✅ AFTER (CORRECT)

```
Beoordelingen Page:
└── Queue List ONLY
    └── "Start" button → Opens Casus Control Center

Casus Control Center:
├── Full Case Context
├── Assessment Phase
│   ├── Form
│   ├── Validation
│   └── Risk Signals
└── Single execution point
    
✅ Workflow execution in right place
✅ User sees full context while working
✅ No duplication
```

---

## 🎯 KEY PRINCIPLES ENFORCED

1. **Single Source of Truth**
   - Casus Control Center = ONLY place for workflow execution
   - All other pages = navigation/discovery/intelligence

2. **Decision-First Design**
   - Every page shows "what to do next"
   - Next actions are always visible
   - No dead ends

3. **Context Preservation**
   - Users always know where they are
   - Back buttons return to previous view
   - Modal overlay preserves page context

4. **No Duplication**
   - Beoordeling form = ONLY in Casus Control Center
   - Matching UI = ONLY in Casus Control Center
   - Plaatsing validation = ONLY in Casus Control Center

5. **Progressive Disclosure**
   - Lists → show essentials
   - Detail → show everything
   - Work areas → show what's needed to act

---

## ✅ COMPLIANCE CHECKLIST

- [x] Every page has ONE purpose
- [x] No workflow duplication
- [x] Clear hierarchy everywhere
- [x] User always knows "what do I do next?"
- [x] Regiekamer = prioritize only
- [x] Casussen = find & manage only
- [x] Beoordelingen = queue only
- [x] Casus Control Center = execute everything
- [x] Can complete entire case without leaving control center
- [x] "Stuck case" scenario flows perfectly
- [x] Signalen = what's wrong (no execution)
- [x] Acties = what to do (links to execution)

---

## 🚀 DEPLOYMENT READY

The platform now follows a clear, consistent architecture where:
- **Discovery pages** help users find what needs attention
- **Intelligence pages** help users understand problems
- **Exploration pages** help users understand the landscape
- **Decision pages** help users confirm choices
- **Execution page** (singular) is where all work happens

**No confusion. No duplication. Crystal clear.**
