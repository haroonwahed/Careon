# Pilot walkthrough checklist

Use this checklist for a live demo or internal pilot rehearsal after the current accessibility and design-guardrail pass.

## Baseline

- Design guardrail: PASS
- Axe smoke suite: PASS
- Focused care tests: PASS
- Golden-path E2E: PASS
- P0/P1 findings: 0
- Workflow/API/permission changes: none in this pass

## Before the walkthrough

- [ ] Confirm the rehearsal environment is running with `config.settings_rehearsal`.
- [ ] Confirm the correct pilot accounts are available for gemeente and zorgaanbieder roles.
- [ ] Confirm the browser is on the rehearsal base URL and the SPA loads without console errors.
- [ ] Confirm the current canonical flow is still visible in the product:
  - Casus
  - Samenvatting
  - Matching
  - Gemeente validatie
  - Aanbieder beoordeling
  - Plaatsing
  - Intake

## Walkthrough check

### 1. Nieuwe casus

- [ ] Start the intake flow from the main shell.
- [ ] Confirm the labels are understandable without extra explanation.
- [ ] Confirm the source / casus / reference model is visible and clear.
- [ ] Confirm the submit / navigation path still works.
- [ ] Confirm there are no runtime errors in the browser console.

### 2. Casussen / workflow

- [ ] Confirm the list renders.
- [ ] Confirm rows are keyboard reachable.
- [ ] Confirm the row open action works.
- [ ] Confirm the primary CTA is separate from row open.

### 3. Regiekamer

- [ ] Confirm the work items render.
- [ ] Confirm the work item open action works.
- [ ] Confirm the dominant action is clearly visible.
- [ ] Confirm there is no reliance on old clickable-shell behavior.

### 4. Matching

- [ ] Confirm filters and selects work.
- [ ] Confirm custom select triggers have accessible names.
- [ ] Confirm matching actions still render correctly.

### 5. Aanbieder beoordeling

- [ ] Confirm the provider review flow renders.
- [ ] Confirm decision and action buttons remain reachable.

### 6. Plaatsingen

- [ ] Confirm placement tracking renders.
- [ ] Confirm validation and status surfaces are readable.

### 7. Acties

- [ ] Confirm filters and selects work.
- [ ] Confirm the action list remains keyboard usable.

## During the walkthrough

- [ ] Pause on the first blocker or confusion point.
- [ ] Ask the tester what they think the next best action is.
- [ ] Confirm the displayed owner matches the real actor.
- [ ] Confirm the state shown on screen matches the canonical flow.
- [ ] Do not explain around unclear labels unless the tester asks.

## After the walkthrough

- [ ] Note the screen, role, and exact wording that caused friction.
- [ ] Record whether the issue is:
  - blocking
  - hindering
  - cosmetic
- [ ] Capture any mismatch between what the user expected and what the UI did.
- [ ] Keep notes short and role-specific.

