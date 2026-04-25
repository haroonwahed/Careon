# Regiekamer Design System

## Color Palette

### Semantic Colors

#### Urgency & Status
```
🔴 Critical / Urgent / Blocked
├─ Background: bg-red-500/10
├─ Border: border-red-500/30
├─ Text: text-red-500
└─ Action: bg-red-500 hover:bg-red-600

🟠 Warning / Delay
├─ Background: bg-amber-500/10
├─ Border: border-amber-500/30
├─ Text: text-amber-500
└─ Action: bg-amber-500 hover:bg-amber-600

🟢 Healthy / Completed / Positive
├─ Background: bg-green-500/10
├─ Border: border-green-500/30
├─ Text: text-green-500
└─ Action: bg-green-500 hover:bg-green-600

🔵 Info / Normal
├─ Background: bg-blue-500/10
├─ Border: border-blue-500/30
├─ Text: text-blue-500
└─ Action: bg-blue-500 hover:bg-blue-600

🟣 Primary / Actions (Purple - Brand)
├─ Background: bg-primary/10
├─ Border: border-primary/30
├─ Text: text-primary
└─ Action: bg-primary hover:bg-primary/90
```

#### Neutrals
```
Background: bg-background
Surface: bg-card
Border: border-border
Text Primary: text-foreground
Text Secondary: text-muted-foreground
```

## Typography Hierarchy

### Page Titles
```tsx
<h1 className="text-3xl font-semibold text-foreground mb-2">
  Regiekamer
</h1>
```

### Section Titles
```tsx
<h2 className="text-xl font-semibold">
  Actieve casussen
</h2>
```

### Subsection Titles
```tsx
<h3 className="text-lg font-semibold mb-3">
  Signalen
</h3>
```

### Card Titles
```tsx
<h4 className="font-semibold mb-4 flex items-center gap-2">
  <Icon size={18} className="text-primary" />
  Cliënt informatie
</h4>
```

### Labels
```tsx
<label className="text-sm font-medium mb-2 block">
  Beoordelaar
</label>
```

### Body Text
```tsx
<p className="text-muted-foreground">
  Regular body text
</p>
```

### Small Text
```tsx
<span className="text-xs text-muted-foreground">
  Metadata, timestamps, helper text
</span>
```

## Components

### Premium Card
The foundation for all major content areas.

```tsx
<div className="premium-card p-6">
  {/* Content */}
</div>
```

**Sizes:**
- `p-3` - Compact (lists, small cards)
- `p-4` - Standard (forms, info panels)
- `p-5` - Comfortable (main content)
- `p-6` - Spacious (hero sections, important content)

### Badges

#### Status Badge
```tsx
<CaseStatusBadge status="aanbieder beoordeling" />
// Variants: intake, aanbieder beoordeling, matching, placement, active, completed, blocked
```

#### Urgency Badge
```tsx
<UrgencyBadge urgency="critical" />
// Variants: critical, high, medium, low
```

#### Risk Badge
```tsx
<RiskBadge risk="high" />
// Variants: high, medium, low, none
```

### KPI Card
```tsx
<CareKPICard
  title="Casussen zonder match"
  value={8}
  icon={Users}
  urgency="critical" // or "warning" | "normal" | "positive"
/>
```

**Urgency States:**
- `critical` - Red background, high priority
- `warning` - Amber background, needs attention
- `normal` - Neutral, standard state
- `positive` - Green background, good state

### Buttons

#### Primary Action
```tsx
<Button className="bg-primary hover:bg-primary/90">
  Start matching
</Button>
```

#### Urgent Action
```tsx
<Button className="bg-red-500 hover:bg-red-600">
  Escaleer case
</Button>
```

#### Warning Action
```tsx
<Button className="bg-amber-500 hover:bg-amber-600">
  <AlertTriangle size={16} className="mr-2" />
  Plaats met risico
</Button>
```

#### Positive Action
```tsx
<Button className="bg-green-500 hover:bg-green-600">
  <CheckCircle2 size={16} className="mr-2" />
  Plaats direct
</Button>
```

#### Ghost/Secondary
```tsx
<Button variant="outline">
  Annuleer
</Button>

<Button variant="ghost">
  Meer details
</Button>
```

### Alert Banners

#### Critical Alert
```tsx
<div className="p-4 rounded-lg border-l-4 bg-red-500/10 border-red-500">
  <div className="flex items-start gap-3">
    <AlertCircle className="text-red-500" size={20} />
    <div className="flex-1">
      <p className="font-medium mb-1">Title</p>
      <p className="text-sm text-muted-foreground">Description</p>
    </div>
    <Button className="bg-red-500 hover:bg-red-600">
      Action
    </Button>
  </div>
</div>
```

#### Warning Alert
```tsx
<div className="p-4 rounded-lg border-l-4 bg-amber-500/10 border-amber-500">
  {/* Same structure, amber colors */}
</div>
```

#### Action Alert
```tsx
<div className="p-4 rounded-lg border-l-4 bg-primary/10 border-primary">
  {/* Same structure, primary colors */}
</div>
```

#### Success Alert
```tsx
<div className="p-4 rounded-lg border-l-4 bg-green-500/10 border-green-500">
  {/* Same structure, green colors */}
</div>
```

### Risk Alert
```tsx
<div className="p-3 rounded-lg border bg-red-500/10 border-red-500/30">
  <div className="flex items-start gap-2">
    <AlertCircle size={16} className="mt-0.5 text-red-500" />
    <div className="flex-1">
      <p className="font-medium text-sm">Risk Title</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Risk description
      </p>
    </div>
  </div>
</div>
```

### Suggestion Card
```tsx
<div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
  <div className="flex items-start justify-between mb-2">
    <p className="font-medium text-sm">Suggestion Title</p>
    <span className="text-xs text-primary font-semibold">87%</span>
  </div>
  <p className="text-xs text-muted-foreground">
    Suggestion description
  </p>
</div>
```

### Timeline Event
```tsx
<div className="flex gap-3">
  <div className="flex flex-col items-center">
    <div className="w-3 h-3 rounded-full bg-green-500" />
    <div className="w-px h-full bg-border" />
  </div>
  <div className="flex-1 pb-4">
    <div className="text-xs text-muted-foreground mb-1">16 april 2026</div>
    <div className="font-medium text-sm">Event title</div>
    <div className="text-xs text-muted-foreground">Event description</div>
  </div>
</div>
```

**Dot Colors:**
- `bg-green-500` - Completed
- `bg-amber-500` - Warning/Delayed
- `bg-muted` - Pending/Future

## Layout Patterns

### Dashboard Grid (KPIs)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
  {/* KPI Cards */}
</div>
```

### Two-Column Layout
```tsx
<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
  <div className="xl:col-span-2">
    {/* Main content */}
  </div>
  <div>
    {/* Sidebar */}
  </div>
</div>
```

### Three-Column Layout (Case Detail)
```tsx
<div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
  <div className="xl:col-span-1">
    {/* Left: Information */}
  </div>
  <div className="xl:col-span-1">
    {/* Center: Work Area */}
  </div>
  <div className="xl:col-span-1">
    {/* Right: Intelligence */}
  </div>
</div>
```

### Sticky Action Bar
```tsx
<div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm z-50 ml-[240px]">
  <div className="max-w-[1400px] mx-auto px-6 py-4">
    <div className="flex items-center justify-between">
      <div>{/* Left info */}</div>
      <div className="flex items-center gap-3">
        {/* Action buttons */}
      </div>
    </div>
  </div>
</div>
```

## Icons

**Size Guidelines:**
- Navigation: `size={20}` or `h-5 w-5`
- Section headers: `size={18}`
- Inline with text: `size={16}` or `size={14}`
- Small indicators: `size={12}`

**Color Guidelines:**
- Primary actions: `className="text-primary"`
- Urgent: `className="text-red-500"`
- Warning: `className="text-amber-500"`
- Success: `className="text-green-500"`
- Neutral: `className="text-muted-foreground"`

## Spacing System

**Consistent spacing:**
- Component gaps: `gap-3` (12px) or `gap-4` (16px)
- Section spacing: `space-y-6` (24px)
- Card padding: `p-5` (20px) or `p-6` (24px)
- Form fields: `space-y-3` (12px)

## Hover States

**All interactive elements use purple:**
```tsx
// Buttons
className="hover:bg-primary/10 hover:text-primary"

// Cards/Rows
className="hover:bg-muted/50 cursor-pointer transition-colors"

// Icons
className="hover:text-primary transition-colors"
```

**No blue or green hovers** - maintain purple brand consistency.

## Responsive Breakpoints

```css
sm:  640px  /* Mobile landscape */
md:  768px  /* Tablet */
lg:  1024px /* Desktop */
xl:  1280px /* Large desktop */
```

**Common patterns:**
```tsx
// 1 column mobile, 2 tablet, 3 desktop, 6 large
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"

// Stack on mobile, side-by-side on desktop
className="flex flex-col lg:flex-row gap-3"

// Hide on mobile, show on desktop
className="hidden md:inline"
```

## Animation & Transitions

**Subtle, fast transitions:**
```tsx
className="transition-all duration-200"
className="transition-colors duration-150"
```

**Avoid:**
- Slow transitions (>300ms)
- Bouncy animations
- Excessive motion

**Goal:** Fast, responsive, professional

## Accessibility

### Color Contrast
- All text maintains WCAG AA contrast
- Semantic colors have sufficient contrast
- Status indicators don't rely solely on color

### Focus States
- All interactive elements have visible focus
- Keyboard navigation supported
- Tab order is logical

### Screen Readers
- Semantic HTML used throughout
- ARIA labels where needed
- Meaningful alt text for icons

## Best Practices

### Do ✅
- Use semantic colors to communicate meaning
- Maintain purple for all primary actions
- Keep cognitive load low (3-second rule)
- Show clear hierarchy
- Guide users to next action
- Use icons to reinforce meaning

### Don't ❌
- Use colors for decoration only
- Mix blue/green hover states
- Hide important information
- Create cluttered interfaces
- Use jargon without context
- Overwhelm with too many options

## Example Compositions

### Case Card
```tsx
<div className="premium-card p-4 hover:bg-muted/50 cursor-pointer transition-colors">
  <div className="flex items-start justify-between mb-3">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold">C-2026-0847</span>
        <CaseStatusBadge status="blocked" />
        <UrgencyBadge urgency="critical" />
      </div>
      <p className="text-sm text-muted-foreground">
        Cliënt A.M. · 14 jaar · Amsterdam
      </p>
    </div>
  </div>
  <div className="flex items-center gap-2 text-sm">
    <Clock size={14} className="text-amber-500" />
    <span className="text-muted-foreground">12 dagen wachttijd</span>
  </div>
</div>
```

### Provider Match Card
```tsx
<div className="premium-card p-6 border-2 border-green-500">
  <div className="flex items-start justify-between mb-4">
    <div>
      <div className="flex items-center gap-3 mb-2">
        <h3 className="text-lg font-semibold">Provider Name</h3>
        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-500/10 text-green-500 border-green-500/30">
          Beste match
        </span>
      </div>
      <p className="text-sm text-muted-foreground">Residentiële zorg</p>
    </div>
    <div className="text-right">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-3xl font-bold text-primary">94</span>
        <span className="text-sm text-muted-foreground">/ 100</span>
      </div>
      <p className="text-xs text-muted-foreground">Match score</p>
    </div>
  </div>
  {/* ... rest of card */}
</div>
```

This design system ensures consistency, clarity, and usability across the entire Regiekamer platform.
