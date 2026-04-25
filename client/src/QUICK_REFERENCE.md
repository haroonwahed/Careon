# AI Layer - Quick Reference Card

## 🎯 One-Minute Overview

**What:** Embedded AI decision intelligence layer  
**Why:** Guide users to right decisions, highlight risks, explain recommendations  
**How:** 6 reusable components integrated across existing pages  
**Feel:** Smart assistant, not chatbot

---

## 📦 Component Cheat Sheet

| Component | One-liner | Location |
|-----------|-----------|----------|
| `AanbevolenActie` | "Do this next" card | Top of page |
| `Risicosignalen` | Risk warnings | Right sidebar |
| `Samenvatting` | Bullet summary | Center column |
| `MatchExplanation` | "Why this match?" | Provider cards |
| `SystemInsight` | Inline status | Anywhere |
| `AIInsightPanel` | Sidebar wrapper | Right column |

---

## 🚀 Copy-Paste Starters

### Add Top Recommendation

```tsx
import { AanbevolenActie } from "@/components/ai";

<AanbevolenActie
  title="Start matching proces"
  explanation="Aanbieder Beoordeling is compleet. 3 matches gevonden."
  actionLabel="Start matching"
  confidence="high"
  onAction={() => handleAction()}
/>
```

### Add Risk Signals

```tsx
import { Risicosignalen } from "@/components/ai";

<Risicosignalen
  signals={[
    { severity: "critical", message: "Geen capaciteit beschikbaar" },
    { severity: "warning", message: "Urgente casus met vertraging" }
  ]}
/>
```

### Add Summary

```tsx
import { Samenvatting } from "@/components/ai";

<Samenvatting
  items={[
    { text: "15 jaar, Amsterdam", type: "default" },
    { text: "Zorgvraag: IAB", type: "info" },
    { text: "Hoge urgentie", type: "warning" }
  ]}
/>
```

### Add Match Explanation

```tsx
import { MatchExplanation } from "@/components/ai";

<MatchExplanation
  score={94}
  strengths={["Specialisatie match", "3 plekken vrij", "Reactie 4u"]}
  tradeoffs={["15km afstand"]}
  confidence="high"
/>
```

### Add Inline Insight

```tsx
import { SystemInsight } from "@/components/ai";

<SystemInsight
  type="success" // "info" | "warning" | "success" | "blocked" | "suggestion"
  message="Aanbieder Beoordeling gepland voor 18 april"
/>
```

---

## 🎨 Color Quick Guide

```
Purple  →  Actions     "Take this action"
Red     →  Critical    "Urgent problem"
Amber   →  Warning     "Be careful"
Blue    →  Info        "Good to know"
Green   →  Success     "All good"
```

---

## 📐 Layout Template

```tsx
<div className="space-y-6">
  {/* Top: Recommended action */}
  <AanbevolenActie {...rec} />
  
  {/* 3-column grid */}
  <div className="grid grid-cols-12 gap-6">
    
    {/* Left (4 cols): Case info */}
    <div className="col-span-4">...</div>
    
    {/* Center (5 cols): Summary + work */}
    <div className="col-span-5 space-y-4">
      <Samenvatting items={summary} />
      {/* Work area */}
      <SystemInsight type="info" message="..." />
    </div>
    
    {/* Right (3 cols): AI insights */}
    <div className="col-span-3">
      <AIInsightPanel>
        <Risicosignalen signals={risks} />
      </AIInsightPanel>
    </div>
  </div>
</div>
```

---

## ✅ Integration Checklist

- [ ] Import AI components from `@/components/ai`
- [ ] Add decision logic functions (getRecommendation, getRiskSignals)
- [ ] Change grid to `grid-cols-12` for 4-5-3 split
- [ ] Add `AanbevolenActie` at top
- [ ] Add `Samenvatting` in center column
- [ ] Wrap right sidebar with `AIInsightPanel`
- [ ] Add `Risicosignalen` to right sidebar
- [ ] Add inline `SystemInsight` where needed
- [ ] Test text wrapping with long strings
- [ ] Verify 3-second comprehension

---

## 🗣️ Dutch Language Do's/Don'ts

### ✅ Do Use
- Aanbevolen
- Waarom
- Let op
- Overweeg
- Systeem heeft geïdentificeerd

### ❌ Don't Use
- AI denkt dat...
- Misschien...
- Waarschijnlijk...
- Wij raden aan...

---

## 🐛 Common Pitfalls

1. **Text overflow** → Add `break-words` class
2. **Wrong grid** → Use `grid-cols-12`, not `grid-cols-3`
3. **Too much text** → Max 15 words per bullet
4. **Wrong colors** → Follow semantic system (purple=action, red=critical)
5. **Missing confidence** → Always show confidence on recommendations
6. **No "why"** → Every recommendation needs explanation

---

## 📱 Responsive Pattern

```tsx
{/* Desktop: 4-5-3 cols */}
<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
  <div className="xl:col-span-4">...</div>
  <div className="xl:col-span-5">...</div>
  <div className="xl:col-span-3">...</div>
</div>

{/* Mobile: stacks automatically */}
```

---

## 🔍 Testing One-Liner

**"Can user understand what to do next in <3 seconds?"**

If no → Simplify text, increase hierarchy, reduce components

---

## 📚 Full Docs

- **Complete guide:** `/components/ai/README.md`
- **Visual specs:** `/components/ai/VISUAL_GUIDE.md`
- **Examples:** `/components/ai/INTEGRATION_EXAMPLES.md`
- **Working demos:** `/components/examples/`

---

## 🆘 Quick Fixes

### "Text overflows card"
```tsx
// Add to text elements:
className="break-words"
```

### "Layout breaks on mobile"
```tsx
// Change grid:
<div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
```

### "Too many risk signals"
```tsx
// Limit to top 3:
signals.slice(0, 3)
```

### "Action button doesn't work"
```tsx
// Pass handler:
onAction={() => handleYourAction()}
```

---

## 💡 Remember

- This is NOT a chatbot
- This IS embedded intelligence
- Always explain "why"
- Keep it calm and professional
- Follow semantic colors
- Test with real data
- 3-second comprehension rule

---

**You're ready to add AI layer! Start with one page, one component at a time.** 🚀
