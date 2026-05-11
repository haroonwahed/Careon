# Zorg OS — Product & System Core v1.3

## 1. One-sentence definition

**CareOn / Zorg OS is a neutral orchestration layer for anonymous youth-care matching and throughflow coordination under capacity scarcity.**

It is **not**:

- An ECD, municipal ERP, financial administration suite, or permanent dossier platform.

It **is**:

- Matching & capacity routing infrastructure  
- Placement acceleration and handoff coordination  
- A **temporary** operational layer until validated placement + financing alignment, then **uitstroom** to external systems of record  

---

## 2. Primary actor: Aanmelder

The **Aanmelder** initiates a search / throughflow request. Typical sources:

- Wijkteam  
- Jeugdbescherming  
- Zorgaanbieder (doorverwijzing)  
- Crisisdienst  
- (Later) ouders / verzorgers where policy allows  

**Product implication:** navigation, empty states, onboarding and NBA copy should read as **aanmelder-first**; gemeente appears at **financiële / arrangementele validatie**, not as the omnipresent “owner of everything”.

---

## 3. Core roles (conceptual)

| Role | Responsibility |
|------|----------------|
| **Aanmelder** | Anonymous or pseudonymous request, capacity search, review provider responses, drive voorkeursmatch / placement steps within policy. |
| **Zorgaanbieder** | Expose / honour capacity, review requests, accept/reject, lightweight responses. |
| **Gemeente** | Validate financing & arrangement compatibility, stimulate chain participation, **no** provider accept/reject on behalf of providers. |
| **Platform** | Anonymization support, orchestration, matching assistance, arrangement intelligence **hints**, immutable audit trail. |

---

## 4. Canonical product flow (v1.3)

**Aanmelding → Anonimisatie → Zorgvraag → Matching → Aanbieder reacties → Voorkeursmatch → Gemeentelijke validatie → Plaatsing → Uitstroom**

Qualities: **temporary**, **fast-moving**, **operational** — not dossier-heavy.

**Exit principle:** after successful placement + financial validation, the trajectory **leaves** the platform; ownership continues in external systems. UX must not imply infinite in-platform monitoring as the default end state.

---

## 5. Matching & gemeente gate

- Matching remains **advisory** — no silent auto-assignment.  
- **Gemeentelijke validatie** is a mandatory compatibility / financing gate — not a substitute for provider judgment.  
- Confidence, factor breakdown, and **uncertainty** stay visible for humans.

---

## 6. Arrangement intelligence (product contract)

**Goal:** municipalities use different arrangement names, codes, tariffs, and care vocabulary. The platform proposes **semantic equivalence suggestions**, **tariff alignment estimates**, and **explicit uncertainty** — to support **human** judgment.

**Non-goals:**

- Guaranteed financial correctness  
- Autonomous final budget approval  

Positioning: **AI-assisted arrangement alignment**, not automated financial processing.

*(Technical contracts: see `Zorg_OS_Technical_Foundation_v1_3.md` and `client/src/lib/arrangementAlignmentContract.ts`.)*

---

## 7. Regiekamer repositioning

**From:** heavy governance cockpit.  
**To:** **Operationele coördinatie** — active requests, open matching, provider responses, pending validations, waiting actions.

Reduce KPI theatre; increase **actionability** and **scanability**.

---

## 8. Provider experience principles

- Save time — minimal duplicate data entry.  
- Clear opportunities — explain why a request matters and by when.  
- Lightweight responses — structured reasons without essay fields unless necessary.

---

## 9. Boundaries checklist (ship / no-ship)

**Ship when** the surface advances: placement speed, capacity clarity, safe validation, auditability.  
**Do not ship** passive “insight dashboards” without an operational owner and next step.

---

## 10. Document hierarchy

1. `CareOn_Business_OS_v1_3.md` — value & positioning.  
2. This file — product system & boundaries.  
3. `Zorg_OS_Technical_Foundation_v1_3.md` — implementation mapping & API discipline.  
4. `CareOn_Design_Constitution_v1_3.md` — UX/visual law.
