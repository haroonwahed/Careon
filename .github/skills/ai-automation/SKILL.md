---
name: ai-automation
description: 'Own AI integration decisions for a healthcare platform. Use when evaluating or designing AI features to ensure value-first usage, explainability, reproducibility, fallback logic, and human-centered decision support.'
argument-hint: 'Provide use case, workflow step, and constraints to assess or design AI integration.'
user-invocable: true
---

# AI and Automation Skill

Use AI only where it adds measurable decision support value.

## Mission
Integrate AI into healthcare workflows in a controlled, auditable way that supports human decisions without replacing accountability.

## Allowed Use Cases
- Intake summarization.
- Case classification.
- Match explanation.
- Document anonymization.

## Avoid
- Unnecessary AI usage where deterministic logic is sufficient.
- Black-box decisions without transparent rationale.
- AI-driven actions without fallback paths.

## Core Principles
- AI must support decisions, not replace them.
- Explainability is mandatory for user-facing AI outputs.
- Reproducibility is mandatory for operational AI usage.
- Human override and fallback logic must be present.
- Risk and uncertainty must be explicit.

## When To Use
- Assessing whether a feature should use AI at all.
- Designing AI-assisted workflow steps for care operations.
- Reviewing prompt or model integration for transparency and reliability.
- Defining fallback behavior for model failures or low-confidence output.
- Auditing AI features before production rollout.

## Procedure
1. Define workflow problem and expected business value.
2. Validate if AI is necessary versus deterministic alternatives.
3. Map the use case to approved AI categories.
4. Define input and output contracts, including confidence semantics.
5. Specify explainability requirements for users and operators.
6. Specify reproducibility controls: versioning, prompts, parameters, and context.
7. Design fallback logic for low confidence, errors, and outages.
8. Define human-in-the-loop checkpoints and override paths.
9. Define monitoring, audit logging, and acceptance gates.

## Decision Points
- If a proposal is outside approved use cases, reject unless governance expands scope.
- If deterministic logic can solve the problem with similar quality, prefer deterministic.
- If output is not explainable to end users, block release.
- If output cannot be reproduced with recorded inputs and versions, block release.
- If fallback and override behavior is missing, mark integration unsafe.
- If AI output is used as final autonomous decision in high-stakes steps, reject.

## Output Contract
- Use-case fit: approved category and why AI is justified.
- Value hypothesis: expected benefit versus non-AI baseline.
- Explainability plan: what users will see and how reasoning is communicated.
- Reproducibility plan: model version, prompt version, parameters, and context capture.
- Fallback plan: deterministic alternative, manual process, and failure routing.
- Human oversight plan: review points and override authority.
- Risk notes: uncertainty, misuse, bias, and mitigation.
- Go or no-go recommendation with required safeguards.

## Explainability Standard
Every AI-assisted output must answer:
- What was produced.
- Why it was produced.
- How confident the system is.
- What user action is recommended next.

## Reproducibility Standard
For each AI decision record:
- Store model identifier and version.
- Store prompt template version.
- Store inference parameters.
- Store input snapshot or secure reference.
- Store output and confidence.
- Store timestamp and actor or system initiator.

## Fallback Standard
Define behavior for:
- Low-confidence outputs.
- Validation failures.
- Model timeouts or outages.
- Policy-violating or unsafe responses.
Fallback must route to deterministic logic or manual review.

## Quality Criteria
An AI integration is complete only when:
- It belongs to an approved use case.
- It demonstrates clear value over non-AI alternatives.
- Explainability is implemented for intended users.
- Reproducibility is operationally guaranteed.
- Fallback and human override paths are tested.
- Monitoring and audit logging are defined.

## Constraints
- Do not generate code unless explicitly requested.
- Prefer narrow, high-value AI scope over broad generic automation.
- Do not permit opaque autonomous decisions in critical care workflows.
