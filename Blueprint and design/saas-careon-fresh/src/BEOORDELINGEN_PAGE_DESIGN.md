# Beoordelingen Page - Guided Decision System

## Overview

The **Beoordelingen (Assessments) page** is a structured decision interface where care coordinators assess cases and determine:

- Whether care is needed
- Type of care required
- Urgency level
- Complexity and risk factors

This is **NOT a simple form**. It's a guided decision system that prevents errors, reduces ambiguity, and enforces structured thinking.

---

## Design Philosophy

### Mental Model

The page feels like:
> **"A guided decision system + Structured intake tool + Smart workflow assistant"**

NOT:
> ❌ "A long form"  
> ❌ "A questionnaire"  
> ❌ "A passive input screen"

### Core Principles

1. **GUIDED FLOW**: Step-by-step progression through assessment
2. **DECISION CLARITY**: Every input has clear purpose and impact
3. **PROGRESS VISIBILITY**: Users always know where they are
4. **ERROR PREVENTION**: Validation prevents incomplete submissions
5. **ACTION-DRIVEN**: Clear next step after completion

---

## Page Structure

### Two View Modes

1. **LIST VIEW** (default): Work queue of open assessments
2. **DETAIL VIEW**: Guided decision interface with 3-panel layout

---

## LIST VIEW - Assessment Queue

### Purpose

Task queue showing all open assessments that need attention.

### Layout

```
┌──────────────────────────────────────────────────────┐
│ Beoordelingen                                        │
│ Beoordeel casussen en bepaal zorgbehoefte · 3 open  │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ [🔍 Zoek beoordelingen...] [Filters]                │
└──────────────────────────────────────────────────────┘

Open beoordelingen                          3 te doen
┌──────────────────────────────────────────────────────┐
│ [BEZIG] 8d                                           │
│ Jeugd 14 – Complex gedrag                           │
│ 📍 Amsterdam · Case ID: C-001                       │
│                                                      │
│ ⚠️ Urgentie niet ingevuld                           │
│ ⚠️ Risicofactoren ontbreken                         │
│                                  [Verder gaan →]    │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ [TE DOEN] 5d                                         │
│ Jeugd 13 – Trauma & angststoornis                   │
│ 📍 Eindhoven · Case ID: C-005                       │
│                                                      │
│ ⚠️ Psychiatrische beoordeling ontbreekt            │
│                                  [Start beoordeling]│
└──────────────────────────────────────────────────────┘
```

### Components

**Page Header:**
- Title: "Beoordelingen"
- Subtitle: Dynamic count of open assessments
- Search bar: Real-time filtering
- Filters button: Advanced filtering (future)

**Queue Section:**
- Header: "Open beoordelingen" + count
- Assessment cards sorted by wait time
- Empty state when queue is clear

---

## Assessment Queue Card

### Card Anatomy

```
┌────────────────────────────────────────────────────┐
│ [STATUS] [WAIT TIME]                               │ ← Status + Urgency
│                                                    │
│ Case Title                                         │ ← Large, prominent
│ 📍 Regio · Case ID: XXX                           │ ← Meta info
│                                                    │
│ ⚠️ Problem 1                                       │ ← Missing info
│ ⚠️ Problem 2                                       │   (errors/warnings)
│                                                    │
│                            [Start beoordeling →]  │ ← Primary CTA
└────────────────────────────────────────────────────┘
```

### Status Types

| Status | Label | Color | Meaning |
|--------|-------|-------|---------|
| `open` | Te doen | Blue | Not started |
| `in_progress` | Bezig | Amber | Draft saved |
| `completed` | Afgerond | Green | Finished |

### Wait Time Indicator

- **Normal (≤3 days)**: No indicator
- **Delayed (>3 days)**: Red badge with days count
- Example: `8d` in red box

### Missing Info Indicators

**Error (Red):**
- Critical missing data
- Blocks completion
- Example: "Urgentie niet ingevuld"

**Warning (Amber):**
- Recommended but not required
- Should be reviewed
- Example: "Risicofactoren ontbreken"

### CTA Buttons

- **New assessment**: "Start beoordeling"
- **In-progress**: "Verder gaan"
- Purple primary button with arrow

---

## DETAIL VIEW - Guided Decision Interface

### 3-Panel Layout

```
┌─────────┬──────────────────┬──────────┐
│  LEFT   │     CENTER       │  RIGHT   │
│ Context │  Assessment Form │Validation│
│  Panel  │    (Stepper)     │  Panel   │
│         │                  │          │
│ Sticky  │   Steps 1-3      │  Sticky  │
│         │                  │          │
└─────────┴──────────────────┴──────────┘
            Sticky Action Bar
```

**Grid:** 12 columns
- Left: 3 columns (25%)
- Center: 6 columns (50%)
- Right: 3 columns (25%)

---

## LEFT PANEL: Case Context

### Purpose

Always-visible case information for reference during assessment.

### Content

```
┌─────────────────────────┐
│ Casus informatie        │
│                         │
│ Casus ID                │
│ C-001                   │
│                         │
│ Titel                   │
│ Jeugd 14 – Complex...   │
│                         │
│ Regio                   │
│ Amsterdam               │
│                         │
│ Leeftijd                │
│ 14 jaar                 │
│                         │
│ Wachttijd               │
│ 8 dagen (red if >5)     │
│ ─────────────────────   │
│ Historie                │
│ Intake: 12 apr 2026     │
└─────────────────────────┘
```

**Behavior:**
- Sticky positioning (top: 96px to account for topbar)
- Premium card styling
- Compact, scannable information
- Wait time in red if >5 days

---

## CENTER PANEL: Assessment Flow

### Progress Stepper

```
┌──────────────────────────────────────────────────┐
│  (1)─────────(2)─────────(3)                    │
│  Basis       Complexiteit  Aanvullende          │
│  beoordeling               info                 │
│  Actieve stap                                    │
└──────────────────────────────────────────────────┘
```

**Design:**
- 3 steps in horizontal progression
- Circle indicators (numbered 1-3)
- Connector lines between steps
- Active step: Primary color + pulse animation
- Completed step: Green checkmark
- Future step: Muted/gray

**States:**
- **Active**: Purple border, scale 110%, pulse ring
- **Completed**: Green border, checkmark icon
- **Past**: Purple border (50% opacity)
- **Future**: Gray border, number

**Interactions:**
- Click completed/past steps to navigate back
- Future steps not clickable (enforces linear flow)

---

### Step 1: Basis Beoordeling

```
┌────────────────────────────────────────────────┐
│ Basis beoordeling                              │
│ Bepaal of zorg nodig is en wat voor type      │
│                                                │
│ Is zorg nodig? *                               │
│ ┌─────────┐  ┌─────────┐                      │
│ │   Ja    │  │   Nee   │                      │
│ └─────────┘  └─────────┘                      │
│                                                │
│ Type zorg * (if yes)                           │
│ ┌──────────────────────────────────────────┐  │
│ │ Selecteer type zorg              ▼      │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ Urgentie *                                     │
│ ┌──────┐  ┌──────────┐  ┌──────┐             │
│ │ Laag │  │ Gemiddeld │  │ Hoog │             │
│ └──────┘  └──────────┘  └──────┘             │
│                                                │
│                          [Volgende stap]      │
└────────────────────────────────────────────────┘
```

**Fields:**

1. **Is zorg nodig?** (Required)
   - Type: Binary choice (Ja/Nee)
   - Design: Two large toggle buttons
   - Selected: Primary color background
   - Unselected: Muted border

2. **Type zorg** (Required if "Ja")
   - Type: Dropdown select
   - Conditional: Only shows if care needed = yes
   - Options:
     - Ambulante begeleiding
     - Dagbesteding
     - Residentiële zorg
     - Klinische behandeling
     - Gezinsondersteuning

3. **Urgentie** (Required)
   - Type: 3-option choice
   - Design: Three buttons (Laag/Gemiddeld/Hoog)
   - Colors: Green (laag), Amber (gemiddeld), Red (hoog)
   - Visual feedback on selection

**Action:** "Volgende stap" button (purple) → Step 2

---

### Step 2: Complexiteit

```
┌────────────────────────────────────────────────┐
│ Complexiteit                                   │
│ Bepaal de complexiteit van de situatie        │
│                                                │
│ Is er sprake van multi-problematiek?          │
│ ┌─────────┐  ┌─────────┐                      │
│ │   Ja    │  │   Nee   │                      │
│ └─────────┘  └─────────┘                      │
│                                                │
│ Risicofactoren                                 │
│ ☐ Agressie                                     │
│ ☐ Zelfbeschadiging                            │
│ ☐ Middelengebruik                             │
│ ☐ Crimineel gedrag                            │
│                                                │
│ [Vorige stap]              [Volgende stap]    │
└────────────────────────────────────────────────┘
```

**Fields:**

1. **Multi-problematiek?**
   - Type: Binary choice (Ja/Nee)
   - Design: Two toggle buttons
   - Triggers suggestion if Yes + Low urgency

2. **Risicofactoren**
   - Type: Multi-select checkboxes
   - Options:
     - Agressie
     - Zelfbeschadiging
     - Middelengebruik
     - Crimineel gedrag
   - Design: Checkbox list with hover border
   - Triggers warning if none selected

**Actions:**
- "Vorige stap" → Step 1
- "Volgende stap" → Step 3

---

### Step 3: Aanvullende Info

```
┌────────────────────────────────────────────────┐
│ Aanvullende informatie                         │
│ Voeg extra context toe indien nodig            │
│                                                │
│ Aanvullende opmerkingen                        │
│ ┌──────────────────────────────────────────┐  │
│ │ Voeg hier relevante extra               │  │
│ │ informatie toe...                        │  │
│ │                                          │  │
│ │                                          │  │
│ │                                          │  │
│ └──────────────────────────────────────────┘  │
│                                                │
│ [Vorige stap]                                  │
└────────────────────────────────────────────────┘
```

**Fields:**

1. **Aanvullende opmerkingen**
   - Type: Textarea (optional)
   - Rows: 6
   - Placeholder: "Voeg hier relevante extra informatie toe..."
   - No character limit
   - Triggers suggestion if clinical care selected but empty

**Action:** "Vorige stap" → Step 2

---

## RIGHT PANEL: Validation & Suggestions

### Purpose

Real-time validation feedback and AI-powered suggestions.

### Layout

```
┌─────────────────────────────┐
│ Validatie & Suggesties      │
│ Controleer de beoordeling   │
│                             │
│ PROBLEMEN GEVONDEN          │
│                             │
│ ⚠️ Geef aan of zorg nodig   │
│    is                       │
│                             │
│ ⚠️ Selecteer het type zorg  │
│                             │
│ ⚠️ Bepaal de urgentie       │
│                             │
│ ─────────────────────────   │
│ SUGGESTIES                  │
│                             │
│ 💡 Overweeg hogere urgentie │
│    bij multi-problematiek   │
│    [Toepassen]              │
│                             │
│ ─────────────────────────   │
│ Let op: Los alle problemen  │
│ op voordat je kunt afronden │
└─────────────────────────────┘
```

### Validation Messages

**Error (Red):**
- Icon: AlertTriangle
- Background: Red/10%
- Border: Red/30%
- Text: Red/300
- Blocks completion

**Warning (Amber):**
- Icon: AlertTriangle
- Background: Amber/10%
- Border: Amber/30%
- Text: Amber/300
- Allows completion but shows alert

**Info (Blue):**
- Icon: Info
- Background: Blue/10%
- Border: Blue/30%
- Text: Blue/300
- Informational only

**Success (Green):**
- Icon: CheckCircle2
- Background: Green/5%
- Border: Green/30%
- Text: Green/300
- Shows when all required fields complete

### Validation Rules

**Required Fields:**
1. "Is zorg nodig?" → Error if empty
2. "Type zorg" → Error if care needed = yes AND empty
3. "Urgentie" → Error if empty

**Conditional Warnings:**
1. No risk factors selected → Warning
2. Clinical care + no additional info → Suggestion

**Smart Suggestions:**
1. Multi-problem = yes + Urgency = low → Suggest high urgency
2. Clinical care + empty notes → Suggest adding context

### Suggestions

**Design:**
- Icon: Lightbulb (purple)
- Background: Purple/10%
- Border: Purple/30%
- Text: Purple/300
- Optional "Toepassen" button

**Behavior:**
- Click "Toepassen" → Auto-fills suggested value
- Inline action, no page reload
- Visual feedback (field highlights briefly)

---

## STICKY ACTION BAR

### Layout

```
┌──────────────────────────────────────────────────────┐
│ ✓ Klaar om af te ronden                              │
│              [Opslaan als concept] [Beoordeling afronden]│
└──────────────────────────────────────────────────────┘
```

**Position:** Fixed to bottom of viewport  
**Background:** Semi-transparent with backdrop blur  
**Border:** Top border (muted)  
**Padding:** 16px  

### Status Indicator (Left)

**Complete:**
```
✓ Klaar om af te ronden
```
- Color: Green/400
- Font: Medium weight

**Incomplete:**
```
3 problemen moeten worden opgelost
```
- Color: Muted foreground
- Font: Regular

### Action Buttons (Right)

**Opslaan als concept:**
- Type: Outline button
- Icon: Save
- Color: Muted border
- Action: Save current state to draft
- Always enabled
- Shows toast on save

**Beoordeling afronden:**
- Type: Primary button
- Icon: CheckCircle2
- Color: Purple (primary)
- Action: Complete assessment → Trigger matching
- Disabled if errors present
- Shows completion modal on success

---

## Validation System

### Real-Time Validation

**On field change:**
1. Validate field value
2. Update validation panel immediately
3. Update action bar status
4. Show inline errors if needed

**On step navigation:**
1. Validate current step
2. Allow navigation to past/completed steps
3. Block navigation to future steps if current incomplete

**On submit:**
1. Validate all fields
2. Show errors in validation panel
3. Scroll to first error
4. Prevent submission if errors

### Error Prevention

**Field-level:**
- Required fields marked with red asterisk
- Conditional fields hide/show based on logic
- Dropdowns can't be empty (placeholder not selectable)
- Checkboxes show warning if none selected

**Form-level:**
- Submit button disabled if errors
- Clear status indicator shows completion state
- Stepper shows which steps are incomplete

### Inline Feedback

**Success state:**
- Green border on completed sections
- Checkmark in stepper
- Green text in validation panel

**Error state:**
- Red border on field (if touched)
- Error message below field
- Red icon in validation panel

---

## Color System

| Color | Meaning | Usage |
|-------|---------|-------|
| **Red** | Error/Critical | Required field missing, validation errors |
| **Amber** | Warning | Recommended fields, suggestions |
| **Green** | Valid/Complete | Completed steps, successful validation |
| **Purple** | Action | CTAs, recommendations, suggestions |
| **Blue** | Information | Info messages, neutral context |

---

## User Workflows

### Scenario 1: Complete New Assessment

```
1. User opens Beoordelingen page (list view)
2. Sees "Open beoordelingen" section
3. Clicks "Start beoordeling" on first item
4. → Detail view opens

5. Step 1: Basis beoordeling
   - Selects "Ja" for care needed
   - Dropdown appears
   - Selects "Ambulante begeleiding"
   - Selects "Gemiddeld" urgency
   - Clicks "Volgende stap"

6. Step 2: Complexiteit
   - Selects "Nee" for multi-problem
   - Checks "ADHD" risk factor
   - Clicks "Volgende stap"

7. Step 3: Aanvullende info
   - Adds optional notes
   - Reviews validation panel (all green)

8. Clicks "Beoordeling afronden"
9. Confirmation modal appears
10. Assessment complete → Triggers matching phase
```

**Time:** 2-3 minutes for experienced user

### Scenario 2: Resume Draft Assessment

```
1. User sees assessment with "BEZIG" status
2. Missing info indicators show incomplete fields
3. Clicks "Verder gaan"
4. → Opens to last active step

5. Validation panel shows errors
6. User fills missing required fields
7. Errors clear in real-time
8. "Beoordeling afronden" enables
9. User completes assessment
```

**Time:** 1-2 minutes

### Scenario 3: Apply Smart Suggestion

```
1. User fills basis beoordeling
   - Multi-problem: Ja
   - Urgency: Laag

2. Validation panel shows suggestion:
   "💡 Overweeg hogere urgentie bij multi-problematiek"
   
3. User clicks "Toepassen"
4. Urgency auto-updates to "Hoog"
5. Suggestion disappears
6. User continues assessment
```

**Time:** <10 seconds

---

## Responsive Behavior

### Desktop (1400px+)

- 3-column layout (3-6-3)
- Full stepper visible
- All panels side-by-side
- Sticky panels work well

### Laptop (1024-1399px)

- Same 3-column layout
- Slightly tighter spacing
- All features visible

### Tablet (768-1023px)

- 2-column layout: Form + Validation
- Context panel collapses to accordion
- Stepper reduces label text
- Sticky panels remain

### Mobile (<768px)

- 1-column stack
- Context panel: Collapsible header
- Form: Full width
- Validation: Below form
- Stepper: Vertical or icon-only
- Action bar: Full width

---

## Empty State

### When No Assessments

```
┌─────────────────────────────┐
│                             │
│        [✅ Icon]            │
│                             │
│  Geen open beoordelingen 🎯 │
│                             │
│  Alle beoordelingen zijn    │
│  afgerond. Goed bezig!      │
│                             │
└─────────────────────────────┘
```

**Design:**
- Premium card
- Large green icon (gradient background)
- Centered layout
- Positive messaging
- Encourages completion

---

## Integration Points

### From Regiekamer

```
User sees case needing assessment →
Clicks "Start beoordeling" →
Opens Beoordelingen page (detail view) →
Pre-loads case context
```

### From Casussen

```
User selects case →
Clicks "Start beoordeling" →
Opens Beoordelingen page →
Context panel pre-filled
```

### To Matching

```
User completes assessment →
Clicks "Beoordeling afronden" →
Assessment saved →
Triggers matching phase →
Navigate to Matching page with case ID
```

### Data Flow

```
BeoordelingenPage
  ↓ (fetches)
GET /api/assessments?status=open
  ↓ (returns)
Assessment[]
  ↓ (on complete)
POST /api/assessments/:id/complete
  ↓ (triggers)
POST /api/matching/:caseId/start
  ↓ (navigate)
MatchingPage
```

---

## Component Architecture

### Components Created

1. **BeoordelingenPage.tsx**
   - Main page container
   - View mode switching (list/detail)
   - Form state management
   - Validation logic

2. **AssessmentQueueCard.tsx**
   - Queue item display
   - Status indicators
   - Missing info badges
   - Start action

3. **AssessmentStepper.tsx**
   - Progress visualization
   - Step navigation
   - Active state highlighting
   - Completion tracking

4. **AssessmentFormSection.tsx**
   - Reusable form section
   - Collapsible behavior
   - Completion indicator
   - Required field marking

5. **ValidationPanel.tsx**
   - Real-time validation display
   - Error/warning/success messages
   - Smart suggestions
   - Completion requirements

### Component Reusability

- **AssessmentStepper**: Any multi-step process
- **AssessmentFormSection**: Any structured form
- **ValidationPanel**: Any form validation needs
- **AssessmentQueueCard**: Any task queue

---

## Performance

### Optimization

- Form state in React hooks (fast updates)
- Validation runs client-side (instant feedback)
- Sticky panels use CSS position (no JS scroll listeners)
- No external API calls during form filling
- Save to API only on "Opslaan" or "Afronden"

### Expected Load Times

- List view: <500ms
- Detail view: <300ms (client-side only)
- Validation update: <50ms (instant)
- Save draft: <1s (API call)
- Complete assessment: <2s (API + matching trigger)

---

## Accessibility

### Keyboard Navigation

```
Tab         → Move between fields
Enter       → Submit/next (on focused button)
Space       → Toggle checkboxes/buttons
Arrows      → Navigate between radio/toggle options
Esc         → Cancel/close modal
```

### Screen Reader Support

```html
<form aria-label="Beoordeling formulier">
  <fieldset aria-required="true">
    <legend>Is zorg nodig?</legend>
    <button role="radio" aria-checked="true">Ja</button>
    <button role="radio" aria-checked="false">Nee</button>
  </fieldset>
  
  <div role="region" aria-label="Validatie meldingen">
    <div role="alert" aria-live="polite">
      Urgentie niet ingevuld
    </div>
  </div>
</form>
```

### Focus Management

- Clear purple focus rings
- Logical tab order (top to bottom, left to right)
- Focus returns to trigger after modal close
- Error fields get focus on validation failure

---

## Testing Strategy

### Unit Tests

- [ ] Form field validation logic
- [ ] Step progression logic
- [ ] Conditional field display
- [ ] Suggestion generation
- [ ] Save/complete handlers

### Integration Tests

- [ ] Complete assessment flow (all steps)
- [ ] Resume draft assessment
- [ ] Apply smart suggestion
- [ ] Error state handling
- [ ] Navigation between views

### Visual Tests

- [ ] Stepper states (active, completed, future)
- [ ] Validation panel messages
- [ ] Queue card variations
- [ ] Empty state
- [ ] Responsive layouts

---

## Future Enhancements

### Phase 2: Advanced Features

- **Auto-save**: Periodic draft saves (every 30s)
- **Undo/redo**: Step back through changes
- **Assessment templates**: Pre-fill common scenarios
- **Bulk assessment**: Assess multiple similar cases
- **Peer review**: Request second opinion

### Phase 3: AI Intelligence

- **Smart pre-fill**: AI suggests values based on case data
- **Risk scoring**: Automatic risk calculation
- **Similar cases**: Show comparable past assessments
- **Outcome prediction**: ML model predicts care success

### Phase 4: Collaboration

- **Multi-user**: Multiple assessors on same case
- **Comments**: Add notes to specific fields
- **Approval workflow**: Supervisor sign-off required
- **Audit trail**: Full change history

---

## Summary

The **Beoordelingen page** transforms case assessment from a passive form-filling exercise into a **guided decision-making process**. The structured approach:

1. **Prevents errors** through validation
2. **Guides thinking** with step-by-step flow
3. **Reduces time** with smart suggestions
4. **Ensures completeness** with clear requirements
5. **Maintains context** with persistent case info

**Key Innovation:** Real-time validation + AI suggestions = faster, more accurate assessments.

---

**Page Version:** 1.0.0  
**Design Date:** April 17, 2026  
**Status:** Production Ready  
**Documentation:** Complete
