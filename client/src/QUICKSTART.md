# Quick Start Guide - Regiekamer

## What is this?

This is a **healthcare coordination control room** (Regiekamer) for Dutch municipalities and care organizations to manage youth care cases.

---

## First Time Setup

### 1. Installation
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Browser
```
http://localhost:5173
```

You'll see the Regiekamer dashboard with 8 sample cases.

---

## Main Views

### 🎛️ Regiekamer (Dashboard)
**What you see**: Control room showing all cases needing attention

**Top Section**: 6 KPI cards showing operational metrics
- Cases without match
- Open assessments  
- Placements in progress
- Average waiting time
- High-risk cases
- Capacity shortages

**Main Area**: 
- Left (70%): List of active cases sorted by urgency
- Right (30%): System signals, priority actions, capacity overview

**What to do**: Click any case to see details

---

### 📋 Case Detail Page
**What you see**: Complete information about one case

**Sections**:
1. **Header**: Case ID, status, urgency, risk + recommendation
2. **Phase Indicator**: Shows progress (Intake → Assessment → Matching → Placement)
3. **Three Columns**:
   - Left: Client info, case details, timeline
   - Center: Work area (changes based on case status)
   - Right: Risks, AI suggestions, similar cases
4. **Bottom Bar**: Quick actions

**What to do**: 
- Review case information
- Check recommendation banner
- Click "Start matching" when ready

---

### 🤝 Matching Page
**What you see**: Top 3 provider matches for the case

**Each Provider Shows**:
- Match score (0-100)
- Type: Best match (green) / Alternative (purple) / Risky (amber)
- Key metrics: capacity, rating, response time
- Specializations
- Why this match? (explanation)
- Trade-offs (pros/cons)

**What to do**:
- Review all 3 matches
- Read the decision guidance at bottom
- Select and confirm placement

---

## Understanding the Colors

| Color | Meaning | Example |
|-------|---------|---------|
| 🔴 Red | Critical/Urgent | Blocked cases, high risks |
| 🟡 Amber | Warning | Delays, moderate urgency |
| 🟢 Green | Positive | Low risk, completed |
| 🟣 Purple | Actions | Primary buttons, active states |
| 🔵 Blue | Info | Assessment phase |

---

## Understanding the Badges

### Status Badges (What phase is the case in?)
- 🟣 **Intake** - New case
- 🔵 **Beoordeling** - Assessment in progress
- 🟡 **Matching** - Looking for providers
- 🔵 **Plaatsing** - Placement being processed
- 🟢 **Actief** - Active care
- 🟢 **Afgerond** - Completed
- 🔴 **Geblokkeerd** - Blocked/stuck

### Urgency Badges (How soon needs action?)
- 🔴 **Kritiek** - Critical (act now)
- 🟠 **Hoog** - High (act today)
- 🟡 **Gemiddeld** - Medium (this week)
- 🟢 **Laag** - Low (not urgent)

### Risk Badges (How likely to escalate?)
- 🔴 **Hoog risico** - High risk
- 🟡 **Gemiddeld risico** - Medium risk
- 🟢 **Laag risico** - Low risk

---

## Navigation

### Sidebar (Left)
- **Regiekamer** - Main dashboard (you are here)
- **Signalen** - Notifications and alerts (3 new)
- **Berichten** - Messages (5 unread)
- **Instellingen** - Settings

### Top Bar (Right)
- 🌐 **Language** - Switch EN/NL/FR
- 🌙 **Theme** - Toggle dark/light mode
- 👤 **Account** - User profile & settings

### Bottom Left
- 🔄 **Refresh** - Reload data (5 sec cooldown)
- ◀️ **Collapse** - Shrink sidebar

---

## Sample Data

The app comes with 8 mock cases:

1. **C-2026-0847** - Blocked, critical, 12 days waiting
2. **C-2026-0891** - Assessment, high urgency, 8 days
3. **C-2026-0923** - Matching, high urgency, 6 days
4. **C-2026-0945** - Placement, medium urgency, 3 days
5. **C-2026-0912** - Assessment, medium urgency, 5 days
6. **C-2026-0956** - Intake, low urgency, 2 days
7. **C-2026-0873** - Matching, medium urgency, 4 days
8. **C-2026-0834** - Blocked, critical, 18 days

**Most urgent cases appear first** in the Regiekamer.

---

## Common Workflows

### Scenario 1: New Case Assessment
```
1. See case with status "Intake" in Regiekamer
2. Click case to open detail page
3. Review client information
4. Add assessment notes in work area
5. Update status to "Beoordeling"
```

### Scenario 2: Finding Provider Match
```
1. Case status is "Matching"
2. Click "Start matching" button
3. Review 3 provider options
4. Compare match scores and explanations
5. Select best match
6. Confirm placement
```

### Scenario 3: Handling Blocked Case
```
1. See red "Geblokkeerd" badge
2. Click case to see details
3. Check "Risico's" panel for reasons
4. Read system suggestions
5. Click "Escaleer naar manager" button
```

---

## Keyboard Shortcuts

```
Tab         Navigate between elements
Enter       Confirm/Open selected item
Escape      Close modal/Go back
←/→         Navigate in lists (future)
```

---

## Tips & Tricks

### 💡 Quick Identification
- **Red borders** = needs immediate attention
- **High numbers** in KPIs = potential issues
- **Amber badges** = delays or warnings
- **Empty capacity bars** = resource shortage

### 💡 Efficient Workflow
1. Start day by checking **Signalen** (alerts)
2. Review **Volgende acties** (priority actions)
3. Work through cases from top of list (most urgent)
4. Check **Capaciteit overzicht** before placing
5. Use filters to focus on specific regions/statuses

### 💡 Decision Support
- Always read the **recommendation banner**
- Check **AI suggestions** confidence scores
- Review **similar cases** for precedents
- Consider **trade-offs** in matching
- Don't ignore **risk alerts**

---

## Troubleshooting

### Problem: Can't see any cases
**Solution**: Check filters at top - make sure "Alle regio's" and "Alle statussen" are selected

### Problem: KPI cards not updating
**Solution**: Click the refresh button in bottom-left sidebar

### Problem: Matching page shows no providers
**Solution**: This happens with certain case types - check case requirements in header

### Problem: Sidebar too narrow
**Solution**: Click the expand button (→) at bottom-left

### Problem: Dark theme hurts eyes
**Solution**: Click sun icon (☀️) in top-right to switch to light mode

---

## What's Mock vs. Real

### Currently Mock (Demo Data) 🎭
- All 8 cases
- All 5 providers
- System signals
- Priority actions
- Match scores
- AI suggestions
- Risk calculations

### Real (Already Working) ✅
- Navigation
- Theme switching
- Language switching
- Sidebar collapse
- Search and filters
- Settings page
- Responsive design

---

## Next Steps

### For Developers
1. Read `/REGIEKAMER_IMPLEMENTATION.md` for technical details
2. Check `/REGIEKAMER_VISUAL_GUIDE.md` for design patterns
3. Explore `/components/care/` for all components
4. Review `/lib/casesData.ts` for data structures

### For Designers
1. Colors are defined in `/REGIEKAMER_VISUAL_GUIDE.md`
2. Component patterns documented with examples
3. Layout grids shown visually
4. All spacing/typography specified

### For Product Managers
1. Feature overview in `/TRANSFORMATION_COMPLETE.md`
2. Future enhancements listed
3. Navigation flows documented
4. User workflows described

---

## Getting Help

### Documentation
- **Technical**: `/REGIEKAMER_IMPLEMENTATION.md`
- **Visual**: `/REGIEKAMER_VISUAL_GUIDE.md`
- **Summary**: `/TRANSFORMATION_COMPLETE.md`

### Code
- **Components**: `/components/care/`
- **Data**: `/lib/casesData.ts`
- **Routing**: `/App.tsx`
- **Styles**: `/styles/globals.css`

---

## Demo Accounts

Currently, the app doesn't have authentication. All data is client-side mock data.

For future implementations with auth:
- Municipality admin
- Care coordinator  
- Healthcare provider
- System administrator

---

## Performance

The app is optimized for:
- ✅ Fast initial load
- ✅ Smooth transitions
- ✅ Responsive interactions
- ✅ Efficient re-renders

Tested on:
- Desktop: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Chrome Android
- Tablets: iPad, Android tablets

---

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 100+ | ✅ Full support |
| Firefox | 100+ | ✅ Full support |
| Safari | 15+ | ✅ Full support |
| Edge | 100+ | ✅ Full support |
| Mobile | Latest | ✅ Full support |

---

## System Requirements

**Minimum**:
- Node.js 18+
- 2GB RAM
- Modern browser (last 2 versions)

**Recommended**:
- Node.js 20+
- 4GB RAM
- 1920x1080 display
- Dark mode capable

---

## FAQ

**Q: Is this a real system?**
A: Currently using mock data, but designed for real implementation.

**Q: Can I customize the colors?**
A: Yes, see `/REGIEKAMER_VISUAL_GUIDE.md` for color system.

**Q: How do I add more cases?**
A: Add to `mockCases` array in `/lib/casesData.ts`.

**Q: Can I integrate with my database?**
A: Yes, replace mock data with API calls in the page components.

**Q: Is it accessible?**
A: Yes, designed with WCAG AA compliance. Keyboard navigable, screen reader friendly.

**Q: Can I export reports?**
A: Export button exists but needs backend implementation.

**Q: Multi-language support?**
A: Currently EN/FR, can add more in `/lib/i18n.ts`.

**Q: Mobile responsive?**
A: Yes, but desktop-first design. Mobile optimized for viewing, not heavy data entry.

---

**Ready to explore?** 

Click around, no data will be saved. Everything resets on refresh.

Start by clicking the first red case in the Regiekamer! 🚀
