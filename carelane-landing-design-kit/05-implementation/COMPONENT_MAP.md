# Suggested component map

Names may be adapted to the existing codebase, but responsibilities must remain separate.

```text
LandingPage
├── LandingNavigation
├── HeroSection
│   ├── HeroCopy
│   ├── TrustStrip
│   └── RegiekamerPreview
├── CareJourneySection
│   ├── JourneyRoute
│   └── JourneyPhase
├── RegiekamerSection
│   ├── AttentionList
│   ├── LeadTimeChart
│   └── NextBestAction
├── CareNetworkSection
│   ├── CaseCore
│   └── OrganisationNode
├── ExplainableMatchingSection
│   ├── ProviderMatchCard
│   └── MatchReasonPanel
├── TrustByDesignSection
│   └── TrustPillar
├── ResultsSection
│   ├── OutcomeMetric
│   └── EvidencePanel
├── AudienceSection
│   └── AudienceRole
├── FinalCtaSection
└── LandingFooter
```

## Reuse rules

Reuse existing Carelane primitives if present:
- page container;
- button;
- badge;
- card;
- section heading;
- status indicator;
- tooltip;
- accessible dialog or mobile navigation drawer.

Do not create a second button system or an isolated colour palette for the landing page.

## Data boundary

Static marketing copy may live in a typed content object or CMS layer. Product previews may use stable demo data, but must be visually and semantically marked as demonstration content where needed.

## Image usage

- Use SVG for icons and route diagrams where possible.
- Use WebP or AVIF for photographic backgrounds.
- The bridge image should be responsive, cropped with `object-fit: cover`, and protected by a gradient overlay for text contrast.
- Do not render text inside raster images as live page content.
