# Sidebar Navigation - Elite Design Documentation

## 🎯 Vision

The sidebar is the **primary navigation layer** - it must be:
- **Hierarchical** - Clear sections representing layers of thinking
- **Polished** - Elite visual design with attention to detail
- **Smart** - Context-aware and behaviorally intelligent
- **Calm** - Professional, not playful

---

## 📐 Structure (LOCKED)

### 4-Section Hierarchy

```
🟣 REGIE (Daily work) - 80% user time
├─ Regiekamer
├─ Casussen
└─ Acties (badge: 12)

🔵 NETWERK (System understanding) - Exploration + governance
├─ Zorgaanbieders
├─ Gemeenten
└─ Regio's

🟡 STURING (Control & monitoring) - Insights + oversight
├─ Signalen (badge: 5)
└─ Rapportages

⚙️ INSTELLINGEN (Secondary) - Low frequency
├─ Documenten
├─ Audittrail
└─ Instellingen
```

---

## 🎨 Visual Design (ELITE)

### 1. Section Labels

**Purpose:** Separate layers of thinking

**Design:**
```
Text: "REGIE" (all caps)
Font: Inter Semibold 12px
Transform: Uppercase
Letter spacing: 0.8px
Color: rgba(255, 255, 255, 0.35) (very low contrast)
Margin top: 28px (first section: 0)
Margin bottom: 12px
Padding left: 12px
```

**Why:**
- Small caps create hierarchy without being loud
- Low contrast keeps focus on items, not labels
- Spacing creates breathing room between sections

---

### 2. Nav Items (Default State)

**Design:**
```
Container:
  Width: 100%
  Padding: 10px 12px
  Border radius: 8px
  Gap: 12px (icon to text)
  Background: Transparent
  Cursor: Pointer

Icon:
  Size: 20x20px
  Stroke width: 2px (consistent)
  Color: rgba(255, 255, 255, 0.60) (muted)

Text:
  Font: Inter Medium 14px
  Color: rgba(255, 255, 255, 0.60) (muted)
  White space: nowrap

Transition: All 200ms ease
```

---

### 3. Nav Items (Hover State)

**Purpose:** Subtle feedback, calm interaction

**Design:**
```
Background: rgba(139, 92, 246, 0.05) (very light purple)
Icon color: rgba(255, 255, 255, 0.90) (brighter)
Text color: rgba(255, 255, 255, 0.90) (brighter)

Transition: 200ms ease

NO:
  ❌ Scale effects
  ❌ Slide animations
  ❌ Icon changes
```

**Why:**
- Calm, professional feel
- Just enough feedback
- No animation overkill

---

### 4. Nav Items (Active State) - CRITICAL

**Purpose:** Make it feel "selected", not just "colored"

**Design:**
```
Background: rgba(139, 92, 246, 0.10) (soft purple)
Border: 1px solid rgba(139, 92, 246, 0.20) (subtle glow)
Shadow: 0 2px 8px rgba(139, 92, 246, 0.20) (soft glow)

Icon color: #8B5CF6 (primary, full saturation)
Text color: #8B5CF6 (primary, full saturation)

Badge (if present):
  Background: #8B5CF6 (primary)
  Text: White
  Font weight: Bold
```

**Why:**
- Background + border + glow = feels selected
- Icon and text both highlighted for clarity
- Badge becomes primary color to match theme
- Stands out without being aggressive

**Comparison:**
```
❌ Just background: Flat, boring
❌ Just color: Not enough emphasis
✅ Background + border + glow + color: Elite
```

---

### 5. Spacing System (CRITICAL)

**Between Sections:**
```
First section (REGIE): 0px margin-top
Other sections: 28px margin-top (collapsed: 24px)

Why: Creates visual separation = layers of thinking
```

**Between Items:**
```
Gap: 8px

Why: Enough separation for clarity, not too sparse
```

**Section Label to Items:**
```
Margin bottom: 12px

Why: Groups items under their label
```

**Sidebar Padding:**
```
Vertical: 24px
Horizontal (navigation area): 12px
Horizontal (header/footer): 20px

Why: Breathing room around content
```

---

### 6. Notification Badges

**Placement:**
- Acties: 12 (actions pending)
- Signalen: 5 (signals requiring attention)

**Design (Expanded):**
```
Container:
  Padding: 2px 8px
  Border radius: 9999px (full pill)
  Font: Inter Bold 12px
  
Default state:
  Background: rgba(239, 68, 68, 0.10)
  Text: #EF4444 (red)
  
Active state:
  Background: #8B5CF6 (primary)
  Text: White
```

**Design (Collapsed):**
```
Position: Absolute, top-right of icon button
Size: 20x20px
Background: #EF4444 (red, solid)
Text: White, Bold, 11px
Border radius: 50%
Center aligned
```

**Why:**
- Red (not purple) = urgency
- Only on action-required items
- When active, becomes primary color to match theme
- Collapsed: absolute positioning keeps badge visible

---

## 🧠 Icon System

### Icon Family

**Library:** Lucide React

**Why:**
- Consistent stroke width (2px)
- Same design language
- Professional, not playful
- Wide coverage

---

### Icon Mapping

```
REGIE (Directional / Control):
  Regiekamer:    LayoutDashboard (control center)
  Casussen:      FileText (documents/cases)
  Acties:        CheckSquare (tasks/checkmarks)

NETWERK (Nodes / Connections):
  Zorgaanbieders: Building2 (organizations)
  Gemeenten:      MapPin (locations)
  Regio's:        Map (geographical)

STURING (Alerts / Analytics):
  Signalen:      AlertTriangle (warnings)
  Rapportages:   BarChart3 (analytics)

INSTELLINGEN (System / Admin):
  Documenten:    FolderOpen (files)
  Audittrail:    History (time/logs)
  Instellingen:  Settings (config)
```

**Rules:**
- ✅ Same stroke width (2px)
- ✅ Same size (20x20px)
- ✅ Semantic grouping (directional, nodes, alerts, system)
- ❌ No mixing outline + filled icons
- ❌ No custom icons (breaks consistency)

---

## ⚡ Behavior (SMART)

### 1. Collapse/Expand

**Collapsed State:**
```
Width: 80px (down from 256px)
Section labels: Hidden
Item labels: Hidden
Icons: Visible (centered)
Badges: Absolute positioned (visible)
Tooltips: Show on hover

Transition: 300ms ease-in-out
```

**Tooltip (Collapsed):**
```
Trigger: Hover over icon
Position: Right of icon (ml-2)
Background: Card
Border: 1px solid Border
Padding: 8px 12px
Shadow: Large
Font: Inter Medium 14px

Content:
  - Item label
  - Badge (if present)
```

**Toggle Button:**
```
Position: Top-right of header
Icon: ChevronLeft (expanded) / ChevronRight (collapsed)
Size: 18px
Hover: bg-muted/30
```

---

### 2. Context Awareness

**When user is in a case detail:**
```
Highlight: "Casussen" (parent level)
NOT: Individual workflow steps (they don't exist in sidebar)

Why: User is within the Casussen context
```

**Implementation:**
```typescript
const getActiveItem = (currentRoute: string) => {
  if (currentRoute.startsWith("/casussen")) return "casussen";
  if (currentRoute.startsWith("/regiekamer")) return "regiekamer";
  if (currentRoute.startsWith("/acties")) return "acties";
  // etc.
  
  return currentRoute.split("/")[1]; // fallback to first segment
};
```

---

### 3. Notification Logic

**Acties Badge:**
```
Count: Number of pending actions
Source: Sum of:
  - Incomplete aanbieder beoordelingen
  - Unconfirmed placements
  - Overdue tasks
  - Blocked cases requiring action

Update: Real-time
Color: Red (urgent)
```

**Signalen Badge:**
```
Count: Number of active signals
Source: Sum of:
  - Capacity shortages
  - High wait times
  - System anomalies
  - Critical alerts

Update: Real-time
Color: Red (urgent)
```

**Other Items:**
```
NO badges

Why: Only action-required items get badges
```

---

## 📏 Measurements

### Expanded Sidebar

```
Width: 256px
Height: 100vh

Header:
  Height: 64px
  Padding: 20px
  Border bottom: 1px

Navigation:
  Padding vertical: 24px
  Padding horizontal: 12px
  Overflow: auto

Footer:
  Padding: 12px
  Border top: 1px

Nav Item:
  Height: 40px (auto, based on padding)
  Padding: 10px 12px
  Border radius: 8px
  Gap: 12px

Section:
  Label height: Auto
  Margin top: 28px (first: 0)
  Margin bottom: 12px
  
Item spacing: 8px
```

### Collapsed Sidebar

```
Width: 80px

Icon button:
  Size: 40x40px
  Icon: 20x20px (centered)
  Padding: 10px

Tooltip:
  Offset: 8px left
  Max width: 200px
  Padding: 8px 12px

Badge (absolute):
  Size: 20x20px
  Position: -4px top, -4px right
```

---

## 🎨 Color Specifications

### Section Colors (for reference, not applied)

```
REGIE: Purple #8B5CF6
NETWERK: Blue #3B82F6
STURING: Amber #F59E0B
INSTELLINGEN: Muted rgba(255,255,255,0.60)
```

**Note:** Colors are for conceptual grouping, not applied to UI (would be too colorful)

---

### Component Colors

```
Default state:
  Icon: rgba(255, 255, 255, 0.60)
  Text: rgba(255, 255, 255, 0.60)
  Background: Transparent

Hover state:
  Icon: rgba(255, 255, 255, 0.90)
  Text: rgba(255, 255, 255, 0.90)
  Background: rgba(139, 92, 246, 0.05)

Active state:
  Icon: #8B5CF6
  Text: #8B5CF6
  Background: rgba(139, 92, 246, 0.10)
  Border: 1px solid rgba(139, 92, 246, 0.20)
  Shadow: 0 2px 8px rgba(139, 92, 246, 0.20)

Badge (default):
  Background: rgba(239, 68, 68, 0.10)
  Text: #EF4444

Badge (active):
  Background: #8B5CF6
  Text: White
```

---

## 🔤 Typography

```
Logo Title:
  Font: Inter Bold 18px
  Color: #FFFFFF

Logo Subtitle:
  Font: Inter Regular 12px
  Color: rgba(255, 255, 255, 0.60)

Section Labels:
  Font: Inter Semibold 12px
  Transform: Uppercase
  Letter spacing: 0.8px
  Color: rgba(255, 255, 255, 0.35)

Nav Items:
  Font: Inter Medium 14px
  Color: Dynamic (see above)

Badges:
  Font: Inter Bold 12px (expanded)
         Inter Bold 11px (collapsed)

User Name:
  Font: Inter Medium 14px
  Color: #FFFFFF

User Role:
  Font: Inter Regular 12px
  Color: rgba(255, 255, 255, 0.60)

Tooltips:
  Font: Inter Medium 14px
  Color: #FFFFFF
```

---

## 🎬 Transitions

```
Nav Item:
  Properties: background-color, color
  Duration: 200ms
  Easing: ease

Sidebar Width:
  Property: width
  Duration: 300ms
  Easing: ease-in-out

Tooltip:
  Properties: opacity, visibility
  Duration: 200ms
  Easing: ease
  Delay: None

Badge:
  No transition (instant)
```

---

## ♿ Accessibility

### Keyboard Navigation

```
Tab: Navigate between items
Enter/Space: Activate item
Arrow ↑↓: Navigate within section
Arrow ←→: Collapse/expand sidebar
Esc: Close tooltips (if manually triggered)
```

### ARIA Labels

```
Sidebar:
  role="navigation"
  aria-label="Main navigation"

Nav Items:
  role="link" or "button"
  aria-current="page" (if active)
  aria-label="{Item name}" (if collapsed)

Collapse Button:
  aria-label="Collapse sidebar" or "Expand sidebar"
  aria-expanded="true" or "false"

Badges:
  aria-label="{Count} pending {item name}"
  Example: "12 pending actions"
```

### Screen Reader

**Nav Item:**
```
"Regiekamer, link, current page" (if active)
"Casussen, link" (if inactive)
"Acties, link, 12 pending actions" (with badge)
```

**Collapsed Tooltip:**
```
"Acties, 12 pending actions" (on hover)
```

---

## 📱 Responsive Behavior

### Desktop (1920px)

```
Sidebar: Expanded by default
Width: 256px
All features visible
```

### Laptop (1440px)

```
Sidebar: Expanded by default
Width: 256px
Scrollable navigation if needed
```

### Tablet (1024px)

```
Sidebar: Collapsed by default
Width: 80px
Tooltips on hover
Expandable on click
```

### Mobile (<768px)

```
Sidebar: Hidden by default
Hamburger menu to toggle
Overlay mode (covers content)
Full screen when expanded
```

**Note:** Mobile implementation not included in current component (future enhancement)

---

## 🎯 User Experience

### Opening the App

**Default state:**
```
Sidebar: Expanded
Active: "Regiekamer" (default landing page)
Badges visible: Acties (12), Signalen (5)
```

**User sees immediately:**
- 4 clear sections
- Current location highlighted (Regiekamer)
- Pending actions (12) and signals (5)

**Time to orientation:** <2 seconds

---

### Navigating

**Click "Casussen":**
```
1. Item highlights (purple background + border + glow)
2. Icon and text turn primary purple
3. Page navigates to /casussen
4. Content updates
```

**Time to navigate:** Instant (no loading, just highlight)

---

### Collapsed Mode

**Click collapse button:**
```
1. Sidebar width animates: 256px → 80px (300ms)
2. Labels fade out
3. Icons center-align
4. Badges reposition to top-right
```

**Hover over icon:**
```
1. Tooltip appears after 0ms (instant)
2. Shows label + badge
3. Positioned to right of icon
```

**Time to understand:** <1 second

---

## 📊 Component Props

### Sidebar Component

```typescript
interface SidebarProps {
  activeItemId?: string;           // Current active page
  onNavigate?: (itemId: string, href: string) => void;  // Navigation callback
  className?: string;               // Additional classes
  defaultCollapsed?: boolean;       // Start collapsed
}
```

**Usage:**
```tsx
<Sidebar
  activeItemId="regiekamer"
  onNavigate={(itemId, href) => {
    router.push(href);
  }}
/>
```

---

### Navigation Structure

```typescript
interface NavItem {
  id: string;                       // Unique identifier
  label: string;                    // Display name
  icon: React.ComponentType;        // Lucide icon component
  badge?: number;                   // Optional badge count
  href?: string;                    // Route path
}

interface NavSection {
  id: string;                       // Section identifier
  label: string;                    // Section name (REGIE, NETWERK, etc.)
  color: string;                    // Conceptual color (not applied)
  items: NavItem[];                 // Items in section
}
```

---

## 🎓 Design Principles Applied

✅ **Hierarchy** - 4 sections = layers of thinking  
✅ **Polish** - Active state with bg + border + glow  
✅ **Calm** - Subtle hover, no animation overkill  
✅ **Consistent** - Same icon family, stroke width, sizing  
✅ **Smart** - Context awareness, intelligent badges  
✅ **Accessible** - Full keyboard nav, ARIA labels, screen reader support  

---

## 💡 Why This Design Works

### 1. Visual Hierarchy

```
Section labels (small, muted)
  ↓ Creates separation
Nav items (medium, clear)
  ↓ Primary navigation
Active state (highlighted)
  ↓ Current location
```

**Result:** User scans top-to-bottom, finds location in <2 seconds

---

### 2. Active State Design

**Most sidebars:**
```
❌ Just background color
❌ Just text color
❌ No distinction from hover
```

**This sidebar:**
```
✅ Background (soft purple)
✅ Border (subtle glow)
✅ Shadow (depth)
✅ Icon + text color (primary)

= Feels selected, not just colored
```

---

### 3. Spacing Creates Clarity

**Too tight:**
```
❌ Items blend together
❌ Hard to scan
❌ Feels cramped
```

**This sidebar:**
```
✅ 28px between sections (breathing room)
✅ 8px between items (clear separation)
✅ 12px padding inside items (clickable area)

= Easy to scan, calm, professional
```

---

### 4. Badge Strategy

**Most apps:**
```
❌ Badges everywhere
❌ Visual noise
❌ Desensitization
```

**This sidebar:**
```
✅ ONLY on Acties and Signalen
✅ Red color (urgent)
✅ Becomes primary when active (thematic consistency)

= User knows exactly where action is needed
```

---

## 🚀 Implementation Notes

### State Management

```typescript
const [collapsed, setCollapsed] = useState(false);

// Persist collapsed state
useEffect(() => {
  localStorage.setItem('sidebar-collapsed', collapsed.toString());
}, [collapsed]);

// Restore on mount
useEffect(() => {
  const saved = localStorage.getItem('sidebar-collapsed');
  if (saved) setCollapsed(saved === 'true');
}, []);
```

---

### Badge Updates

```typescript
// Real-time badge updates
const [actiesBadge, setActiesBadge] = useState(0);
const [signalenBadge, setSignalenBadge] = useState(0);

useEffect(() => {
  // Subscribe to real-time updates
  const unsubscribe = subscribeToActions((count) => {
    setActiesBadge(count);
  });
  
  return unsubscribe;
}, []);
```

---

### Route Detection

```typescript
// Detect active item from route
const router = useRouter();
const activeItemId = getActiveItemFromRoute(router.pathname);

function getActiveItemFromRoute(pathname: string): string {
  if (pathname.startsWith("/casussen")) return "casussen";
  if (pathname.startsWith("/regiekamer")) return "regiekamer";
  // ... etc
  
  return pathname.split("/")[1] || "regiekamer";
}
```

---

## 📚 Files Created

```
Implementation:
  /components/navigation/Sidebar.tsx

Examples:
  /components/examples/SidebarDemo.tsx

Documentation:
  /SIDEBAR_NAVIGATION_DOCS.md (this file)
```

---

## ✅ Checklist

**Structure:**
- [x] 4 sections (REGIE, NETWERK, STURING, INSTELLINGEN)
- [x] Correct items in each section
- [x] Badges on Acties (12) and Signalen (5)

**Visual Design:**
- [x] Section labels: small caps, low contrast
- [x] Spacing: 28px between sections, 8px between items
- [x] Active state: bg + border + shadow + color
- [x] Hover state: subtle purple bg
- [x] Consistent icon family and sizing

**Behavior:**
- [x] Collapse/expand with smooth transition
- [x] Tooltips when collapsed
- [x] Badges reposition in collapsed mode
- [x] Context awareness (activeItemId)

**Polish:**
- [x] Typography hierarchy
- [x] Smooth transitions (200-300ms)
- [x] Professional, calm feel
- [x] No animation overkill

---

## 🎉 Result

**An elite sidebar that:**

1. **Guides** - 4 sections = layers of thinking
2. **Highlights** - Active state impossible to miss
3. **Alerts** - Badges only where needed (Acties, Signalen)
4. **Adapts** - Collapses gracefully, tooltips appear
5. **Polishes** - Every detail refined (spacing, colors, transitions)

**This is not just a menu. It's an intelligent navigation layer.** ✅
