# Provider Profile Page - Complete Documentation

## 🎯 Overview

The **Zorgaanbieder Profiel** (Provider Profile) page is a high-impact decision support interface that helps care coordinators understand and evaluate care providers in detail.

**Key Purpose:**
- Build trust in the provider
- Reduce decision uncertainty
- Support confident selection
- Answer: "Is this the right provider?"

**Access Points:**
1. From Matching page (with match context)
2. From Providers list (exploration mode)

---

## 📐 Page Structure

### Layout: Two-Column (Desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP BAR: [← Back]              [Case Info] [Match Score]        │
├──────────────────────────────────┬───────────────────────────────┤
│ LEFT COLUMN (2/3)                │ RIGHT COLUMN (1/3)            │
│                                  │                               │
│ ┌────────────────────────────┐  │ ┌─────────────────────────┐  │
│ │ PROVIDER HEADER            │  │ │ CAPACITY & AVAILABILITY │  │
│ │ • Name, location, rating   │  │ │ • Current spots         │  │
│ │ • Tags                     │  │ │ • Wait time             │  │
│ │ • Capacity badge           │  │ │ • Response time         │  │
│ └────────────────────────────┘  │ │ [Select Provider CTA]   │  │
│                                  │ └─────────────────────────┘  │
│ ┌────────────────────────────┐  │                               │
│ │ QUICK SUMMARY              │  │ ┌─────────────────────────┐  │
│ │ • Bullet points            │  │ │ LOCATION                │  │
│ │ • Specializations          │  │ │ • Mini map              │  │
│ │ • Target groups            │  │ │ • Address               │  │
│ │ • Capacity                 │  │ │ • Directions            │  │
│ └────────────────────────────┘  │ └─────────────────────────┘  │
│                                  │                               │
│ ┌────────────────────────────┐  │ ┌─────────────────────────┐  │
│ │ WHY THIS PROVIDER?         │  │ │ CONTACT INFO            │  │
│ │ 🤖 AI Explanation          │  │ │ • Contact person        │  │
│ │ • Strengths                │  │ │ • Phone, email          │  │
│ │ • Trade-offs               │  │ │ • Referral process      │  │
│ │ • Confidence               │  │ └─────────────────────────┘  │
│ └────────────────────────────┘  │                               │
│                                  │ ┌─────────────────────────┐  │
│ [▼ Zorgaanbod]                  │ │ DOCUMENTS               │  │
│ [▼ Doelgroepen]                 │ │ • Brochures             │  │
│ [▼ Werkwijze]                   │ │ • Procedures            │  │
│                                  │ └─────────────────────────┘  │
└──────────────────────────────────┴───────────────────────────────┘
```

---

## 🧱 Components Breakdown

### 1. Provider Header

**Purpose:** Immediate provider identification and status

**Contains:**
```
┌────────────────────────────────────────────────────────┐
│ Provider Name (H1, 3xl, bold)                         │
│ 📍 Region  🏢 Type  ⭐ 4.5                            │
│                                                        │
│ [Jeugdzorg] [Specialistisch] [Trauma]  [BESCHIKBAAR] │
│                                           3/10 plekken │
└────────────────────────────────────────────────────────┘
```

**Elements:**
- **Name**: Large, prominent
- **Metadata**: Location, organization type, rating
- **Tags**: Care types, specializations (purple/blue/green)
- **Capacity Badge**: Visual status (green/amber/red)

**Measurements:**
```
Name: Inter Bold 30px (#3xl)
Metadata: Inter Regular 14px, with 14px icons
Tags: 12px semibold, 8px padding, 4px gap
Capacity Badge: 
  - Padding: 16px horizontal, 8px vertical
  - Border: 2px semantic color
  - Label: 11px uppercase semibold
  - Value: 12px muted
```

---

### 2. Quick Summary

**Component:** `Samenvatting` (AI component)

**Purpose:** Scannable overview in <10 seconds

**Content:**
```
📄 Samenvatting

✓ Gespecialiseerd in [Type]
ℹ️ Doelgroep: Jongeren 12-18 jaar met complexe problematiek
ℹ️ Type zorg: Intensieve ambulante + residentiële
✓ Capaciteit: 3 plekken, wachttijd 3-5 dagen
```

**Rules:**
- Max 4-5 bullet points
- Icons for visual scanning
- No jargon
- Clear, factual statements

---

### 3. Why This Provider? (CRITICAL)

**Component:** `MatchExplanation` (AI component)

**Purpose:** Decision support - explain the match

**Only shows when:** `context === "matching"`

**Structure:**
```
🎯 Waarom deze aanbieder?

📈 Match Score: [94%]
🎯 Hoog vertrouwen

Sterke punten
✓ Sterke ervaring met vergelijkbare casussen (15+ afgelopen jaar)
✓ Perfecte match met gevraagd zorgtype
✓ Capaciteit direct beschikbaar
✓ Snelle intake planning (binnen 5 dagen)
✓ Hoge acceptatiegraad (92%)

Aandachtspunten
⚠️ Afstand tot cliënt is 15km (boven gemiddelde)
⚠️ Groepstherapie heeft wachtlijst van 2-3 weken
```

**Why This Matters:**
- **Transparency:** Users see WHY this provider was recommended
- **Trust:** AI reasoning is explainable
- **Confidence:** High/Medium/Low gives decision confidence
- **Balanced:** Shows both strengths AND trade-offs

---

### 4. Expandable Sections

**Pattern:** Collapsible content blocks

**Sections:**

#### A. Zorgaanbod (Care Offering)
```
[▼ Zorgaanbod]

Type zorg
✓ Intensieve Ambulante Begeleiding (IAB)
✓ Residentiële behandeling (24-uurs zorg)
✓ Gezinsbehandeling
✓ Dagbehandeling

Specialisaties
[Trauma & PTSS] [Hechtingsproblematiek] [Gedragsproblemen]
[Autisme spectrum] [LVB begeleiding]
```

#### B. Doelgroepen (Target Groups)
```
[▼ Doelgroepen]

Leeftijdsgroepen
12 tot 18 jaar (soms tot 21 jaar met indicatie)

Problematiek
• Complexe trauma en hechtingsproblemen
• Ernstige gedragsproblemen
• Combinatie autisme en gedragsproblematiek
• LVB met bijkomende problemen
```

#### C. Werkwijze (Approach)
```
[▼ Werkwijze]

Intake proces
1. Aanmelding en screening (binnen 5 werkdagen)
2. Intake gesprek met gezin en jongere
3. Indicatieoverleg en behandelplan
4. Start behandeling (binnen 2 weken)

Behandelaanpak
Systemische en traumagerichte aanpak:
• Veiligheid en stabiliteit
• Hechting en relaties
• Gedragsregulatie
• Trauma verwerking
```

**Why Collapsible:**
- Reduces cognitive load
- Progressive disclosure
- Users choose what to read
- Default: Zorgaanbod open

---

### 5. Capacity & Availability (Sidebar)

**Component:** Sticky sidebar card

**Purpose:** Always-visible capacity status

**Structure:**
```
┌─────────────────────────────────┐
│ 📅 Beschikbaarheid              │
│                                 │
│ Huidige capaciteit              │
│ 🟢 3 van 10 plekken vrij        │
│                                 │
│ Geschatte wachttijd             │
│ 3-5 dagen                       │
│                                 │
│ Reactietijd op verwijzing       │
│ ⏰ Binnen 4 uur                 │
│                                 │
│ Intake planning                 │
│ Flexibel, ook avonduren         │
│                                 │
│ [Selecteer deze aanbieder]      │
└─────────────────────────────────┘
```

**Sticky Behavior:**
- `position: sticky`
- `top: 96px` (below fixed header)
- Follows user scroll
- Always accessible CTA

**Capacity Status Colors:**
```
Available (>30%):  Green  #22C55E
Limited (1-30%):   Amber  #F59E0B
Full (0%):         Red    #EF4444
```

---

### 6. Location (Sidebar)

**Component:** `ProviderMiniMap`

**Purpose:** Geographic context, not primary map

**Structure:**
```
┌─────────────────────────────────┐
│ 📍 Locatie                      │
│                                 │
│ [Mini Map Visualization]        │
│ [Region Label Overlay]          │
│                                 │
│ Adres                           │
│ Voorbeeldstraat 123             │
│ 1234 AB Amsterdam               │
│                                 │
│ Regio                           │
│ Amsterdam                       │
│                                 │
│ Bereikbaarheid                  │
│ OV: 15 min van station          │
│ Auto: Gratis parkeren           │
└─────────────────────────────────┘
```

**Map Placeholder:**
- 160px height
- Muted gradient background
- Center pin with pulse animation
- Region label overlay

---

### 7. Contact Info (Sidebar)

**Purpose:** Enable direct contact

**Structure:**
```
┌─────────────────────────────────┐
│ Contact & Verwijzing            │
│                                 │
│ Contactpersoon                  │
│ Drs. P. Bakker                  │
│ Coördinator Intake              │
│                                 │
│ 📞 020 - 123 45 67              │
│ ✉️ intake@provider.nl           │
│                                 │
│ ─────────────────               │
│ Verwijzing via                  │
│ Veilig Thuis portaal of email   │
└─────────────────────────────────┘
```

**Interactive Elements:**
- Phone: `tel:` link
- Email: `mailto:` link
- Hover states on links

---

### 8. Documents (Sidebar)

**Purpose:** Additional resources

**Structure:**
```
┌─────────────────────────────────┐
│ Documenten                      │
│                                 │
│ 📄 Zorgaanbod brochure          │
│ 📄 Intake procedure             │
│ 📄 Privacy statement            │
└─────────────────────────────────┘
```

**Interaction:**
- Hover: `bg-muted/30`
- Click: Download or open in new tab
- Icon: FileText 14px, primary color

---

## 🎨 Visual Design

### Typography Scale

```
Page Title (Provider Name):   Inter Bold 30px
Section Headers:              Inter Bold 18px
Subsection Headers:           Inter Semibold 14px
Body Text:                    Inter Regular 14px
Small Text:                   Inter Regular 12px
Tiny Text:                    Inter Regular 11px
```

### Spacing

```
Page Padding:         24px
Card Padding:         24px (large), 20px (standard)
Section Gap:          24px
Card Internal Gap:    16px
List Item Gap:        8px
Icon-Text Gap:        8px
```

### Colors

**Capacity Status:**
```
Available:   #22C55E (Green)
Limited:     #F59E0B (Amber)
Full:        #EF4444 (Red)
```

**Tags:**
```
Primary Tag:      Purple #8B5CF6
Secondary Tag:    Blue   #3B82F6
Tertiary Tag:     Green  #22C55E
```

**Semantic Colors:**
```
Success:    Green  #22C55E
Warning:    Amber  #F59E0B
Error:      Red    #EF4444
Info:       Blue   #3B82F6
Action:     Purple #8B5CF6
```

### Borders & Backgrounds

```
Card Background:     rgba(255,255,255,0.03)
Card Border:         rgba(255,255,255,0.10)
Divider:             rgba(255,255,255,0.10)
Hover Background:    rgba(255,255,255,0.05)
```

---

## 🔗 Context-Aware Behavior

### From Matching Context

**Indicators:**
- Match score badge in top bar
- Case ID displayed
- "Why This Provider?" section visible
- CTA: "Selecteer deze aanbieder"
- Back button: "Terug naar matching"

**Props:**
```tsx
<ProviderProfilePage
  provider={provider}
  context="matching"
  matchScore={94}
  caseId="CASE-2024-001"
  onSelectProvider={handleSelect}
  onBack={handleBack}
/>
```

---

### From Exploration Context

**Indicators:**
- No match score
- No case ID
- "Why This Provider?" section hidden
- CTA: "Bekijk in matching" or "Neem contact op"
- Back button: "Terug naar overzicht"

**Props:**
```tsx
<ProviderProfilePage
  provider={provider}
  context="exploration"
  onBack={handleBack}
/>
```

---

## 🎬 Interactions

### Collapsible Sections

**Default State:**
- "Zorgaanbod" expanded
- Others collapsed

**Interaction:**
- Click header to toggle
- Smooth expand/collapse animation
- Icon rotates: ChevronDown ↔ ChevronUp
- Transition: 200ms ease

**Animation:**
```tsx
{expanded && (
  <div className="overflow-hidden transition-all duration-200">
    {children}
  </div>
)}
```

---

### Hover States

**Provider Header:**
- No hover (static)

**Collapsible Headers:**
- Hover: `bg-muted/20`
- Cursor: pointer
- Transition: 200ms

**Links (Phone, Email, Documents):**
- Hover: `bg-muted/30`
- Text: underline
- Transition: 150ms

**CTA Button:**
- Hover: `bg-primary/90`
- Scale: 0.98 (subtle press effect)

---

## 📱 Responsive Behavior

### Desktop (1920px)

```
Layout: Two columns (2/3 + 1/3)
Sidebar: Sticky
All sections: Expanded by default
```

### Laptop (1440px)

```
Layout: Two columns (2/3 + 1/3)
Sidebar: Sticky
Slightly reduced spacing
```

### Tablet (1024px)

```
Layout: Two columns (60% + 40%)
Sidebar: Sticky
Mobile: Stack vertically
```

### Mobile (375px)

```
Layout: Single column stack
Sidebar sections: Inline after content
Sticky CTA: Bottom fixed bar
Collapsible sections: Start collapsed
```

---

## ♿ Accessibility

### Keyboard Navigation

```
Tab:        Navigate between interactive elements
Enter:      Activate buttons, toggle sections
Space:      Toggle collapsible sections
Esc:        Close any open modals
```

### Screen Reader

**Page Title:**
```
"Provider Profile: [Provider Name]"
```

**Capacity Status:**
```
"Capacity: 3 of 10 spots available. Status: Available"
```

**Collapsible Sections:**
```
"Zorgaanbod section, expanded. Click to collapse"
```

**Links:**
```
"Phone: 020 123 45 67"
"Email: intake@provider.nl"
```

---

## 🎯 Decision Support Logic

### Information Hierarchy

**Priority 1 (Top):**
1. Provider name & basic info
2. Capacity status
3. Quick summary

**Priority 2 (Middle):**
4. Why This Provider (if matching context)
5. Care offering details

**Priority 3 (Sidebar):**
6. Availability & CTA
7. Location
8. Contact info

**Priority 4 (Bottom/Optional):**
9. Documents
10. Additional details

### "Why This Provider?" Logic

**Shows when:**
- `context === "matching"`
- `matchScore` exists
- User needs decision support

**Content:**
- **Strengths:** What makes this provider good
  - Experience with similar cases
  - Specialization match
  - Capacity available
  - Fast intake
  - High acceptance rate

- **Trade-offs:** What to consider
  - Distance concerns
  - Wait times for specific services
  - Limitations or constraints

- **Confidence:** AI's certainty level
  - High (90-100%): Strong recommendation
  - Medium (75-89%): Good option with caveats
  - Low (<75%): Consider carefully

---

## 🚀 Performance

### Optimization Strategies

1. **Lazy Load Sections**
   - Collapsible content loads on expand
   - Map component lazy loaded

2. **Memoization**
   - Provider data memoized
   - Calculations cached

3. **Progressive Enhancement**
   - Critical content first
   - Non-critical deferred

---

## 📊 Success Metrics

### User Understanding

**Target:** User can answer these in <30 seconds:
- What does this provider specialize in?
- Are they available?
- Are they a good fit for my case?

**Measure:** User testing with think-aloud

---

### Decision Confidence

**Target:** >80% of users feel confident in decision

**Measure:**
- Post-decision survey
- Reversal rate (% who change mind)

---

### Time to Decision

**Target:** <3 minutes from page load to selection

**Baseline:** 10-15 minutes manual research

**Improvement:** 70-80% faster

---

## ✅ Implementation Checklist

**Phase 1: Core Structure**
- [ ] Provider header component
- [ ] Quick summary section
- [ ] Two-column layout
- [ ] Responsive breakpoints

**Phase 2: Content Sections**
- [ ] Collapsible section component
- [ ] Zorgaanbod section
- [ ] Doelgroepen section
- [ ] Werkwijze section

**Phase 3: Sidebar**
- [ ] Capacity & availability
- [ ] Mini map component
- [ ] Contact info
- [ ] Documents list
- [ ] Sticky behavior

**Phase 4: Decision Support**
- [ ] "Why This Provider?" section
- [ ] Context-aware rendering
- [ ] Match explanation integration

**Phase 5: Interactions**
- [ ] Collapsible toggle logic
- [ ] Hover states
- [ ] CTA functionality
- [ ] Back navigation

**Phase 6: Polish**
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Animations

**Phase 7: Testing**
- [ ] Desktop responsive
- [ ] Mobile responsive
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] User testing

---

## 📚 Files Reference

```
Implementation:
  /components/care/ProviderProfilePage.tsx
  /components/care/CapacityIndicator.tsx
  /components/care/ProviderMiniMap.tsx

Examples:
  /components/examples/ProviderProfileDemo.tsx

AI Components (reused):
  /components/ai/MatchExplanation.tsx
  /components/ai/Samenvatting.tsx

Documentation:
  /PROVIDER_PROFILE_DOCS.md (this file)
  /PROVIDER_PROFILE_FIGMA_SPEC.md (design specs)
```

---

## 🎓 Usage Example

### From Matching Page

```tsx
import { ProviderProfilePage } from "@/components/care/ProviderProfilePage";

function MatchingFlow() {
  const provider = selectedProvider;
  const matchScore = 94;

  return (
    <ProviderProfilePage
      provider={provider}
      context="matching"
      matchScore={matchScore}
      caseId="CASE-2024-001"
      onSelectProvider={() => {
        // Confirm selection
        confirmMatch(provider.id);
        // Navigate to placement
        router.push(`/placement/${provider.id}`);
      }}
      onBack={() => {
        router.push(`/matching/${caseId}`);
      }}
    />
  );
}
```

### From Providers List

```tsx
function ProvidersExploration() {
  const provider = selectedProvider;

  return (
    <ProviderProfilePage
      provider={provider}
      context="exploration"
      onBack={() => {
        router.push("/providers");
      }}
    />
  );
}
```

---

## 🎨 Design Principles Achieved

✅ **Clarity:** Provider understood in <10 seconds  
✅ **Trust:** Structured, professional, reliable information  
✅ **Decision Support:** "Why This Provider?" answers key question  
✅ **No Overload:** Collapsible sections, progressive disclosure  
✅ **Scannability:** Visual hierarchy, icons, clear labels  

---

**This is a professional provider overview that supports fast, confident decision-making.** ✅
