# Intake/Overdracht Page - Professional Handover Interface

## Overview

The **Intake/Overdracht (Intake/Handover) page** is where care providers take ownership of a placed case and prepare for the intake process. This is **NOT a simple detail page**—it's a structured professional handover document that ensures smooth transition from system to real-world care delivery.

---

## Design Philosophy

### Mental Model

The page feels like:
> **"A professional briefing + Structured handover + Clear starting point"**

NOT:
> ❌ "A messy detail dump"  
> ❌ "A passive information screen"  
> ❌ "An unstructured case file"

### Core Principles

1. **CLARITY FIRST**: Provider understands the situation in seconds
2. **STRUCTURED INFORMATION**: No overload, no missing context
3. **ACTION-ORIENTED**: Clear next steps always visible
4. **TRUST & COMPLETENESS**: Everything needed for intake is present
5. **OWNERSHIP**: Explicit responsibility transfer to provider

---

## Page Structure

### 3-Panel Layout

```
┌──────────────────────────────────────────────────────┐
│          TOP HEADER (Ownership Banner)                │
│   "Geplaatst – Intake fase"                          │
│   Deze casus is aan jou toegewezen ✓                 │
└──────────────────────────────────────────────────────┘

┌─────────┬──────────────────┬──────────┐
│  LEFT   │     CENTER       │  RIGHT   │
│  PANEL  │     PANEL        │  PANEL   │
│         │                  │          │
│ Case    │  Intake Briefing │ Status & │
│ Overview│  Documents       │ Actions  │
│         │  Timeline        │          │
│ (Sticky)│                  │ (Sticky) │
│         │  Probleemschets  │          │
│         │  Aanbieder Beoordeling     │Intake    │
│         │  Aanpak          │Status    │
│         │  Aandachtspunten │          │
│         │                  │Next      │
│         │  [Documents]     │Actions   │
│         │                  │          │
│         │  [Historie]      │Contact   │
└─────────┴──────────────────┴──────────┘
```

**Grid:** 12 columns
- Left: 3 columns (case overview - always visible)
- Center: 6 columns (briefing + documents + timeline)
- Right: 3 columns (status tracker + actions)

---

## TOP HEADER: Ownership Banner

### Purpose

Immediately communicate that the provider now owns this case and is entering the intake phase.

### Layout

```
┌────────────────────────────────────────────────────────┐
│ • Geplaatst – Intake fase                             │
│                                                        │
│ [Client Name] · [Care Type]                           │
│                                                        │
│ Toegewezen aan: [Provider Name]                       │
│ Case ID: C-001                                         │
│                                                        │
│ ✓ Deze casus is aan jou toegewezen                    │
│                                              [URGENCY] │
└────────────────────────────────────────────────────────┘
```

**Visual Treatment:**
- Purple gradient background (subtle)
- Purple border (2px)
- Animated status dot
- Green "ownership" badge
- Urgency indicator (right side)

**Content:**
- **Status badge**: "Geplaatst – Intake fase" (purple, uppercase)
- **Case title**: Client name + Care type
- **Assignment info**: Provider name, Case ID
- **Ownership confirmation**: "Deze casus is aan jou toegewezen" (green checkmark)
- **Urgency badge**: High/Medium/Low (color-coded)
- **Urgency warning** (if high): "Start intake binnen 3 werkdagen"

---

## LEFT PANEL: Case Overview

### Purpose

Quick reference panel with essential case information, always visible during scroll.

### Content

```
┌─────────────────────────┐
│ Casus overzicht         │
│                         │
│ Case ID                 │
│ C-001                   │
│                         │
│ Cliënt                  │
│ [Name]                  │
│                         │
│ Leeftijd                │
│ 14 jaar                 │
│                         │
│ Regio                   │
│ Amsterdam               │
│                         │
│ Zorgtype                │
│ Intensieve begeleiding  │
│                         │
│ Urgentie                │
│ [HOOG badge]            │
│                         │
│ Complexiteit            │
│ Hoog                    │
│ ─────────────────────   │
│ Kern samenvatting       │
│ Complexe gedrags...     │
└─────────────────────────┘
```

**Behavior:**
- Sticky positioning (top: 96px)
- Compact vertical layout
- Color-coded urgency badge
- Brief core summary at bottom

**Fields:**
1. Case ID
2. Client name
3. Age
4. Region
5. Care type
6. Urgency (badge)
7. Complexity level
8. Core summary (2-3 lines)

---

## CENTER PANEL: Intake Briefing (Core)

### Section 1: Probleemschets

**Purpose:** Explain what is going on and why care is needed.

```
┌────────────────────────────────────────┐
│ • Probleemschets                       │
│                                        │
│ [Client] (14 jaar) vertoont complexe  │
│ gedragsproblematiek met agressie-      │
│ uitingen naar leeftijdsgenoten...      │
│                                        │
│ [Full problem description, 3-5 lines] │
└────────────────────────────────────────┘
```

**Design:**
- Heading with bullet point
- Gray background box
- Clear, readable text (14px)
- Relaxed line height

**Content:**
- Behavioral description
- Family situation
- School/social context
- Why care is urgent

---

### Section 2: Aanbieder Beoordeling Samenvatting

**Purpose:** Summary of the aanbieder beoordeling decision and reasoning.

```
┌────────────────────────────────────────┐
│ • Aanbieder Beoordeling samenvatting             │
│                                        │
│ Aanbieder Beoordeling uitgevoerd op 15 april    │
│ 2026 door Lisa de Vries (Jeugdzorg-   │
│ specialist). Conclusie: intensieve     │
│ ambulante begeleiding noodzakelijk...  │
└────────────────────────────────────────┘
```

**Design:**
- Blue background (subtle, 5% opacity)
- Blue border
- Aanbieder Beoordeling date + assessor name
- Key conclusions highlighted

**Content:**
- Aanbieder Beoordeling date
- Assessor name + role
- Conclusion summary
- Urgency reasoning
- Recommended care modality

---

### Section 3: Aanbevolen Aanpak

**Purpose:** Suggested approach for care delivery (actionable recommendations).

```
┌────────────────────────────────────────┐
│ 🎯 Aanbevolen aanpak                   │
│                                        │
│ ✓ Start met individuele gesprekken... │
│ ✓ Betrek ouders vanaf week 2...       │
│ ✓ Coördineer met school voor...       │
│ ✓ Overweeg groepstherapie na...       │
└────────────────────────────────────────┘
```

**Design:**
- Green accent icon
- Stacked recommendation cards
- Each card has green checkmark
- Green background (5% opacity)
- Green border

**Content:**
- 3-5 actionable recommendations
- Step-by-step suggested approach
- Evidence-based interventions
- Collaboration points (school, family)

---

### Section 4: Belangrijke Aandachtspunten

**Purpose:** Highlight risks, special conditions, and critical notes.

```
┌────────────────────────────────────────┐
│ 💡 Belangrijke aandachtspunten         │
│                                        │
│ 🔴 Hoge urgentie: Start intake binnen │
│    3 werkdagen. Situatie escaleert... │
│                                        │
│ ⚠️  Vader toont weerstand tegen hulp. │
│    Expect mogelijk lastige start...   │
│                                        │
│ ℹ️  Eerdere hulpverlening bij Jeugd-  │
│    riagg (2024) voortijdig gestopt... │
└────────────────────────────────────────┘
```

**Design:**
- Three severity levels:
  - **Critical** (red): Blokkerende problemen
  - **Warning** (amber): Aandachtspunten
  - **Info** (blue): Contextual information
- Each note in its own colored box
- Icon + text layout

**Content:**
- Urgency warnings
- Family resistance/challenges
- Previous care history
- Special needs or conditions
- Safety concerns

---

## CENTER PANEL: Documents & Data

### Document Section

```
┌────────────────────────────────────────┐
│ Documenten & bestanden        3        │
│                                        │
│ ┌──────────────────────────────┐      │
│ │ 📄 Beoordelingsrapport.pdf   │      │
│ │    2.4 MB · 15 april         │ 👁️ ⬇️ │
│ └──────────────────────────────┘      │
│                                        │
│ ┌──────────────────────────────┐      │
│ │ 📄 School_rapportage.pdf     │      │
│ │    856 KB · 12 april         │ 👁️ ⬇️ │
│ └──────────────────────────────┘      │
│                                        │
│ ┌──────────────────────────────┐      │
│ │ 📝 Gezinssituatie_notities   │      │
│ │    124 KB · 14 april         │ 👁️ ⬇️ │
│ └──────────────────────────────┘      │
└────────────────────────────────────────┘
```

**Features:**
- Document type icons (PDF, DOCX, etc.)
- File size and upload date
- Uploader name
- Hover actions (preview, download)
- Clean list layout

**Empty State:**
```
┌────────────────────────────────────────┐
│ Documenten & bestanden                 │
│                                        │
│         📄                             │
│                                        │
│   Geen documenten beschikbaar          │
│   Er zijn nog geen documenten...       │
└────────────────────────────────────────┘
```

---

## CENTER PANEL: Case Timeline

### Timeline Display

```
┌────────────────────────────────────────┐
│ Case historie                          │
│                                        │
│ 📄  Casus aangemaakt     12 apr, 09:23│
│ │   Nieuwe melding van school...      │
│ │   Door: Emma Jansen                 │
│ │                                      │
│ ✅  Aanbieder Beoordeling afgerond 15 apr, 14:45│
│ │   Aanbieder Beoordeling compleet...            │
│ │   Door: Lisa de Vries               │
│ │                                      │
│ 🔄  Matching uitgevoerd  16 apr, 10:15│
│ │   Beste match: Zorggroep...         │
│ │   Door: Lisa de Vries               │
│ │                                      │
│ ✅  Plaatsing bevestigd  17 apr, 11:30│
│     Casus toegewezen...               │
│     Door: Lisa de Vries               │
└────────────────────────────────────────┘
```

**Event Types:**
- **Created** (blue): Case creation
- **Assessed** (purple): Aanbieder Beoordeling completion
- **Matched** (amber): Matching process
- **Placed** (green): Placement confirmation
- **Intake** (primary): Intake events

**Each Event:**
- Type icon (color-coded)
- Event title
- Description
- Timestamp
- User who performed action
- Connecting line to next event

---

## RIGHT PANEL: Intake Status Tracker

### Status Display

```
┌─────────────────────────────┐
│ Intake status               │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📅 Intake gepland      │ │
│ │                         │ │
│ │ Gepland voor:           │ │
│ │ 19 april, 14:00         │ │
│ └─────────────────────────┘ │
│                             │
│ Progress:                   │
│                             │
│ ✓  Nog niet gestart        │
│ │                           │
│ ●  Intake gepland          │← Current
│ │                           │
│ ○  Intake gestart          │
│ │                           │
│ ○  Intake afgerond         │
└─────────────────────────────┘
```

**Status Levels:**
1. **Nog niet gestart** (gray) → Default state
2. **Intake gepland** (blue) → Date/time set
3. **Intake gestart** (amber) → In progress
4. **Intake afgerond** (green) → Complete

**Visual Progress:**
- Vertical timeline
- Current status highlighted
- Completed steps (green checkmark)
- Future steps (gray circle)
- Connecting lines

**Quick Actions:**
- "Markeer als gepland" (if not started)
- "Start intake" (if planned)
- "Markeer als afgerond" (if in progress)

---

## RIGHT PANEL: Action Panel

### Next Actions

```
┌─────────────────────────────┐
│ Volgende acties             │
│                             │
│ [📅 Plan intake afspraak]  │
│                             │
│ [📞 Contact cliënt]        │
│                             │
│ [✓ Markeer als gestart]    │
└─────────────────────────────┘
```

**Primary Actions:**
- **Plan intake afspraak**: Opens planning modal
- **Start intake proces**: Marks intake as started
- **Contact cliënt**: Initiates contact workflow

**Secondary Actions:**
- View full dossier
- Download all documents
- Request additional information

**Conditional Display:**
- If not started: Show "Plan intake"
- If planned: Show "Start intake"
- If in progress: Show "Mark as complete"

---

### Contact Information

```
┌─────────────────────────────┐
│ 📞 Contact informatie       │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🏛️ Gemeente Amsterdam   │ │
│ │    Emma Jansen          │ │
│ │    e.jansen@amsterdam   │ │
│ │    +31 20 123 4567      │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ 👤 Lisa de Vries        │ │
│ │    Jeugdzorgspecialist  │ │
│ │    l.devries@amsterdam  │ │
│ │    +31 20 987 6543      │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**Municipality Contact:**
- Organization name
- Contact person
- Email (clickable)
- Phone (clickable)
- Icon: Building

**Case Owner Contact:**
- Name
- Role
- Email (clickable)
- Phone (clickable)
- Icon: User

---

### Quick Tips

```
┌─────────────────────────────┐
│ Tips voor intake            │
│                             │
│ • Neem contact op binnen    │
│   24 uur na plaatsing       │
│                             │
│ • Review alle documenten    │
│   voor de intake            │
│                             │
│ • Plan intake binnen 3      │
│   werkdagen bij hoge        │
│   urgentie                  │
└─────────────────────────────┘
```

**Design:**
- Blue background (5% opacity)
- Blue border
- Small text (12px)
- Bullet list
- Helpful reminders

---

## Plan Intake Modal

### Planning Interface

```
┌──────────────────────────────────┐
│ Plan intake afspraak             │
│                                  │
│ Plan een intake gesprek met      │
│ [Client] en/of familie...        │
│                                  │
│ Datum en tijd                    │
│ [2026-04-19T14:00]              │
│                                  │
│ Locatie                          │
│ ▼ Op locatie aanbieder           │
│   Bij cliënt thuis               │
│   Online (video)                 │
│                                  │
│ Notities                         │
│ [Textarea for notes]             │
│                                  │
│ [Annuleren] [📅 Bevestig planning]│
└──────────────────────────────────┘
```

**Fields:**
- Date/time picker
- Location selector
- Optional notes field

**Actions:**
- Cancel (outline)
- Confirm (primary, purple)

**On Confirm:**
- Status updates to "planned"
- Date is saved
- Modal closes
- Notification sent

---

## Component Architecture

### Components Created

1. **IntakePage.tsx**
   - Main page container
   - 3-panel layout orchestration
   - State management
   - Modal handling

2. **IntakeBriefing.tsx**
   - Core briefing sections
   - Probleemschets
   - Aanbieder Beoordeling samenvatting
   - Aanbevolen aanpak
   - Aandachtspunten

3. **IntakeStatusTracker.tsx**
   - Status display
   - Progress visualization
   - Quick status updates
   - Date/time display

4. **CaseTimeline.tsx**
   - Full case history
   - Event visualization
   - Timeline connections
   - User attribution

5. **DocumentSection.tsx**
   - Document list
   - Preview/download actions
   - Empty state
   - Type icons

6. **ActionPanel.tsx**
   - Next actions
   - Contact information
   - Quick tips
   - Contextual CTAs

---

## User Workflows

### Scenario 1: Review and Plan Intake (Fast Path)

```
1. Provider opens intake page
2. Reads top header: "Toegewezen aan jou"
3. Scans left panel: High urgency, 14 years old
4. Reads briefing: Problem description, aanbieder beoordeling
5. Notes critical warning: "Start binnen 3 werkdagen"
6. Clicks "Plan intake afspraak"
7. Selects date/time: 19 april, 14:00
8. Confirms planning
9. Status updates to "Intake gepland"
```

**Time:** 2-3 minutes

---

### Scenario 2: Deep Review Before Planning

```
1. Provider opens page
2. Reads full briefing (all 4 sections)
3. Downloads aanbieder beoordeling report
4. Reviews school documentation
5. Checks contact info for municipality
6. Reads timeline to understand history
7. Notes family resistance warning
8. Clicks "Plan intake"
9. Adds note: "Plan extra time for family engagement"
10. Confirms planning
```

**Time:** 10-15 minutes

---

### Scenario 3: Start Intake Process

```
1. Provider opens page (intake already planned)
2. Status shows: "Intake gepland – 19 april, 14:00"
3. Day of intake arrives
4. Provider clicks "Start intake"
5. Status updates to "Intake gestart"
6. Provider conducts intake meeting
7. Returns to page
8. Clicks "Markeer als afgerond"
9. Status updates to "Intake afgerond"
```

**Time:** Varies (depends on real-world intake)

---

## Color System

| Color | Meaning | Usage |
|-------|---------|-------|
| **Purple** | Ownership / Primary | Top header, status, primary actions |
| **Green** | Complete / Positive | Recommendations, completed steps, checkmarks |
| **Blue** | Information | Aanbieder Beoordeling summary, info notes, documents |
| **Amber** | Warning | Medium warnings, in-progress status |
| **Red** | Critical | High urgency, critical notes, blocking issues |
| **Gray** | Not Started | Default status, inactive steps |

---

## Responsive Behavior

### Desktop (1400px+)
- 3-column layout (3-6-3)
- All panels visible
- Sticky side panels

### Laptop (1024-1399px)
- Same layout, tighter spacing
- All features visible

### Tablet (768-1023px)
- 2-column: Center panel full width
- Sidebars collapse to accordions

### Mobile (<768px)
- 1-column stack
- Briefing first
- Status second
- Overview collapsible header

---

## Integration Points

### From Placement

```
Placement confirmed →
Provider assigned →
Intake page accessible →
Status: "not-started"
```

### To Care Delivery

```
Intake planned →
Intake started →
Intake completed →
Care delivery begins →
Case monitoring (ongoing)
```

### Data Flow

```
IntakePage
  ↓ (receives)
Case ID + Provider ID
  ↓ (fetches)
GET /api/cases/:id/intake
GET /api/documents?caseId=:id
GET /api/timeline/:id
  ↓ (displays)
Full briefing + status + actions
  ↓ (updates)
PATCH /api/intakes/:id
  ↓ (status changes)
not-started → planned → in-progress → completed
```

---

## Accessibility

### Keyboard Navigation

```
Tab         → Navigate sections
Enter       → Expand/collapse
Space       → Select document
Arrows      → Scroll timeline
Esc         → Close modal
```

### Screen Reader

```html
<main aria-label="Intake handover for [Client Name]">
  <section aria-label="Case overview">
    ...
  </section>
  
  <section aria-label="Intake briefing">
    <article aria-label="Problem description">
      ...
    </article>
  </section>
  
  <aside aria-label="Status and actions">
    ...
  </aside>
</main>
```

### Focus Management

- Clear purple focus rings
- Logical tab order
- Focus trap in modal
- Return focus after close

---

## Success Metrics

### Clarity (Speed to Understanding)

- Provider understands case in <3 minutes
- Critical info visible without scrolling
- Urgency immediately apparent

### Completeness

- All aanbieder beoordeling data present
- All documents available
- Full contact information
- Clear action steps

### Action Rate

- >90% of intakes planned within 24 hours
- >95% of high-urgency intakes started within 3 days
- <5% requests for additional information

---

## Summary

The **Intake/Overdracht page** transforms case handover from a data dump into a **professional briefing document**. The system:

1. **Gives clarity** in seconds with structured sections
2. **Ensures completeness** with all necessary information
3. **Guides action** with clear next steps
4. **Establishes ownership** with explicit assignment
5. **Supports planning** with integrated intake scheduling

**Key Innovation:** Professional handover + Structured briefing + Action guidance = Confident intake start.

---

**Page Version:** 1.0.0  
**Design Date:** April 17, 2026  
**Status:** Production Ready  
**Documentation:** Complete
