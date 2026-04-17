You are a senior product designer specialized in geospatial UX, decision systems, and enterprise SaaS.

Your task is to design the “Matching” page for the Careon Zorgregie platform, enhanced with a map-based provider selection experience.

-----------------------------------
CONTEXT
-----------------------------------

The Matching page is where a municipality or care coordinator selects a care provider for a casus.

The system already provides:
- top 3 recommended providers
- reasoning behind matches
- urgency and constraints

We now want to integrate a map to support spatial decision-making:
- distance awareness
- regional availability
- alternative options outside default radius

This is NOT a map-first interface.
This is a decision interface with map support.

-----------------------------------
GOAL
-----------------------------------

Design a page that:

- keeps provider decision-making primary
- adds map as supporting context
- allows users to understand distance and geography
- enables fast and confident placement decisions

The interface should feel like:
- a decision engine
- a control system
- a calm, structured workspace

-----------------------------------
LAYOUT STRUCTURE
-----------------------------------

Use a split-screen layout:

LEFT (60%) → Decision area  
RIGHT (40%) → Map

Maintain strong visual hierarchy:
- Left side is dominant
- Map supports, does not overpower

-----------------------------------

LEFT SIDE — DECISION AREA

1. TOP DECISION HEADER

Include:
- Casus title
- Status: “Klaar voor matching”
- Urgency indicator

AI block:

“Aanbevolen: Plaats bij [Provider]”

Waarom:
- Beschikbaarheid binnen X dagen
- Sterke match met zorgtype
- Hoge acceptatiegraad

Confidence indicator (hoog / middel / laag)

Primary CTA:
[Plaats direct]

-----------------------------------

2. AI INSIGHT STRIP (below header)

Example:

“Geen geschikte aanbieder binnen 10km  
→ 2 geschikte opties binnen 25km”

Include:
[Pas radius aan]

-----------------------------------

3. PROVIDER LIST (TOP 3 MATCHES)

Each provider is a decision card.

Include:

HEADER:
- Provider name
- Label:
  - 🟢 Beste match
  - 🟡 Alternatief
  - 🔴 Risicovol

CORE INFO:
- Match score
- Beschikbaarheid
- Afstand (km)

AI EXPLANATION:
- Sterktes (bullet points)
- Trade-offs (bullet points)

CTA:
- [Plaats direct]
- [Bekijk details]

-----------------------------------

INTERACTION (CRITICAL)

- Clicking a provider card:
  → highlights corresponding map pin
  → centers map on provider

- Hovering a provider:
  → highlights pin subtly

-----------------------------------

RIGHT SIDE — MAP

1. MAP DESIGN

- Dark theme, slightly desaturated
- Minimal visual noise
- No unnecessary labels

-----------------------------------

2. MAP PINS

Color-coded:

- Green → best match
- Amber → alternative
- Red → risky
- Purple outline → selected

Selected provider:
- larger pin
- subtle glow

-----------------------------------

3. CLIENT LOCATION

- Show origin point (client)
- Draw radius circle (default: 20km)

-----------------------------------

4. MAP INTERACTIONS

- Click pin:
  → shows mini provider preview
  → syncs with provider card

- Hover pin:
  → highlights corresponding card

-----------------------------------

5. MAP CONTROLS

Position: top-right of map

Include:

- Radius selector:
  - 10km / 20km / 50km

- Filter toggle:
  - Zorgtype
  - Beschikbaarheid

- Reset view button

-----------------------------------

6. EMPTY STATE (MAP + LIST)

If no providers found:

“Geen aanbieders gevonden binnen geselecteerde regio”

Suggestions:
- Vergroot radius
- Pas filters aan

-----------------------------------

AI INTEGRATION RULES
-----------------------------------

AI must:

- always explain recommendations
- never replace user decision
- always include “waarom”

AI components used:

- Aanbevolen actie block (top)
- Insight strip (context)
- Match explanation (inside cards)

-----------------------------------

VISUAL DESIGN RULES
-----------------------------------

- Keep existing Careon dark theme
- Purple = actions
- Red/Amber/Green = status meaning only
- Avoid visual clutter
- Maintain spacing consistency

Map must feel:
- supportive
- calm
- secondary to decision area

-----------------------------------

MICRO INTERACTIONS
-----------------------------------

- Smooth transitions between card ↔ map
- Animated pin focus
- Subtle hover states
- No flashy animations

-----------------------------------

COMPONENTS TO DESIGN
-----------------------------------

- Provider decision card (map-enabled)
- Map container
- Map pin variants
- Radius control
- AI recommendation block
- AI insight strip

-----------------------------------

TONE & FEELING
-----------------------------------

The interface should feel like:

- a professional decision system
- structured and calm
- intelligent but not overwhelming

NOT:
- a map-first product
- a search interface
- a cluttered UI

-----------------------------------

OUTPUT
-----------------------------------

Create:

- Full Matching page with map integration
- Synced interactions between list and map
- Clean component system
- Responsive layout

Ensure:

- clear decision hierarchy
- seamless interaction between map and list
- strong usability
- consistency with the rest of the Careon platform

-----------------------------------