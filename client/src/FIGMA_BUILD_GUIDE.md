# Build AI Components in Figma - Step by Step

## 🎯 Goal

Create a production-ready component library with:
- ✅ One voice, one system, one pattern
- ✅ All 7 AI components
- ✅ Proper variants
- ✅ Design tokens
- ✅ Ready for developers

**Time needed:** 2-3 hours

---

## 📋 Prerequisites

- Figma account (free or paid)
- Inter font family installed
- Lucide icons (or similar)
- Basic Figma knowledge (Auto Layout, Components, Variants)

---

## 🏗️ Phase 1: Setup (15 minutes)

### Step 1.1: Create File Structure

1. Create new Figma file: **"Careon AI Component Library"**

2. Create these pages:
   ```
   📄 Design Tokens
   📄 AI Components
   📄 Examples
   📄 Documentation
   ```

### Step 1.2: Set Up Design Tokens

On **"Design Tokens"** page:

1. **Click the mode icon (⚙️) in layers panel**

2. **Create Local Variables:**

   **Color Variables:**
   ```
   Purple/Primary   = #8B5CF6
   Purple/Light     = rgba(139, 92, 246, 0.08)
   Purple/Border    = rgba(139, 92, 246, 0.40)
   
   Red/Primary      = #EF4444
   Red/Light        = rgba(239, 68, 68, 0.10)
   Red/Border       = rgba(239, 68, 68, 0.30)
   
   Amber/Primary    = #F59E0B
   Amber/Light      = rgba(245, 158, 11, 0.10)
   Amber/Border     = rgba(245, 158, 11, 0.30)
   
   Blue/Primary     = #3B82F6
   Blue/Light       = rgba(59, 130, 246, 0.08)
   Blue/Border      = rgba(59, 130, 246, 0.20)
   
   Green/Primary    = #22C55E
   Green/Light      = rgba(34, 197, 94, 0.10)
   Green/Border     = rgba(34, 197, 94, 0.30)
   
   Neutral/Foreground = #FFFFFF
   Neutral/Muted      = rgba(255, 255, 255, 0.60)
   Neutral/Border     = rgba(255, 255, 255, 0.10)
   Neutral/CardBG     = rgba(255, 255, 255, 0.03)
   ```

3. **Create Text Styles:**

   ```
   AI/Header/Label
     Font: Inter Semibold
     Size: 12px
     Line height: 16px
     Letter spacing: 0.5px
     Case: Uppercase
     
   AI/Title
     Font: Inter Bold
     Size: 16px
     Line height: 24px
     
   AI/Body
     Font: Inter Regular
     Size: 14px
     Line height: 22px
     
   AI/Small
     Font: Inter Regular
     Size: 12px
     Line height: 18px
     
   AI/Button
     Font: Inter Semibold
     Size: 14px
     
   AI/Section
     Font: Inter Semibold
     Size: 12px
     Line height: 16px
   ```

---

## 🧱 Phase 2: Build Components (90 minutes)

Switch to **"AI Components"** page.

### Component 1: AI / Block / Aanbevolen (20 min)

**Step 1: Create Base Frame**

1. Press `F` for Frame tool
2. Click on canvas
3. Set frame size: Width 400px, Height auto (will adjust)
4. Name it: `AI / Block / Aanbevolen`

**Step 2: Set Auto Layout**

1. Select frame
2. Press `Shift + A` (or right-click → Add Auto Layout)
3. Settings:
   - Direction: Vertical ↓
   - Gap: 12px
   - Padding: 20px all sides
   - Resizing: Hug vertical, Fill horizontal

**Step 3: Add Left Border**

1. Select frame
2. In right panel → Stroke
3. Click stroke → Advanced stroke settings
4. Set:
   - Left: 4px
   - Top/Right/Bottom: 2px
5. Color: Purple/Border variable

**Step 4: Add Background**

1. Select frame
2. Fill → Purple/Light variable
3. Corner radius: 8px

**Step 5: Add Header**

1. Inside frame, press `F` for new frame
2. Add Auto Layout (Shift + A)
3. Direction: Horizontal →
4. Gap: 8px
5. Align: Center

6. Add icon:
   - Use plugin: "Iconify" or "Feather Icons"
   - Search "sparkles"
   - Size: 16x16px
   - Color: Purple/Primary

7. Add text: "AANBEVOLEN ACTIE"
   - Apply text style: AI/Header/Label
   - Color: Purple/Primary

**Step 6: Add Title**

1. Press `T` for text tool
2. Type: "Start beoordeling"
3. Apply text style: AI/Title
4. Color: Neutral/Foreground
5. Width: Fill container

**Step 7: Add Explanation**

1. Press `T` for text tool
2. Type: "Waarom: Matching is niet mogelijk zonder urgentie en zorgtype"
3. Apply text style: AI/Body
4. Color: Neutral/Muted
5. Width: Fill container

**Step 8: Add Button**

1. Press `F` for frame
2. Add Auto Layout
3. Direction: Horizontal
4. Gap: 8px
5. Padding: 0px 20px
6. Height: 40px (fixed)
7. Align: Center
8. Background: Purple/Primary
9. Corner radius: 6px

10. Add text: "Start beoordeling"
    - Text style: AI/Button
    - Color: #FFFFFF

11. Add icon: ChevronRight, 16x16px

**Step 9: Make it a Component**

1. Select main frame
2. Press `Ctrl/Cmd + Alt + K` (or right-click → Create component)
3. Component name: `AI / Block / Aanbevolen`

**Step 10: Create Variants**

1. Select component
2. Right panel → Click "+" next to Variants
3. Add property: `State`
   - Values: Default, Urgent
4. Duplicate component (Cmd + D)
5. Change duplicated version:
   - Border: Red/Border
   - Background: Red/Light
   - Button bg: Red/Primary
6. Set property to "Urgent"

7. Add another property: `HasCTA`
   - Values: True, False
8. Create variant without button

---

### Component 2: AI / Block / Risico (15 min)

**Step 1: Create Base Frame**

1. Frame: 400px width, auto height
2. Name: `AI / Block / Risico`
3. Auto Layout: Vertical, Gap 0, Padding 16px
4. Border: 2px Red/Border
5. Background: Neutral/CardBG
6. Corner radius: 8px

**Step 2: Add Header**

1. Frame with Auto Layout horizontal
2. Icon: AlertTriangle, 16px
3. Text: "Risicosignalen"
   - Style: AI/Title
4. Counter text: "3 signalen"
   - Style: AI/Small
   - Position: Right
5. Margin bottom: 12px

**Step 3: Create Signal Item Component**

1. New frame: Auto Layout horizontal
2. Padding: 10px
3. Gap: 8px
4. Border: 1px Red/Border
5. Background: Red/Light
6. Corner radius: 6px

7. Icon: AlertOctagon, 14px, Red/Primary
8. Text: "Wachttijd overschreden"
   - Style: AI/Small
   - Color: Red/Primary

9. Make this a nested component: `AI / Signal Item`
10. Create variants:
    - Severity: Critical, Warning, Info
    - Each with different colors

**Step 4: Add Multiple Signal Items**

1. Add 3 instances of Signal Item
2. Set different severities
3. Gap between items: 8px

**Step 5: Make Main Component**

1. Select outer frame
2. Create component
3. Add variants:
   - HasCritical: True, False
   - State: Empty, Filled

---

### Component 3: AI / Block / Samenvatting (10 min)

**Step 1: Create Frame**

1. Frame: 400px width, auto
2. Auto Layout: Vertical, Gap 0, Padding 16px
3. Border: 1px Neutral/Border
4. Background: Neutral/CardBG
5. Corner radius: 8px

**Step 2: Add Header**

1. Horizontal frame
2. Icon: FileText, 16px, Neutral/Muted
3. Text: "Samenvatting"
   - Style: AI/Title
4. Margin bottom: 12px

**Step 3: Create Bullet Item**

1. Horizontal frame
2. Gap: 10px
3. Icon: CheckCircle2, 14px, Green/Primary
4. Text: "Jongere (14) met complexe problematiek"
   - Style: AI/Body
   - Color: Neutral/Muted

5. Make nested component: `AI / Bullet Item`
6. Variants for icon types:
   - Success (green check)
   - Info (blue info)
   - Warning (amber alert)

**Step 4: Add Multiple Items**

1. Add 4 bullet items
2. Different types
3. Gap: 10px

**Step 5: Create Main Component**

1. Make component
2. Variants:
   - Size: Default, Compact
   - Style: Card, Inline

---

### Component 4: AI / Block / Match (20 min)

**Step 1: Create Frame**

1. Frame: 400px, auto
2. Auto Layout: Vertical, Gap 0, Padding 16px
3. Border: 2px Blue/Border
4. Background: Blue/Light
5. Corner radius: 8px

**Step 2: Add Header with Score**

1. Horizontal frame
2. Justify: Space between

Left side:
3. Icon: TrendingUp, 16px, Blue/Primary
4. Text: "Waarom deze match?"
   - Style: AI/Title

Right side:
5. Score badge:
   - Frame: 60x32px
   - Border: 2px Green/Border
   - Background: Green/Light
   - Corner radius: 8px
   - Text: "94" (Inter Bold 24px, Green/Primary)
   - Align: Center

**Step 3: Add Confidence Badge**

1. Horizontal frame
2. Padding: 6px 10px
3. Background: rgba(255,255,255,0.05)
4. Corner radius: 6px
5. Icon: Target, 12px
6. Text: "Hoog vertrouwen"
   - Style: AI/Small
7. Margin top: 12px

**Step 4: Add "Sterke punten" Section**

1. Section header:
   - Text: "Sterke punten"
   - Style: AI/Section
   - Color: Green/Primary
   - Margin bottom: 8px

2. Items (vertical, gap 6px):
   - Icon: CheckCircle2, 12px, green
   - Text: 12px, muted
   - 3 items

**Step 5: Add "Aandachtspunten" Section**

1. Same structure as Sterke punten
2. Color: Amber
3. Icon: AlertCircle
4. Margin top: 12px

**Step 6: Create Component + Variants**

1. Make component
2. Variants:
   - Score: High, Medium, Low
   - Each changes badge color

---

### Component 5: AI / Inline / Insight (10 min)

**Step 1: Create Simple Frame**

1. Frame: Auto width
2. Auto Layout: Horizontal
3. Gap: 8px
4. Padding: 10px 12px
5. Align: Center
6. Border: 1px
7. Corner radius: 8px

**Step 2: Add Content**

1. Icon: Info, 14px
2. Text: "Aanbieder Beoordeling gepland voor 18 april"
   - Style: AI/Small

**Step 3: Create Component + Variants**

1. Make component
2. Variants:
   - Type: Info, Success, Warning, Blocked, Suggestion
3. Each type has:
   - Different icon
   - Different colors (border, bg, text)

---

### Component 6: AI / Block / Validatie (10 min)

**Step 1: Create Frame**

1. Frame: 400px, auto
2. Auto Layout: Vertical, Gap 0, Padding 16px
3. Border: 2px Green/Border
4. Background: Green/Light
5. Corner radius: 8px

**Step 2: Add Header**

1. Text: "Validatie"
   - Style: AI/Title
2. Margin bottom: 12px

**Step 3: Add Check Items**

1. Horizontal frames
2. Icon: CheckCircle2 (green) or AlertCircle (amber)
3. Text: "Aanbieder Beoordeling compleet"
4. Gap: 8px
5. Margin: 8px between items

**Step 4: Add Footer Message**

1. Text: "Je kunt veilig doorgaan"
   - Style: AI/Body
   - Color: Green/Primary
2. Margin top: 12px

**Step 5: Create Component + Variants**

1. Make component
2. Variants:
   - State: AllReady, Mixed, NotReady
3. Changes border/bg colors

---

### Component 7: AI / Strip / NextAction (10 min)

**Step 1: Create Frame**

1. Frame: 800px width, 56px height (fixed)
2. Auto Layout: Horizontal
3. Gap: 16px
4. Padding: 0px 20px
5. Align: Center
6. Border: 1px Purple/Border
7. Background: Purple/Light
8. Corner radius: 8px

**Step 2: Add Content**

1. Label: "Aanbevolen:"
   - Style: AI/Button
   - Color: Foreground

2. Message: "Werk eerst open beoordelingen af"
   - Style: AI/Body
   - Color: Muted
   - Fill container (flex)

3. Button:
   - Height: 32px
   - Padding: 0 16px
   - Background: Purple/Primary
   - Text: "Ga naar beoordelingen"
   - Corner radius: 6px

**Step 3: Create Component + Variants**

1. Make component
2. Variants:
   - HasButton: True, False

---

## 📚 Phase 3: Create Component Set (15 minutes)

### Step 1: Organize Components

1. On "AI Components" page
2. Create sections:
   ```
   ┌─ BLOCKS (Primary)
   │  ├─ AI / Block / Aanbevolen
   │  ├─ AI / Block / Risico
   │  ├─ AI / Block / Samenvatting
   │  ├─ AI / Block / Match
   │  └─ AI / Block / Validatie
   │
   ├─ INLINE (Secondary)
   │  └─ AI / Inline / Insight
   │
   └─ STRIPS (Tertiary)
      └─ AI / Strip / NextAction
   ```

### Step 2: Document Each Component

1. Select each component
2. Right panel → Description
3. Add:
   ```
   Purpose: [What it does]
   When to use: [Where it appears]
   Variants: [List of variants]
   ```

---

## 🎨 Phase 4: Create Examples (30 minutes)

Switch to **"Examples"** page.

### Example 1: Casus Detail Layout

1. Create frame: 1440x900px
2. Name: "Casus Detail Page"

3. Add components:
   - Top: AI / Block / Aanbevolen
   - Center left: Casus info (placeholder)
   - Center: AI / Block / Samenvatting
   - Right: AI / Block / Risico

4. Use 12-column grid:
   - Left: 4 cols
   - Center: 5 cols
   - Right: 3 cols

### Example 2: Matching Page

1. Frame: 1440x900px
2. Add:
   - Top: AI / Block / Aanbevolen
   - Main: Provider cards with AI / Block / Match
   - Right: AI / Block / Risico

### Example 3: Mobile View

1. Frame: 375x812px (iPhone)
2. Stack components vertically
3. Show how they adapt

### Example 4: All States Showcase

1. Grid showing all component variants
2. One of each type
3. Different states visible

---

## ✅ Phase 5: Finalize & Test (30 minutes)

### Step 1: Test Responsive Behavior

1. Select each component
2. Resize frame width
3. Verify:
   - Text wraps correctly
   - Icons stay fixed size
   - Padding consistent
   - No overflow

### Step 2: Check Consistency

For all components verify:
- [ ] Same spacing scale used
- [ ] Same text styles used
- [ ] Same color variables used
- [ ] Same corner radius (8px)
- [ ] Same icon sizes (14-16px)

### Step 3: Create Component Documentation

On "Documentation" page:

1. Create visual spec sheet showing:
   - All components
   - Measurements
   - Color swatches
   - Typography samples

2. Add usage guidelines:
   - When to use each component
   - Max per page rules
   - Tone & voice examples

### Step 4: Publish Library

1. Click "Libraries" icon (book) in toolbar
2. Click "Publish"
3. Add description:
   ```
   AI Decision Intelligence Components
   
   One voice. One system. One pattern.
   
   7 components for embedded AI across
   the Careon Zorgregie platform.
   ```

4. Publish!

---

## 🚀 Phase 6: Handoff to Developers (15 minutes)

### Step 1: Enable Dev Mode

1. Click "Dev Mode" toggle (top right)
2. Developers can now inspect components

### Step 2: Export Design Tokens

1. Use plugin: "Design Tokens"
2. Export colors, spacing, typography as JSON
3. Share with dev team

### Step 3: Create Handoff Document

Create Figma page with:
- Component inventory
- Measurements reference
- Code examples
- Integration notes

### Step 4: Share File

1. Click "Share" button
2. Invite developers
3. Set permission: "Can view"
4. Share link

---

## ✅ Completion Checklist

**Design Tokens:**
- [ ] Color variables created (all 5 colors)
- [ ] Text styles created (6 styles)
- [ ] All components use variables (not hard-coded colors)

**Components:**
- [ ] AI / Block / Aanbevolen (with variants)
- [ ] AI / Block / Risico (with variants)
- [ ] AI / Block / Samenvatting (with variants)
- [ ] AI / Block / Match (with variants)
- [ ] AI / Block / Validatie (with variants)
- [ ] AI / Inline / Insight (with variants)
- [ ] AI / Strip / NextAction (with variants)

**Quality:**
- [ ] All use Auto Layout
- [ ] Responsive (resize correctly)
- [ ] Consistent spacing
- [ ] Consistent typography
- [ ] Consistent colors
- [ ] All variants work correctly

**Documentation:**
- [ ] Component descriptions added
- [ ] Examples page created
- [ ] Visual spec sheet created
- [ ] Usage guidelines documented

**Handoff:**
- [ ] Dev Mode enabled
- [ ] Design tokens exported
- [ ] File shared with team
- [ ] Library published

---

## 🎯 Success Criteria

You're done when:

1. ✅ All 7 components built with variants
2. ✅ Design tokens set up and used
3. ✅ Components work responsively
4. ✅ Examples show all states
5. ✅ Library published
6. ✅ Developers have access
7. ✅ **One voice, one system, one pattern achieved!**

---

## 💡 Pro Tips

1. **Use components, not frames**
   - Makes updates easier
   - Ensures consistency

2. **Create nested components**
   - Signal items
   - Bullet points
   - Reusable across blocks

3. **Test on different sizes**
   - Desktop: 1440px
   - Tablet: 768px
   - Mobile: 375px

4. **Use component descriptions**
   - Helps developers
   - Documents decisions

5. **Version your library**
   - When making changes
   - Keep changelog

---

## 🆘 Troubleshooting

**"My Auto Layout doesn't work"**
- Check direction (vertical vs horizontal)
- Verify gap settings
- Check hug vs fill settings

**"Colors look wrong"**
- Make sure using variables, not hard-coded
- Check opacity is correct
- Verify dark mode colors

**"Text doesn't wrap"**
- Set text width to "Fill container"
- Check Auto Layout on parent
- Use line height 22px for body text

**"Components don't resize"**
- Check Auto Layout settings
- Verify hug/fill/fixed settings
- Test by resizing frame

---

## 📞 Need Help?

Reference these files:
- [FIGMA_AI_COMPONENTS.md](./FIGMA_AI_COMPONENTS.md) - Full specs
- [FIGMA_MEASUREMENTS.md](./FIGMA_MEASUREMENTS.md) - Exact measurements
- [/components/ai/VISUAL_GUIDE.md](./components/ai/VISUAL_GUIDE.md) - Visual design guide

---

**Time to build: 2-3 hours**  
**Result: Production-ready component library**  
**One voice. One system. One pattern.** ✅
