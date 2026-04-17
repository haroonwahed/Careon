# Regiekamer System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         REGIEKAMER                               │
│                    Healthcare Coordination                       │
│                      Decision System                             │
└─────────────────────────────────────────────────────────────────┘
```

## User Flow Diagram

```
┌──────────────┐
│   User       │
│  Logs In     │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REGIEKAMER DASHBOARD                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  KPI Strip: 6 Metric Cards                               │  │
│  │  • Cases w/o match  • Assessments  • Placements          │  │
│  │  • Wait time        • High risk    • Capacity issues     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────┐  ┌─────────────────────────────┐  │
│  │  Active Cases Table    │  │  System Alerts              │  │
│  │  • Sorted by urgency   │  │  • Capacity warnings        │  │
│  │  • Click to drill down │  │  • Delay notifications      │  │
│  │  • Visual indicators   │  │  • Risk alerts              │  │
│  └───────────┬────────────┘  │                             │  │
│              │                │  Priority Actions           │  │
│              │                │  • Deadline-driven tasks    │  │
│              │                │  • Quick action buttons     │  │
│              │                └─────────────────────────────┘  │
└──────────────┼──────────────────────────────────────────────────┘
               │
               │ [User clicks case]
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CASE DETAIL PAGE                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Decision Header                                          │  │
│  │  • Status badges  • Urgency  • Risk                      │  │
│  │  • RECOMMENDATION BANNER (color-coded)                   │  │
│  │    → Suggested action based on case state                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Phase Stepper                                            │  │
│  │  [1 Casus] → [2 Beoordeling] → [3 Matching] → [4 Plaatsing]│
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐  │
│  │ LEFT     │  │  CENTER      │  │  RIGHT                  │  │
│  │          │  │              │  │                         │  │
│  │ Client   │  │  WORK AREA   │  │  System Intelligence    │  │
│  │ Info     │  │  (dynamic)   │  │                         │  │
│  │          │  │              │  │  • Risks                │  │
│  │ Case     │  │ Assessment   │  │  • AI Suggestions       │  │
│  │ Details  │  │    OR        │  │    (with confidence)    │  │
│  │          │  │ Matching     │  │  • Similar Cases        │  │
│  │ Timeline │  │    OR        │  │                         │  │
│  │          │  │ Blocked      │  │                         │  │
│  │          │  │    OR        │  │                         │  │
│  │          │  │ Placement    │  │                         │  │
│  └──────────┘  └──────┬───────┘  └─────────────────────────┘  │
│                       │                                         │
│  ┌────────────────────┴──────────────────────────────────────┐│
│  │  Sticky Action Bar                                         ││
│  │  • Context-aware primary actions                          ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      │ [User clicks "Start Matching"]
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MATCHING PAGE                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Case Summary                                             │  │
│  │  • Client info  • Care type  • Region  • Urgency         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PROVIDER #1: BEST MATCH (Green border)                  │  │
│  │  ┌────────────────────────────────┐  ┌────────────────┐ │  │
│  │  │ Score: 94/100                  │  │ Why? (reasons) │ │  │
│  │  │ Metrics: Region, Capacity,     │  │ • Perfect match│ │  │
│  │  │          Rating, Response time │  │ • Available    │ │  │
│  │  │ Specializations: [...tags...]  │  │ • Fast response│ │  │
│  │  └────────────────────────────────┘  └────────────────┘ │  │
│  │  [✓ Plaats direct]  [Meer details]                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PROVIDER #2: ALTERNATIVE (Purple border)                │  │
│  │  Score: 78/100 | Trade-offs | [Plaats]                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PROVIDER #3: RISKY (Amber border)                       │  │
│  │  Score: 62/100 | Warnings | [⚠ Plaats met risico]        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Decision Guidance                                        │  │
│  │  • System recommendation                                  │  │
│  │  • Important considerations                               │  │
│  │  • Warnings                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Selected?] → Sticky confirmation bar appears                 │
└─────────────────────┼───────────────────────────────────────────┘
                      │
                      │ [User confirms placement]
                      ▼
                 ┌────────────┐
                 │  Success!  │
                 │ Return to  │
                 │ Dashboard  │
                 └────────────┘
```

## Component Hierarchy

```
App.tsx
├── ModernSidebar (Navigation)
│   ├── Overzicht section
│   │   ├── Regiekamer (badge: 8)
│   │   ├── Meldingen (badge: 3)
│   │   └── Berichten
│   ├── Casussen section
│   │   ├── Alle casussen
│   │   ├── Beoordelingen
│   │   ├── Matching
│   │   └── Plaatsingen
│   └── Analytics section
│       └── Rapportage
│
├── ModernTopbar (Header)
│   ├── Logo: "R" + "Regiekamer"
│   ├── Language toggle
│   ├── Theme toggle
│   └── Account menu
│
└── Main Content (Conditional rendering)
    │
    ├─[1] RegiekamerPage (if !selectedCaseId)
    │     ├── Search & Filters
    │     ├── KPI Strip
    │     │   ├── CareKPICard × 6
    │     │   └── (urgency-aware coloring)
    │     ├── Active Cases
    │     │   └── CaseTableRow × n
    │     └── Right Panel
    │         ├── SignalCard × n
    │         ├── PriorityActionCard × n
    │         └── Capacity overview
    │
    ├─[2] CaseDetailPage (if selectedCaseId && !isMatchingView)
    │     ├── Back button
    │     ├── Decision Header
    │     │   ├── CaseStatusBadge
    │     │   ├── UrgencyBadge
    │     │   ├── RiskBadge
    │     │   └── Recommendation Banner
    │     ├── Phase Stepper
    │     ├── Three-column layout
    │     │   ├── Left: Info
    │     │   ├── Center: Work Area
    │     │   │   ├── AssessmentWorkArea (if status=assessment)
    │     │   │   ├── MatchingWorkArea (if status=matching)
    │     │   │   ├── BlockedWorkArea (if status=blocked)
    │     │   │   └── PlacementWorkArea (if status=placement)
    │     │   └── Right: Intelligence
    │     │       ├── Risk alerts
    │     │       ├── Suggestions (confidence %)
    │     │       └── Similar cases
    │     └── Sticky Action Bar
    │
    └─[3] MatchingPage (if selectedCaseId && isMatchingView)
          ├── Back button
          ├── Case summary
          ├── Provider Match Cards × 3
          │   ├── ProviderMatchCard (Best - green)
          │   ├── ProviderMatchCard (Alternative - purple)
          │   └── ProviderMatchCard (Risky - amber)
          ├── Decision Guidance
          └── Sticky confirmation bar
```

## Data Flow

```
┌────────────────┐
│ casesData.ts   │  Mock Data Layer
│                │
│ • mockCases    │  8 sample cases
│ • mockProviders│  5 providers
│ • mockSignals  │  4 system alerts
│ • mockPriority │  4 priority actions
│ • mockAssessmnt│  2 assessments
└────────┬───────┘
         │
         │ imported by
         ▼
┌─────────────────────────────────────┐
│  Page Components                    │
│                                     │
│  RegiekamerPage                     │
│  ├─ Filters/sorts mockCases         │
│  ├─ Displays mockSignals            │
│  └─ Shows mockPriorityActions       │
│                                     │
│  CaseDetailPage                     │
│  ├─ Finds case by ID                │
│  ├─ Displays case data              │
│  └─ Shows related info              │
│                                     │
│  MatchingPage                       │
│  ├─ Finds case by ID                │
│  ├─ Filters providers               │
│  └─ Calculates match scores         │
└─────────────────────────────────────┘
```

## State Management

```
App.tsx State:
┌──────────────────────────────────────┐
│ Global UI State                      │
│ • theme: "dark" | "light"            │
│ • language: "en" | "fr"              │
│ • sidebarCollapsed: boolean          │
│ • activePage: Page                   │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ Care System State                    │
│ • selectedCaseId: string | null      │
│ • isMatchingView: boolean            │
└──────────────────────────────────────┘

State Transitions:
─────────────────
Dashboard View:
  selectedCaseId = null
  isMatchingView = false

Case Detail View:
  selectedCaseId = "C-2026-0847"
  isMatchingView = false

Matching View:
  selectedCaseId = "C-2026-0847"
  isMatchingView = true

Actions:
────────
handleCaseClick(id)
  → Set selectedCaseId
  → Set isMatchingView = false

handleBackToRegiekamer()
  → Set selectedCaseId = null
  → Set isMatchingView = false

handleStartMatching(id)
  → Set selectedCaseId = id
  → Set isMatchingView = true

handleConfirmMatch(providerId)
  → Log confirmation
  → Reset to dashboard
```

## Color System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Color Map                        │
└─────────────────────────────────────────────────────────────┘

Context         → Color      → Usage
──────────────────────────────────────────────────────────────
Critical/Urgent → Red 500    → Blocked cases, high risk
Warning/Delay   → Amber 500  → Overdue assessments, warnings
Success/Healthy → Green 500  → Completed, available, good state
Primary/Action  → Purple     → Buttons, links, brand
Info/Neutral    → Blue 500   → Information, standard state
Muted/Secondary → Gray       → Supporting text, borders

State Colors Applied To:
─────────────────────────
• Badges (status, urgency, risk)
• Recommendation banners
• KPI card backgrounds
• Provider match borders
• Action buttons
• Alert boxes
• Timeline dots
• Capacity bars
```

## Responsive Breakpoints

```
Mobile          Tablet         Desktop        Large Desktop
(< 640px)      (768px)        (1024px)       (1280px+)
────────────────────────────────────────────────────────────
Stack          2 columns      3 columns      6 columns (KPIs)
Single column  Side panels    Full layout    Wide layout
Hide details   Show some      Show all       Show all + extras
```

## File Organization

```
/
├── components/
│   ├── care/                     [NEW] Healthcare components
│   │   ├── RegiekamerPage.tsx    Dashboard
│   │   ├── CaseDetailPage.tsx    Case detail
│   │   ├── MatchingPage.tsx      Provider matching
│   │   ├── CaseStatusBadge.tsx   Status indicator
│   │   ├── UrgencyBadge.tsx      Urgency indicator
│   │   ├── RiskBadge.tsx         Risk indicator
│   │   ├── CareKPICard.tsx       KPI card
│   │   ├── CaseTableRow.tsx      List item
│   │   ├── SignalCard.tsx        Alert card
│   │   ├── PriorityActionCard.tsx Action card
│   │   └── PlaceholderPage.tsx   Placeholder
│   │
│   ├── ui/                       [EXISTING] Base components
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   └── ... (all UI primitives)
│   │
│   ├── ModernSidebar.tsx         [MODIFIED] Navigation
│   ├── ModernTopbar.tsx          [MODIFIED] Header
│   └── ... (other existing components)
│
├── lib/
│   ├── casesData.ts              [NEW] Care data & types
│   ├── i18n.ts                   [EXISTING] Translations
│   └── ... (other data files)
│
├── styles/
│   └── globals.css               [EXISTING] Theme + tokens
│
├── App.tsx                       [MODIFIED] Main app + routing
│
└── Documentation/
    ├── REGIEKAMER_README.md      System overview
    ├── DESIGN_SYSTEM.md          Design guidelines
    ├── TRANSFORMATION_SUMMARY.md  What was built
    └── SYSTEM_ARCHITECTURE.md    This file
```

## Integration Points

```
┌─────────────────────────────────────────────────────────────┐
│                    Future Integrations                       │
└─────────────────────────────────────────────────────────────┘

External System          → Integration Point
─────────────────────────────────────────────────────────────
Municipal Database       → Case data sync
Provider Management Sys  → Provider info, availability
Assessment Tools         → Assessment status, results
Communication Platform   → Messages, notifications
Reporting/BI Tools       → Analytics export
Authentication Service   → User login, permissions
Document Management      → Case files, attachments
Calendar System          → Appointments, deadlines
```

## Performance Considerations

```
┌─────────────────────────────────────────────────────────────┐
│                    Performance Strategy                      │
└─────────────────────────────────────────────────────────────┘

Current (Mock Data):
• Instant rendering (no API calls)
• In-memory filtering/sorting
• No pagination needed (< 100 cases)
• Optimistic UI updates

Future (Real Data):
• Implement virtual scrolling for case lists (1000+ cases)
• Add pagination for provider searches
• Cache frequently accessed cases
• Implement optimistic updates for user actions
• Add loading states for async operations
• Consider server-side filtering for large datasets
```

This architecture provides a solid foundation for a production-ready healthcare coordination system while maintaining the flexibility to integrate with real backend services.
