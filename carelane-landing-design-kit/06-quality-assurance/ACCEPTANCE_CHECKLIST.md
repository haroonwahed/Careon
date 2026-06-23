# Acceptance checklist

## Brand and content

- [ ] Every public reference uses `Carelane`
- [ ] The canonical workflow has exactly five phases
- [ ] No top-level Samenvatting, Beoordeling or Gemeente Validatie phase
- [ ] No invented certifications, customers, testimonials or metrics
- [ ] Matching is described as advisory and explainable
- [ ] Each section has one dominant CTA
- [ ] Copy is primarily Dutch and does not drift into generic SaaS language

## Visual fidelity

- [ ] Deep navy background, not pure black
- [ ] Violet is the primary brand accent
- [ ] Amber is used for pending or constrained states
- [ ] Teal/green is used for confirmed or completed states
- [ ] Red is reserved for blocked or critical states
- [ ] Spacing and hierarchy match the tokens
- [ ] The page does not become a grid of identical cards
- [ ] Hero and bridge/footer preserve the approved visual direction

## Responsive

- [ ] No horizontal overflow at 390 px
- [ ] No horizontal overflow at 768 px
- [ ] Layout remains coherent at 1024 px
- [ ] Content is not excessively stretched at 1440 px
- [ ] Mobile workflow is a readable vertical timeline
- [ ] Product previews remain legible on mobile

## Accessibility

- [ ] One H1 only
- [ ] Heading order is logical
- [ ] Navigation has an accessible name
- [ ] Mobile menu is keyboard operable and focus managed
- [ ] All interactive controls have visible focus
- [ ] Colour is not the only status indicator
- [ ] Text contrast meets WCAG AA
- [ ] Images have meaningful alt text or empty alt when decorative
- [ ] Reduced motion is respected
- [ ] Touch targets are at least 44 by 44 px

## Performance

- [ ] Decorative images use AVIF/WebP where supported
- [ ] Hero media is sized explicitly to prevent layout shift
- [ ] Below-the-fold images are lazy loaded
- [ ] No oversized uncompressed PNG is shipped to production
- [ ] Icons are SVG or component-based
- [ ] No unnecessary animation library is introduced
- [ ] Core Web Vitals are checked on mobile

## Engineering

- [ ] Components are reusable and typed
- [ ] Existing design primitives are reused
- [ ] No unrelated routes or backend behaviour changed
- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Unit/component tests pass
- [ ] Existing end-to-end tests pass
- [ ] New critical navigation and CTA interactions have coverage
