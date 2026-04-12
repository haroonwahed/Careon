---
name: matching-engine
description: 'Own matching engine decisions for a healthcare allocation platform. Use when designing or reviewing scoring logic, candidate ranking, and explainable provider recommendations that optimize outcome probability while reporting transparent trade-offs.'
argument-hint: 'Provide case details, candidate providers, and constraints to score and rank.'
user-invocable: true
---

# Matching Engine Skill

Design and evaluate provider matching as a decision system, not a simple filter.

## Goal
Match each client to the best possible provider based on expected outcome probability.

## Core Rules
- Prioritize expected outcome over pure availability.
- Always consider region, urgency, complexity, specialization, and historical success.
- Avoid black-box decisions by making score drivers explicit.
- Return top 3 matches with reasoning and trade-offs.

## When To Use
- Designing new matching logic or revising score models.
- Reviewing allocation decisions for fairness, quality, and explainability.
- Evaluating provider candidate sets for a case.
- Auditing why a recommended match was selected.
- Comparing matching strategies before release.

## Input Expectations
- Case profile: needs, urgency, complexity, region, constraints.
- Candidate providers with structured attributes.
- Historical outcomes or proxy success metrics.
- Operational constraints and policy limits.

## Procedure
1. Translate the case into normalized decision features.
2. Validate candidate provider data quality and coverage.
3. Build a weighted scoring model centered on expected outcomes.
4. Apply constraint checks for hard exclusions.
5. Compute candidate scores and confidence indicators.
6. Rank providers and select top 3.
7. Generate human-readable reasoning for each recommendation.
8. Document trade-offs between outcome quality, speed, and feasibility.
9. Return decision summary with assumptions and uncertainty.

## Decision Points
- If required factors are missing, mark recommendation provisional and identify data gaps.
- If region or specialization is incompatible, apply hard exclusion unless explicit override policy exists.
- If urgency conflicts with highest-outcome option, compare expected delay impact and surface trade-off.
- If historical success data is sparse or biased, reduce confidence and explain limitation.
- If two providers score similarly, prefer the option with stronger evidence quality and lower operational risk.

## Scoring Design Requirements
- Use transparent component scoring with explicit weights.
- Separate hard constraints from soft scoring factors.
- Include a confidence signal tied to data completeness and evidence quality.
- Support recalibration with observed outcomes.

## Required Output Format
For each of top 3 providers include:
- Score.
- Reasoning: strongest fit factors and key risks.
- Trade-offs: what is gained and what is compromised.

Also include:
- Why non-selected high-potential options were ranked lower.
- Confidence level and data limitations.
- Recommended next action if no candidate meets minimum quality bar.

## Explainability Standard
A recommendation is valid only if a care coordinator can answer:
- Why this provider is first.
- Which factors most influenced ranking.
- Which uncertainty could change the decision.
- What fallback is available if the top choice fails.

## Quality Criteria
A matching decision is complete only when:
- Outcome-first weighting is explicit.
- Region, urgency, complexity, specialization, and historical success are evaluated.
- Top 3 matches are returned with score, reasoning, and trade-offs.
- Black-box behavior is avoided through transparent factor reporting.
- Assumptions, confidence, and limitations are documented.

## Constraints
- Do not generate implementation code unless explicitly requested.
- Think in decision-system terms, not checklist filters.
- Prefer auditable and recalibratable logic over opaque heuristics.
