# Regiekamer - Healthcare Coordination System

## Overview

The application has been transformed from an e-commerce/inventory management system into a **healthcare coordination "Regiekamer"** (control room) used by:

- **Municipalities** (Gemeenten)
- **Care coordinators** (Zorgcoördinatoren)
- **Youth care organizations** (Jeugdzorg instellingen)

This is NOT a reporting tool. This is a **DECISION SYSTEM**.

---

## Core Purpose

The Regiekamer helps users:

1. **See which cases need attention** - Immediate visibility of urgent cases
2. **Understand urgency and risks** - Visual indicators for priority and risk levels
3. **Take immediate action** - Direct access to decision-making interfaces
4. **Be guided through care allocation** - Structured workflow from assessment to placement

---

## Design Principles

### 1. Decision-First Design
Every screen answers: **"What should the user do next?"**

### 2. Case-Centric
Everything revolves around cases, not metrics.

### 3. Urgency Awareness
The UI visually communicates:
- Urgency levels (critical, high, medium, low)
- Delays and waiting times
- Risk indicators

### 4. Low Cognitive Load
Users must understand the situation within **3 seconds**.

### 5. Structured Hierarchy
Clear separation between:
- Action areas (what to do)
- Information areas (case details)
- Signals (system alerts)

---

## Color System

The system uses color to communicate **meaning**, not decoration:

| Color | Meaning | Use Case |
|-------|---------|----------|
| **Red** (#EF4444) | Urgent / Blocked / Risk | Critical cases, blocked status, high risks |
| **Amber** (#F59E0B) | Warning / Delay | Delays, moderate urgency, warnings |
| **Green** (#10B981) | Healthy / Completed | Successful placements, low risk |
| **Purple** (#8B5CF6) | Actions / Primary | Primary actions, brand color, active states |
| **Blue** (#3B82F6) | Information / Assessment | Assessment phase, informational states |
| **Cyan** (#22D3EE) | Placement | Placement phase indicator |

---

## System Architecture

### Navigation Structure

```
Regiekamer (Dashboard)
├── Case Detail Page
│   ├── Case Information
│   ├── Phase Indicator (Intake → Assessment → Matching → Placement)
│   ├── Work Area (changes per phase)
│   └── System Intelligence Panel
│       ├── Risks
│       ├── AI Suggestions
│       └── Similar Cases
└── Matching View
    ├── Top 3 Provider Matches
    ├── Match Scores & Explanations
    └── Decision Interface
```

### Data Model

```typescript
Case {
  id: string                    // e.g., "C-2026-0847"
  clientName: string            // Anonymized (e.g., "Cliënt A.M.")
  clientAge: number
  region: string                // Municipality
  status: CaseStatus            // intake | assessment | matching | placement | active | completed | blocked
  urgency: UrgencyLevel         // critical | high | medium | low
  risk: RiskLevel               // high | medium | low | none
  waitingDays: number
  lastActivity: string
  assignedTo: string
  caseType: string              // Type of youth care
  signal: string                // Main alert/issue
  recommendedAction: string
}
```

---

## Key Pages

### 1. Regiekamer Dashboard

**Purpose**: Control room showing all cases needing attention

**Layout**:
- **Header**: Title, subtitle, search bar, filters
- **KPI Strip**: 6 operational KPIs
  - Casussen zonder match
  - Open beoordelingen
  - Plaatsingen in behandeling
  - Gemiddelde wachttijd
  - Casussen met hoog risico
  - Capaciteitstekorten
- **Main Area**:
  - **Left (70%)**: Case table/cards sorted by urgency
  - **Right (30%)**: 
    - System signals (alerts)
    - Priority actions
    - Capacity overview

**File**: `/components/care/RegiekamerPage.tsx`

---

### 2. Case Detail Page

**Purpose**: Most important screen - where decisions are made

**Layout**:
- **Decision Header**:
  - Case ID, status, urgency, risk badges
  - Recommendation banner (e.g., "Beoordeling ontbreekt – 3 dagen stilstand")
  - Recommended action button
  
- **Phase Indicator**: Visual stepper showing progress
  1. Casus (Intake)
  2. Beoordeling (Assessment)
  3. Matching
  4. Plaatsing (Placement)

- **3-Column Layout**:
  - **Left**: Case information, client details, timeline
  - **Center**: Active work area (changes per phase)
  - **Right**: System intelligence
    - Risk alerts
    - AI suggestions with confidence scores
    - Similar cases

- **Sticky Action Bar**: Context-specific actions at bottom

**File**: `/components/care/CaseDetailPage.tsx`

---

### 3. Matching Page

**Purpose**: Decision interface for provider selection

**Layout**:
- **Header**: Case summary with requirements
- **Provider Cards**: Top 3 matches with:
  - Match score (0-100)
  - Match type badge:
    - 🟢 **Beste match** (Best match)
    - 🟣 **Alternatief** (Alternative)
    - 🟡 **Met risico** (Risky option)
  - Key metrics (capacity, rating, response time)
  - Specializations
  - Match explanation (why this provider?)
  - Trade-offs (pros/cons)
  - Action buttons:
    - "Plaats direct" (green) - for best match
    - "Plaats" (purple) - for alternative
    - "Plaats met risico" (amber) - for risky option

- **Decision Guidance Panel**: System recommendations and warnings

**File**: `/components/care/MatchingPage.tsx`

---

## Component Library

### KPI Cards

**Purpose**: Display operational metrics with urgency awareness

```tsx
<CareKPICard
  title="Casussen zonder match"
  value={5}
  icon={Users}
  urgency="critical" // critical | warning | normal | positive
/>
```

**Visual Features**:
- Color-coded borders and glows based on urgency
- Icon with background
- Optional trend indicator
- Hover scale effect

**File**: `/components/care/CareKPICard.tsx`

---

### Status Badges

#### Case Status Badge
Shows current phase of the case:
- 🟣 Intake
- 🔵 Beoordeling (Assessment)
- 🟡 Matching
- 🔵 Plaatsing (Placement)
- 🟢 Actief (Active)
- 🟢 Afgerond (Completed)
- 🔴 Geblokkeerd (Blocked)

**File**: `/components/care/CaseStatusBadge.tsx`

#### Urgency Badge
Indicates case priority:
- 🔴 Kritiek (Critical)
- 🟠 Hoog (High)
- 🟡 Gemiddeld (Medium)
- 🟢 Laag (Low)

**File**: `/components/care/UrgencyBadge.tsx`

#### Risk Badge
Shows risk level:
- 🔴 Hoog risico (High risk)
- 🟡 Gemiddeld risico (Medium risk)
- 🟢 Laag risico (Low risk)

**File**: `/components/care/RiskBadge.tsx`

---

### Case Table Row

**Purpose**: Compact case display in the Regiekamer

**Displays**:
- Case ID, client name, age, region
- Type of care
- Status and urgency badges
- Waiting time with color coding
- Risk badge
- Signal/alert
- Action button

**Interaction**: Click to open Case Detail Page

**File**: `/components/care/CaseTableRow.tsx`

---

### Signal Card

**Purpose**: Display system-level alerts

**Types**:
- 🔴 Critical: Capacity shortages, high-risk cases
- 🟡 Warning: Delays, limited capacity
- 🔵 Info: General notifications

**File**: `/components/care/SignalCard.tsx`

---

### Priority Action Card

**Purpose**: Show next actions with deadlines

**Displays**:
- Case ID and client
- Action description
- Deadline (Vandaag, Morgen, Deze week)
- Priority level (urgent, high, medium)
- "Actie ondernemen" button

**File**: `/components/care/PriorityActionCard.tsx`

---

## Mock Data

All case data, providers, assessments, and signals are defined in:

**File**: `/lib/casesData.ts`

**Includes**:
- `mockCases[]` - 8 sample cases with various statuses
- `mockProviders[]` - 5 healthcare providers
- `mockAssessments[]` - Assessment records
- `mockSignals[]` - System alerts
- `mockPriorityActions[]` - Prioritized tasks

---

## Navigation Flow

```
1. User opens app → Sees Regiekamer Dashboard
   ↓
2. User clicks on a case → Opens Case Detail Page
   ↓
3. User sees recommendation banner
   ↓
4. User clicks "Start matching" → Opens Matching Page
   ↓
5. User reviews provider matches
   ↓
6. User selects provider and confirms → Returns to Regiekamer
```

**State Management**:
- `currentView`: "regiekamer" | "case-detail" | "matching"
- `selectedCaseId`: Current case being viewed
- Navigation handlers in `App.tsx`

---

## Design Philosophy

### Operational Feel
The interface feels like:
- ✅ A control tower
- ✅ A system that thinks
- ✅ A place where decisions are made

NOT like:
- ❌ A generic admin panel
- ❌ A finance dashboard
- ❌ A passive reporting tool

### Tone & Feeling
- **Operational**: Action-oriented, not passive
- **Intelligent**: Shows AI recommendations and reasoning
- **Calm but urgent**: Clear priorities without panic
- **Trustworthy**: Government-level reliability
- **Modern & Premium**: High-quality design language

---

## Technical Implementation

### Framework
- **React** with TypeScript
- **Tailwind CSS v4** for styling
- **Lucide Icons** for iconography
- **Dark theme** by default

### State Management
- React hooks (`useState`, `useEffect`)
- Props drilling for navigation
- LocalStorage for theme/language persistence

### Responsive Design
- Desktop-first but mobile-aware
- Sidebar: Collapsible (240px → 72px)
- Grid layouts with breakpoints
- Scrollable areas where needed

---

## Color Usage Guidelines

### Critical States (Red)
```css
bg-red-500/10        /* Background */
border-red-500/30    /* Border */
text-red-500         /* Text */
shadow-[0_0_20px_rgba(239,68,68,0.15)] /* Glow */
```

### Warning States (Amber)
```css
bg-amber-500/10
border-amber-500/30
text-amber-500
shadow-[0_0_20px_rgba(245,158,11,0.15)]
```

### Positive States (Green)
```css
bg-green-500/10
border-green-500/30
text-green-500
shadow-[0_0_20px_rgba(16,185,129,0.15)]
```

### Primary Actions (Purple)
```css
bg-primary/10        /* Light background */
border-primary/30    /* Border */
text-primary         /* Text */
bg-primary           /* Solid button */
hover:bg-primary/90  /* Hover state */
```

---

## Future Enhancements

### Planned Features
1. **Real-time updates**: WebSocket integration for live case updates
2. **Advanced filtering**: Multi-criteria search and filters
3. **Bulk actions**: Select and act on multiple cases
4. **Analytics dashboard**: Trends, bottlenecks, performance metrics
5. **Document management**: Attach and view case documents
6. **Communication hub**: Integrated messaging with providers
7. **Calendar integration**: Schedule assessments and meetings
8. **Export capabilities**: Generate reports and exports
9. **Mobile app**: Native iOS/Android companion
10. **API integration**: Connect to real healthcare systems

### Potential Improvements
- Machine learning for better provider matching
- Predictive analytics for capacity planning
- Automated escalation workflows
- Integration with national registries
- Multi-tenant support for different municipalities

---

## Accessibility

- **Keyboard navigation**: All interactive elements accessible
- **Color contrast**: WCAG AA compliant
- **Screen reader support**: Semantic HTML and ARIA labels
- **Focus indicators**: Clear visual feedback
- **Icon + text**: Never rely on color alone

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## File Structure

```
/components/care/
├── RegiekamerPage.tsx         # Main dashboard
├── CaseDetailPage.tsx          # Case detail view
├── MatchingPage.tsx            # Provider matching
├── CareKPICard.tsx            # KPI display component
├── CaseTableRow.tsx           # Case list item
├── CaseStatusBadge.tsx        # Status indicator
├── UrgencyBadge.tsx           # Urgency indicator
├── RiskBadge.tsx              # Risk indicator
├── SignalCard.tsx             # System alert card
├── PriorityActionCard.tsx     # Action item card
└── PlaceholderPage.tsx        # Placeholder views

/lib/
└── casesData.ts               # Mock data and types

/App.tsx                        # Main app with routing
/components/ModernSidebar.tsx   # Navigation sidebar
/components/ModernTopbar.tsx    # Top navigation bar
```

---

## Credits

**Design System**: Healthcare-first, decision-oriented interface
**Color Palette**: Black (#0E0E18) + Purple (#8B5CF6) + Semantic colors
**Typography**: System fonts with clear hierarchy
**Iconography**: Lucide React icons

---

## Support

For questions or improvements, refer to:
- `/DESIGN_SYSTEM.md` - Visual design guidelines
- `/SYSTEM_ARCHITECTURE.md` - Technical architecture
- `/REGIEKAMER_README.md` - Original requirements

---

**Last Updated**: April 16, 2026
**Version**: 1.0.0
**Status**: Production Ready
