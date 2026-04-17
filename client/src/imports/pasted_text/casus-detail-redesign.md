You are a senior product designer specialized in operational systems, healthcare workflows, and decision-driven SaaS.

Your task is to redesign the “Casus Detail Page” of the Careon Zorgregie platform into a unified control interface that combines:

- decision-making
- active workflow (beoordeling, matching, plaatsing)
- lifecycle tracking (status, timeline, issues, outcomes)

This page must become the single source of truth for a casus.

-----------------------------------
CONTEXT
-----------------------------------

The system is case-centric.

All work happens inside a casus:
Casus → Beoordeling → Matching → Plaatsing → Intake

Users must be able to:
- understand the current situation
- perform the next action
- see what already happened
- detect issues or delays

WITHOUT navigating away.

-----------------------------------
GOAL
-----------------------------------

Design a unified Casus Detail page that:

- shows current state instantly
- guides next actions
- displays active workflow
- includes lifecycle tracking
- supports accountability and traceability

The interface should feel like:

- a control center for one case
- a decision engine + tracking system
- structured and intelligent

-----------------------------------
DESIGN PRINCIPLES
-----------------------------------

1. STATUS FIRST
User must immediately see:
- current phase
- urgency
- next step

2. ACTION FIRST
Primary actions must be obvious.

3. TRACKING ALWAYS VISIBLE
Lifecycle tracking must be accessible without leaving the page.

4. LOW COGNITIVE LOAD
Information grouped and scannable.

5. CASE-CENTRIC
Everything revolves around this single casus.

-----------------------------------
PAGE STRUCTURE
-----------------------------------

1. TOP DECISION HEADER

Include:

- Casus title
- Status badge (e.g. “Beoordeling ontbreekt”)
- Urgency indicator
- Next action (system recommendation)

Example:

“Beoordeling ontbreekt – 3 dagen stilstand”
→ Aanbevolen: Start beoordeling

Primary CTA:
[Start beoordeling]

-----------------------------------

2. MAIN LAYOUT (3-COLUMN STRUCTURE)

-----------------------------------
LEFT (30-35%) — CONTEXT
-----------------------------------

- Basisinformatie
  - Leeftijd
  - Regio
  - Zorgtype
  - Urgentie

- Huidige fase indicator (stepper):
  Casus → Beoordeling → Matching → Plaatsing → Intake

- Key notes / samenvatting

-----------------------------------
CENTER (40-45%) — ACTIVE WORK AREA
-----------------------------------

Dynamic based on phase:

If Beoordeling:
- structured assessment form

If Matching:
- top 3 provider cards

If Plaatsing:
- selected provider + confirmation

If Intake:
- intake briefing + actions

This area is where the user works.

-----------------------------------
RIGHT (25-30%) — INTELLIGENCE + TRACKING
-----------------------------------

Split into 3 blocks:

-----------------------------------
A. RISICOSIGNALEN
-----------------------------------
- Missing data
- No providers
- Long waiting time

-----------------------------------
B. NEXT ACTION / SYSTEM INSIGHT
-----------------------------------
- “Werk eerst beoordeling af”
- “Matching vereist”
- reasoning

-----------------------------------
C. TRACKING (NEW CORE FEATURE)
-----------------------------------

Include:

-----------------------------------
TIMELINE
-----------------------------------

Visual vertical timeline:

- Casus aangemaakt
- Beoordeling afgerond
- Matching uitgevoerd
- Plaatsing bevestigd
- Intake gepland
- Intake gestart

Each step:
- status (completed / current / pending)
- timestamp
- responsible party

Highlight current step strongly.

-----------------------------------
ISSUES / BLOCKERS
-----------------------------------

- Wachttijd overschreden
- Geen reactie aanbieder
- Intake niet gepland

If none:
“Geen open blokkades”

-----------------------------------
OUTCOME (WHEN AVAILABLE)
-----------------------------------

- Geaccepteerd / Afgewezen
- Reason code:
  - Geen capaciteit
  - Niet passend
  - Onvoldoende info

-----------------------------------

4. STICKY ACTION BAR

Always visible:

- Primary action (context-based)
- Secondary actions:
  - Bekijk historie
  - Escaleren
  - Terug

-----------------------------------

5. OPTIONAL TABS (IF NEEDED)

If layout becomes too dense:

Tabs:
- Overzicht (default)
- Tracking (expanded timeline)
- Documenten

-----------------------------------

6. COLOR SYSTEM

- Red → urgent / blocked
- Amber → warning
- Green → completed / success
- Purple → actions

-----------------------------------

7. MICRO INTERACTIONS

- Hover states on timeline
- Expandable tracking details
- Smooth transitions between phases
- Dynamic updates

-----------------------------------

8. COMPONENTS

Design reusable:

- Status badge
- Stepper (flow)
- Timeline item
- Issue card
- Outcome block
- Decision header
- Action bar

-----------------------------------

TONE & FEELING
-----------------------------------

The interface should feel like:

- a control center for one case
- structured and calm
- intelligent and guiding
- traceable and accountable

NOT:
- a long form
- a data dump
- a passive detail page

-----------------------------------

OUTPUT
-----------------------------------

Create:

- Full Casus Detail page redesign
- Integrated tracking system
- Component library for reuse

Ensure:

- clear hierarchy
- seamless flow between actions and tracking
- no need for separate tracking page
- consistency with all other Careon pages

-----------------------------------