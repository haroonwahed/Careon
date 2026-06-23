# Master implementation prompt

Implement the Carelane public landing page using this kit as the design and product source.

## Operating rules

- First inspect the existing project structure, routes, design tokens and reusable components.
- Do not rewrite unrelated application areas.
- Reuse existing primitives where they already satisfy the visual and accessibility contract.
- Create reusable landing-page components rather than one monolithic file.
- Preserve existing authentication, routing and backend behaviour.
- Do not introduce fake APIs, fake integrations or production claims.
- Do not use generated reference images as the final UI. Rebuild the visual system with HTML, CSS and reusable components.
- Generated images may only be used as visual references or decorative background assets.
- Use the exact brand name `Carelane`.

## Product positioning

Carelane is operational infrastructure for humane care coordination under scarcity. It helps municipalities, providers and coordinators make better decisions, reduce delay, preserve ownership and progress a case through one explainable route.

The page must feel:
- calm;
- premium;
- trustworthy;
- operational;
- restrained;
- human-centred;
- specific to care coordination.

It must not feel:
- like a generic SaaS template;
- like an analytics dashboard sales page;
- overloaded with glass cards;
- dominated by vague AI claims;
- playful, gamified or consumer-social.

## Canonical workflow

Render exactly:

`Aanmelding → Matching → Aanbiederreactie → Plaatsing → Intake`

Matching is advisory and explainable. Manual override is possible only as a controlled and auditable action. The page may explain those principles, but must not imply that the browser or UI is the authority.

## Implementation sequence

1. Inventory the existing landing page and shared components.
2. Map current components to `05-implementation/COMPONENT_MAP.md`.
3. Add tokens without breaking application tokens.
4. Build sections independently.
5. Compose sections in the required order.
6. Implement responsive behaviour.
7. Add reduced-motion handling.
8. Add semantic markup and keyboard states.
9. Replace all placeholder claims with approved copy or clearly labelled demo data.
10. Run the complete checklist in `06-quality-assurance/ACCEPTANCE_CHECKLIST.md`.

## Deliverables

- Production-quality responsive landing page.
- Reusable section and primitive components.
- No horizontal overflow at 390, 768, 1024 and 1440 px.
- Lighthouse-friendly image loading.
- Correct heading hierarchy.
- One dominant CTA per section.
- No invented metrics or testimonials.
- A short implementation report listing files changed and tests run.
