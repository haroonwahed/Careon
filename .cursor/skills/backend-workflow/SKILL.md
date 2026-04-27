---
name: backend-workflow
description: Guides models, views/controllers, permissions, state transitions, and workflow rules for Zorg OS backend flow integrity. Use when editing backend workflow logic, gating, actor authority, or case progression rules.
---

## Activation Rule

This skill activates automatically when the task matches its domain.

Do not apply this skill outside its domain.

# Backend Workflow Skill

Use this skill for models, views/controllers, permissions, state transitions, and workflow rules.

## Canonical flow

Casus -> Samenvatting -> Matching -> Aanbieder Beoordeling -> Plaatsing -> Intake

## Hard rules

- Intake only after provider acceptance and placement.
- Placement only after provider acceptance.
- Matching is recommendation, not final assignment.
- Provider Beoordeling owns substantive accept/reject authority.
- Keep all major actions traceable from the case.

## Schema rules

- prefer additive changes
- preserve historical traceability
- use structured reason codes
- prefer explicit workflow states over vague booleans
