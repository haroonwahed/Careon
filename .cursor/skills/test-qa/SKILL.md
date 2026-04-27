---
name: test-qa
description: Guides tests, smoke checks, regression coverage, and release verification for workflow-safe changes. Use when validating canonical flow behavior across case, matching, provider review, placement, intake, and Regiekamer signals.
---

## Activation Rule

This skill activates automatically when the task matches its domain.

Do not apply this skill outside its domain.

# Test & QA Skill

Use this skill for tests, smoke checks, regression coverage, and release verification.

## For workflow-sensitive changes, test:

- case creation
- summary missing/available
- matching generation and explanation
- provider acceptance
- provider rejection with reason
- placement blocked before acceptance
- intake blocked before placement
- Regiekamer signal creation/resolution where relevant

## Prefer:

- business-rule tests over snapshot-only tests
- targeted tests before broad suites
- smoke tests for touched routes
- explicit regression checks for canonical flow
