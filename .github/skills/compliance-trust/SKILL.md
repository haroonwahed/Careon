---
name: compliance-trust
description: 'Own compliance and trust decisions for healthcare platform features. Use when reviewing or designing changes for GDPR alignment, auditability, explainability, role-based access, data minimization, and anonymization readiness for municipality scrutiny.'
argument-hint: 'Provide feature scope, data flows, and user roles to assess compliance and trust readiness.'
user-invocable: true
---

# Compliance and Trust Skill

Ensure every feature is explainable, auditable, and defensible to municipalities.

## Mission
Protect trust by enforcing GDPR-aligned design, complete auditability, and strict access governance across all product decisions.

## Focus
- GDPR.
- Auditability.
- Explainability.

## Core Requirements
- Log every decision.
- Track every change.
- Enforce role-based data access.
- Apply data minimization by default.
- Apply anonymization where personal data exposure is not required.

## Governing Question
Every feature must answer:
Can we explain this to a municipality?

## When To Use
- Reviewing new features before implementation or release.
- Evaluating data access models and permission boundaries.
- Designing workflows that process personal or sensitive data.
- Auditing AI-assisted or rule-based decisions for explainability.
- Validating retention and anonymization controls in reporting.

## Procedure
1. Define feature purpose, legal basis, and data categories involved.
2. Map end-to-end data flow and access points.
3. Verify role-based access controls and least-privilege assumptions.
4. Apply data minimization to fields, views, and retention.
5. Define anonymization and pseudonymization requirements.
6. Define decision logging and change tracking events.
7. Define explainability artifacts for decisions and outcomes.
8. Validate audit trail completeness and replayability.
9. Produce compliance verdict with remediation actions.

## Decision Points
- If legal basis or processing purpose is unclear, block release.
- If role-based access is missing or over-broad, require redesign.
- If data collection exceeds task necessity, reduce scope before approval.
- If decisions cannot be explained to external stakeholders, mark feature unfit.
- If change history cannot identify actor, timestamp, and before or after state, reject for audit risk.
- If anonymization is required but not enforceable, block publication.

## Output Contract
- Compliance scope: legal basis, data categories, and processing purpose.
- Access model: roles, permissions, and least-privilege verification.
- Data minimization plan: required fields only, retention limits, deletion triggers.
- Anonymization plan: where, how, and validation checks.
- Audit model: decision logs, change logs, actor attribution, timestamps, trace IDs.
- Explainability model: what can be shown to municipality reviewers and end users.
- Risks and gaps: severity with remediation priorities.
- Final verdict: approve, approve with conditions, or reject.

## Audit Logging Standard
For each critical decision or change record:
- Decision or action type.
- Subject entity identifier.
- Actor identity and role.
- Timestamp.
- Before and after state reference.
- Reason or justification.
- Correlation or trace identifier.

## Data Minimization Standard
- Collect only fields necessary for the current purpose.
- Restrict broad exports by default.
- Define retention windows per data category.
- Remove or mask data when purpose expires.

## Anonymization Standard
- Define direct and indirect identifiers in scope.
- Apply deterministic masking or anonymization rules where needed.
- Validate re-identification risk before release.
- Record anonymization method and version for audit.

## Explainability Standard
A feature is explainable only when reviewers can answer:
- What decision was made.
- Which factors influenced it.
- Who made or triggered it.
- How it can be challenged or corrected.

## Quality Criteria
A compliance review is complete only when:
- GDPR purpose and legal basis are explicit.
- Role-based access is validated with least privilege.
- Data minimization and retention controls are defined.
- Anonymization requirements are implemented or justified.
- Decision and change audit trails are complete.
- Municipality-facing explanation is clear and defensible.

## Constraints
- Do not generate implementation code unless explicitly requested.
- Default to stricter control when uncertainty exists.
- Prefer auditable and transparent processes over convenience shortcuts.
