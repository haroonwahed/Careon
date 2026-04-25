# Casussen Page - Quick Reference

## What Is This?

The **Casussen page** is an operational triage system for care coordinators to:

✅ Identify urgent cases instantly  
✅ Understand problems at a glance  
✅ Take immediate action  
✅ Manage multiple cases efficiently  

Think: **Emergency room intake board** meets **smart workflow engine**.

---

## Page Access

**Navigation:** Sidebar → Regie → **Casussen**

**Direct Route:** Click "Casussen" in the sidebar navigation

---

## Quick Features

### 🔍 Search & Filter

```
[🔍 Zoek casussen, cliënten, regio's...]
```

- Instant search across all cases
- Real-time filtering
- Clear results

### ⚡ Quick Filters

```
[🔴 Zonder match] [🟡 Wacht > 3 dagen] 
[⚠️ Hoog risico] [🟢 Klaar voor plaatsing]
```

- One-click filtering
- Most common scenarios
- Color-coded for urgency
- Click again to deactivate

### 📊 View Modes

**List View** (default):
- 2-column grid (desktop)
- Organized by urgency
- "Aandacht nodig" section first
- "Overige casussen" section below

**Board View** (kanban):
- 5 workflow columns
- Visual bottleneck identification
- Horizontal scroll on mobile

### ☑️ Bulk Actions

Select multiple cases:
- Start matching
- Assign beoordelaar
- Escaleren

---

## Case Card Anatomy

Every card is a **decision block**:

```
┌────────────────────────────────────┐
│ ☑️ [URGENT] [Status]        8d    │ ← Urgency + Status + Wait time
│                                    │
│ Title (e.g., "Jeugd 14 - Complex") │ ← Case title
│ 📍 Regio  📈 Zorgtype              │ ← Key info
│                                    │
│ ⚠️ Problem 1                       │ ← Problems (red)
│ 👥 Problem 2                       │
│                                    │
│ ℹ️  System explanation             │ ← AI insight (blue)
│                                    │
│ ✅ AANBEVOLEN ACTIE                │ ← Recommendation (purple)
│    What to do next                │
│                                    │
│ [Action →] [Bekijk casus]          │ ← CTAs
└────────────────────────────────────┘
```

### Card Elements

**Header (Top Row):**
- ☑️ Selection checkbox
- Urgency badge (URGENT/AANDACHT/NORMAAL/STABIEL)
- Status badge (Intake/Aanbieder Beoordeling/Matching/Plaatsing/Afgerond)
- Wait time (days, red if >5)

**Body:**
- **Title**: Case identifier
- **Key info**: Regio + Zorgtype
- **Problems**: Red blocks showing blockers
- **System insight**: Blue block with AI explanation
- **Recommended action**: Purple block with next step

**Footer:**
- **Primary CTA**: Execute recommended action (purple button)
- **Secondary CTA**: "Bekijk casus" (view details)

---

## Visual Urgency System

### Critical (Red)
```
Border: Red (thick)
Background: Red gradient
Glow: Red shadow
Animation: Pulse
Label: URGENT
```
**Meaning:** Immediate attention required

### Warning (Amber)
```
Border: Amber (thick)
Background: Amber gradient
Glow: Amber shadow (subtle)
Label: AANDACHT
```
**Meaning:** Needs attention soon

### Normal (Blue)
```
Border: Blue (normal)
Background: Blue (light)
No glow
Label: NORMAAL
```
**Meaning:** On track

### Stable (Green)
```
Border: Green (normal)
Background: Green (light)
No glow
Label: STABIEL
```
**Meaning:** Going well

---

## Sorting Logic

Cases automatically sorted by:

1. **Urgency**: Critical → Warning → Normal → Stable
2. **Wait time**: Longest first (within same urgency)
3. **Blockers**: Cases with problems first

**You don't need to sort manually.** The system prioritizes for you.

---

## Common Workflows

### 1. Morning Triage

```
1. Open Casussen page
2. See "4 aandacht nodig" in subtitle
3. Scan "Casussen die aandacht nodig hebben"
4. Click first critical case
5. Read problem, insight, recommendation
6. Click action button
7. Done
```

**Time:** <10 seconds per case

### 2. Find Delayed Cases

```
1. Click "🟡 Wacht > 3 dagen" quick filter
2. See filtered list
3. Scan wait time indicators
4. Open longest waiting case
5. Take corrective action
```

**Time:** <5 seconds to identify

### 3. Bulk Assignment

```
1. Check boxes on multiple cases
2. Bulk action bar appears
3. Click "Assign beoordelaar"
4. Select assessor
5. All cases updated
```

**Time:** <15 seconds for 5 cases

### 4. Bottleneck Analysis

```
1. Switch to Board view
2. Scan column heights
3. Notice "Matching" has 4 cases
4. Investigate why matching is slow
5. Take system-level action
```

**Time:** <20 seconds to insight

---

## Keyboard Shortcuts

```
Tab         → Navigate between elements
Enter       → Activate button/link
Space       → Activate button/checkbox
Esc         → Clear filters
```

---

## Empty State

When no cases match filters:

```
┌─────────────────────────────┐
│                             │
│        [✅ Icon]            │
│                             │
│  Geen urgente casussen 🎯   │
│                             │
│  Alle casussen lopen        │
│  volgens planning.          │
│  Goed bezig!                │
│                             │
└─────────────────────────────┘
```

**Positive messaging** when work is done.

---

## Color Legend

| Color | Meaning | Used For |
|-------|---------|----------|
| 🔴 Red | Urgent/Critical/Error | Critical cases, problems, escalations |
| 🟡 Amber | Warning/Delay | Delayed cases, warnings |
| 🟢 Green | Stable/Positive | On-track cases, success |
| 🟣 Purple | Actions | Recommended actions, CTAs |
| 🔵 Blue | Information | System insights, context |

---

## Mobile Experience

### Portrait Mode
- 1-column layout
- Quick filters stack vertically
- Full card information
- Touch-optimized buttons
- Swipe-friendly

### Landscape Mode
- Board view: Swipe columns
- List view: Same as portrait
- Optimized for one-handed use

---

## Tips & Tricks

### Tip 1: Start with Quick Filters
Don't search first. Use quick filters to narrow down:
- "🔴 Zonder match" for matching issues
- "🟡 Wacht > 3 dagen" for delays
- "⚠️ Hoog risico" for urgent only

### Tip 2: Use Board View for Bottlenecks
Switch to board view to see where cases pile up.
If "Matching" column is full → capacity issue.

### Tip 3: Select Before Action
Check multiple cases with similar problems.
Use bulk actions to resolve faster.

### Tip 4: Trust the Recommendations
Purple "AANBEVOLEN ACTIE" blocks are AI-powered.
They consider context you might not see.

### Tip 5: Watch Wait Times
Red wait time indicator (>5 days) = needs attention.
Even if not marked "urgent" yet.

---

## Problem Indicators Explained

### ⚠️ Geen passende match gevonden
**Meaning:** No suitable provider found  
**Action:** Review criteria or escalate

### ℹ️ Aanbieder Beoordeling ontbreekt
**Meaning:** Aanbieder Beoordeling not completed  
**Action:** Schedule aanbieder beoordeling

### 👥 Capaciteitstekort in regio
**Meaning:** Not enough providers in region  
**Action:** Expand search or wait for capacity

### 🕐 Wachttijd te lang
**Meaning:** Case waiting too long  
**Action:** Prioritize or escalate

---

## When to Use Each View

### Use List View When:
- Starting your day (triage)
- Looking for specific urgency level
- Need to see all case details
- Want structured organization

### Use Board View When:
- Analyzing workflow bottlenecks
- Understanding case distribution
- Planning capacity
- Visual preference

---

## Integration Points

**From Regiekamer:**
```
Click "Bekijk alle casussen" → Opens Casussen page
```

**To Case Detail:**
```
Click "Bekijk casus" → Opens full case detail
```

**From Sidebar:**
```
Click "Casussen" → Opens Casussen page
```

---

## Performance

**Load Time:** <1 second  
**Search Response:** Instant  
**Filter Update:** Instant  
**View Switch:** Smooth (<300ms)

**Optimized for:**
- Up to 50 cases: Instant
- 50-200 cases: Fast
- 200+ cases: Pagination (future)

---

## Accessibility

✅ Keyboard navigation  
✅ Screen reader support (labels)  
✅ High contrast colors (WCAG AA)  
✅ Focus indicators  
✅ Semantic HTML  

---

## Browser Support

✅ Chrome (latest)  
✅ Firefox (latest)  
✅ Safari (latest)  
✅ Edge (latest)  

---

## Need Help?

### Common Issues

**Q: No cases showing?**  
A: Check quick filters. Click active filter to deactivate.

**Q: Can't find a case?**  
A: Use search bar. Search by case title, client, or regio.

**Q: Bulk actions not working?**  
A: Make sure cases are selected (checkbox checked).

**Q: Board view not scrolling?**  
A: Use mouse wheel or trackpad. Touch: swipe horizontally.

---

## What's Next?

### Coming Soon
- Advanced filtering (multi-select, date ranges)
- Drag & drop in board view
- Save custom views
- Export to CSV/PDF

### Future Features
- Inline editing
- Quick actions menu
- Keyboard shortcuts
- Mobile gestures

---

## Quick Links

📄 **Full Documentation:** `/CASUSSEN_PAGE_DESIGN.md`  
🎨 **Visual Guide:** `/CASUSSEN_VISUAL_GUIDE.md`  
✅ **Implementation:** `/CASUSSEN_IMPLEMENTATION_CHECKLIST.md`  
🌐 **System Overview:** `/SYSTEM_COMPLETE_OVERVIEW.md`

---

**Page Version:** 1.0.0  
**Last Updated:** April 17, 2026  
**Status:** Production Ready ✅
