# Regiekamer - Healthcare Coordination Control Room

Historical implementation reference.
This document describes an earlier iteration of the Regiekamer experience and is kept for context only.

## Overview

This system has been transformed from an e-commerce platform into a **Regiekamer** (Control Room) - a healthcare coordination decision system used by:

- **Municipalities** (Gemeentes)
- **Care Coordinators** (Zorgcoördinatoren)
- **Youth Care Organizations** (Jeugdzorg organisaties)

## System Purpose

This is **NOT** a reporting tool. This is a **DECISION SYSTEM**.

The Regiekamer helps users:
- See which cases need attention
- Understand urgency and risks
- Take immediate action
- Be guided through the care allocation process

## Design Philosophy

### Core Principles

1. **Decision-First Design**
   - Every screen answers: "What should the user do next?"

2. **Case-Centric**
   - Everything revolves around cases, not metrics

3. **Urgency Awareness**
   - The UI visually communicates urgency, delays, and risks

4. **Low Cognitive Load**
   - Users understand the situation within 3 seconds

5. **Structured Hierarchy**
   - Clear separation between action areas, information areas, and signals

### Visual Language

The interface feels like:
- A control tower
- A system that thinks
- A place where decisions are made

NOT:
- A generic admin panel
- A finance dashboard
- A passive reporting tool

## Color System

**Base Colors:**
- Dark theme + Purple as brand color (maintained from original)

**Semantic Colors:**
- 🔴 **Red** → Urgent / Blocked / Risk
- 🟠 **Amber** → Warning / Delay
- 🟢 **Green** → Healthy / Completed
- 🟣 **Purple** → Actions / Primary interactions
- ⚪ **Neutral** → Structure

Colors communicate **meaning**, not decoration.

## Key Pages

### 1. Regiekamer Dashboard
**File:** `/components/care/RegiekamerPage.tsx`

The main control room where users see:
- **Top**: Search bar and filters (regio, status, urgentie)
- **KPI Strip**: 6 domain-based KPIs
  - Casussen zonder match
  - Open beoordelingen
  - Plaatsingen in behandeling
  - Gemiddelde wachttijd
  - Casussen met hoog risico
  - Capaciteitstekorten
- **Main Area**:
  - **Left**: Active cases table (sorted by urgency)
  - **Right**: System signals, priority actions, capacity overview

### 2. Case Detail Page ⭐ MOST IMPORTANT
**File:** `/components/care/CaseDetailPage.tsx`

This is the most critical screen in the system.

**Structure:**
- **Decision Header**
  - Case title, status, urgency, risk badges
  - Recommended action banner (urgent/warning/action/normal)
  
- **Phase Indicator**
  - Visual stepper: Casus → Aanbieder Beoordeling → Matching → Plaatsing → Intake
  
- **Main Content (3 columns)**:
  - **Left**: Case information
    - Client info
    - Case details
    - Timeline
  - **Center**: Active work area (changes per phase)
    - Aanbieder Beoordeling work area
    - Matching work area
    - Blocked work area
    - Placement work area
  - **Right**: System intelligence panel
    - Risks
    - AI Suggestions (with confidence scores)
    - Similar cases
    
- **Sticky Action Bar**
  - Context-aware primary actions

### 3. Matching Page
**File:** `/components/care/MatchingPage.tsx`

Provider matching decision interface.

**Features:**
- Top 3 provider matches with scores
- Each match shows:
  - Match score (0-100)
  - Match type (Best / Alternative / Risky)
  - Key metrics (region, availability, rating, response time)
  - Specializations
  - Match explanation (why this provider?)
  - Trade-offs (pros/cons)
  - Confidence indicators

**Action Buttons:**
- 🟢 **Best match**: "Plaats direct" (green)
- 🟣 **Alternative**: "Plaats" (purple)
- 🟠 **Risky**: "Plaats met risico" (amber)

**Decision Guidance Panel:**
- System recommendations
- Warnings
- Additional context

## Components Library

### Status & Urgency Components

1. **CaseStatusBadge** (`/components/care/CaseStatusBadge.tsx`)
   - Displays case phase status
   - Colors: intake, aanbieder beoordeling, matching, placement, active, completed, blocked

2. **UrgencyBadge** (`/components/care/UrgencyBadge.tsx`)
   - Shows urgency level
   - Levels: critical (red), high (amber), medium (blue), low (neutral)

3. **RiskBadge** (`/components/care/RiskBadge.tsx`)
   - Displays risk level
   - Levels: high, medium, low, none

### Information Components

4. **CareKPICard** (`/components/care/CareKPICard.tsx`)
   - Domain-specific KPI cards
   - Urgency-aware coloring

5. **CaseTableRow** (`/components/care/CaseTableRow.tsx`)
   - Compact case display for lists
   - Click to open case detail

6. **SignalCard** (`/components/care/SignalCard.tsx`)
   - System alerts/warnings
   - Types: capacity, delay, risk, quality

7. **PriorityActionCard** (`/components/care/PriorityActionCard.tsx`)
   - Prioritized next actions
   - Deadline-aware

### Utility Components

8. **PlaceholderPage** (`/components/care/PlaceholderPage.tsx`)
   - Used for unimplemented sections
   - Provides visual placeholder with icon

## Data Model

**File:** `/lib/casesData.ts`

### Core Types

```typescript
type CaseStatus = "intake" | "aanbieder beoordeling" | "matching" | "placement" | "active" | "completed" | "blocked";
type UrgencyLevel = "critical" | "high" | "medium" | "low";
type RiskLevel = "high" | "medium" | "low" | "none";
```

### Main Entities

1. **Case** - Healthcare case
2. **Aanbieder Beoordeling** - Case aanbieder beoordeling/evaluation
3. **Provider** - Care provider (aanbieder)
4. **Placement** - Provider placement for a case
5. **SystemSignal** - System-wide alerts
6. **PriorityAction** - Prioritized tasks

## Navigation Structure

**Sidebar Sections:**

### Overzicht (Overview)
- 🏢 **Regiekamer** (Control Room) - Main dashboard
- 🔔 **Meldingen** (Notifications)
- 💬 **Berichten** (Messages)

### Casussen (Cases)
- 📋 **Alle casussen** (All cases)
- 🛡️ **Aanbieder Beoordelingen** (Aanbieder Beoordelingen)
- 👥 **Matching** (Provider matching)
- ➕ **Plaatsingen** (Placements)

### Analytics
- 📊 **Rapportage** (Reports & Analytics)

## User Flow

### Primary Flow: Case → Match → Placement

1. **User lands on Regiekamer Dashboard**
   - Sees cases sorted by urgency
   - Identifies cases needing attention
   
2. **Clicks on a case**
   - Opens Case Detail Page
   - Sees recommendation banner
   - Reviews case information and system intelligence
   
3. **Takes action based on phase:**
   - **Aanbieder Beoordeling phase**: Contact assessor, update status
   - **Matching phase**: Click "Start matching"
   - **Blocked phase**: Escalate case
   - **Placement phase**: Follow up with provider
   
4. **In Matching View** (if matching phase)
   - Reviews top 3 provider matches
   - Compares scores, trade-offs, availability
   - Selects best provider
   - Confirms placement
   
5. **Returns to Regiekamer Dashboard**
   - Case updated
   - Next priority action surfaces

## Technical Notes

### State Management
- Main case navigation managed in `App.tsx`
- `selectedCaseId` and `isMatchingView` control detail/matching views
- All case data flows from `casesData.ts`

### Responsive Design
- Desktop-first (control room environment)
- Responsive breakpoints for smaller screens
- Three-column layouts collapse gracefully

### Accessibility
- Semantic color usage (not decoration)
- High contrast maintained
- Clear visual hierarchy
- Keyboard navigation supported

### Performance
- Mock data (no backend calls)
- Instant transitions
- Optimized for decision speed

## Future Enhancements

### Priority 1
- [ ] Real-time updates for case status
- [ ] Notification system integration
- [ ] Advanced filtering and search
- [ ] Bulk actions for cases

### Priority 2
- [ ] Analytics dashboard with charts
- [ ] Case history tracking
- [ ] Provider performance metrics
- [ ] Export/reporting functionality

### Priority 3
- [ ] Multi-user collaboration
- [ ] Case assignment workflow
- [ ] Automated matching AI
- [ ] Capacity forecasting

## Design Assets

### Premium Card Style
All major content areas use the `premium-card` class:
```css
/* Dark theme gradient background */
/* Subtle border */
/* Soft shadow */
```

### Hover States
All interactions use **purple** hover states (no blue/green):
```css
hover:bg-primary/10
hover:text-primary
hover:border-primary/20
```

## File Structure

```
/components/care/
├── RegiekamerPage.tsx        # Main dashboard
├── CaseDetailPage.tsx        # Case detail (MOST IMPORTANT)
├── MatchingPage.tsx          # Provider matching
├── CaseStatusBadge.tsx       # Status indicator
├── UrgencyBadge.tsx          # Urgency indicator
├── RiskBadge.tsx             # Risk indicator
├── CareKPICard.tsx           # KPI display
├── CaseTableRow.tsx          # Case list item
├── SignalCard.tsx            # System alerts
├── PriorityActionCard.tsx    # Action items
└── PlaceholderPage.tsx       # Placeholder component

/lib/
└── casesData.ts              # Mock data & types
```

## Conclusion

This Regiekamer system represents a complete transformation from e-commerce to healthcare coordination. Every design decision serves the goal of helping care coordinators make fast, informed decisions to help children and families get the care they need.

The system is **operational**, **intelligent**, **calm but urgent**, and **trustworthy** - exactly what a government-level care coordination platform should be.
