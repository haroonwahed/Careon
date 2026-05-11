# CareOn Design Constitution v1.3

**Status:** canonical (supersedes ad-hoc visual experiments).  
**Product frame:** neutral orchestration for **anonymous youth-care matching** and **throughflow under capacity scarcity** — not municipal ERP, not a permanent dossier system.

---

## 1. Experience intent

The product must feel:

- **Operational** — dispatch-like clarity, not administration theatre.
- **Calm & premium** — restrained typography, breathing room where decisions happen, no surveillance aesthetic.
- **Low-friction** — one dominant action per surface; secondary actions stay visually subordinate.
- **Temporary** — this is coordination infrastructure until placement + financial validation; the trajectory **exits** the platform.

It must **not** feel:

- Enterprise workflow overload, nested governance dashboards, or “optimize the dossier” gamification.
- ECD replacement, municipal ERP, or long-term case home.

---

## 2. Visual & density rules

- **Metric / signal strips** stay compact (operational telemetry, not vanity KPIs).
- **Worklists remain rows**, not card stacks — scanability over decoration.
- **Process timelines** stay compact and legible; no ornamental connectors.
- **Next-best-action** is the primary focal band; avoid competing hero CTAs.
- Use **design tokens** (no ad-hoc hex spacing). Extend tokens instead of inlining magic numbers.

---

## 3. Interaction rules

- **One dominant action** per page region (Regiekamer attention panel, case execution header, critical dialogs).
- Prefer **next step + owner + reason** over raw state dumps.
- Reduce **multi-step bureaucracy** where backend already gates correctness; collect only what decisions require.
- **Uncertainty is visible** — especially for arrangement/tariff hints: confidence + human judgment, never implied guarantees.

---

## 4. Language & tone (Dutch-first)

**Prefer**

- Zoek passende plek / zorgcapaciteit  
- Reacties ontvangen  
- Match voorgesteld  
- Financiële validatie vereist  
- Plaatsing bevestigd  
- Traject afgerond / uitstroom naar keten  

**Avoid**

- Governance cockpit, lifecycle management, dossier-optimalisatie, analyseer volledige keten (unless audit-internal).  
- Positioning the platform as permanent record-of-truth for care delivery.

---

## 5. Role-aware surfaces

- **Aanmelder** (initiator: wijkteam, jeugdbescherming, aanbieder, crisisdienst, …) — initiation, search, review responses, placement progression **where permitted**.
- **Zorgaanbieder** — capacity signals, lightweight accept/reject/info flows.
- **Gemeente** — financing & arrangement compatibility validation; **no** provider-level decisions.
- **Platform** — anonymization support, orchestration, matching assistance, auditability.

UI copy defaults to **Aanmelder** as operational protagonist; **Gemeente** appears where financing/validation gates apply.

---

## 6. Regiekamer → Operationele coördinatie

The former “heavy governance cockpit” is reframed as an **operational coordination workspace**:

- Active requests / open matching flows  
- Provider responses & SLAs  
- Pending gemeentelijke validatie  
- Waiting actions & blockers  

Signals answer: **what**, **impact**, **owner**, **next safe step** — not scoreboards.

---

## 7. Accessibility & trust

- WCAG-minded contrast for operational text; do not rely on colour alone for severity.
- Never present AI arrangement hints as **definitive** financial truth — pair with uncertainty and audit context when shipped.

---

## 8. Change control

Any deviation from this constitution in UI work must be:

1. Justified against **product boundaries** (`Zorg_OS_Product_System_Core_v1_3.md`).  
2. Reflected in **technical foundation** if workflow or API contracts shift (`Zorg_OS_Technical_Foundation_v1_3.md`).
