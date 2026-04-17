# Multi-Tenant Platform - Complete Documentation

## 🎯 Vision

Transform Careon from a **single-tenant application** into a **multi-tenant platform** where:

- **Gemeenten** (municipalities) manage care allocation
- **Zorgaanbieders** (care providers) receive and manage intake
- **Admins** oversee the entire system

**Critical insight:** The role/context switcher makes the system feel like a platform, not just an app.

---

## 📐 Architecture

### Two-Layer System

```
LAYER 1: ROLE/CONTEXT (Top Bar)
├─ Defines WHO you are
├─ Switches between organizations
└─ Persists across navigation

LAYER 2: NAVIGATION (Sidebar)
├─ Adapts to role
├─ Shows relevant pages only
└─ Different per user type
```

---

## 🎨 Top Bar Design

### Structure (Left → Right)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Role Switcher] [Global Search] [Notifications] [Account]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 1. Role/Context Switcher (LEFT - CRITICAL)

**Purpose:** Switch between organizations/roles instantly

**Visual Design:**
```
┌──────────────────────────┐
│ [Icon] GEMEENTE          │
│        Utrecht         ▾ │
└──────────────────────────┘
```

**Components:**
```
Icon container:
  Width: 32px
  Height: 32px
  Border radius: 8px
  Background: rgba(139, 92, 246, 0.10)
  Border: 1px rgba(139, 92, 246, 0.20)
  
  Icon:
    Size: 16px
    Color: #8B5CF6 (primary)
    Type: MapPin (gemeente), Building2 (provider), Shield (admin)

Text container:
  Label (small caps):
    Font: Inter Semibold 12px
    Transform: Uppercase
    Letter spacing: 0.8px
    Color: rgba(255, 255, 255, 0.60)
    
  Name (bold):
    Font: Inter Bold 14px
    Color: #FFFFFF

Dropdown icon:
  ChevronDown 14px
  Color: rgba(255, 255, 255, 0.60)
  Rotate 180° when open
```

---

**Dropdown:**
```
┌────────────────────────────────────────┐
│ [Icon] GEMEENTE                        │
│        Utrecht                      ● │
│                                        │
│ [Icon] GEMEENTE                        │
│        Amsterdam                       │
│                                        │
│ [Icon] ZORGAANBIEDER                   │
│        Horizon Jeugdzorg               │
│                                        │
│ [Icon] ADMIN                           │
│        Systeem Beheer                  │
└────────────────────────────────────────┘
```

**Active state:**
```
Background: rgba(139, 92, 246, 0.10)
Border: 1px rgba(139, 92, 246, 0.20)
Text: Primary purple
Indicator: Purple dot (right side)
```

**Why this is critical:**

Without context switcher:
```
❌ Feels like single-tenant app
❌ Limited to one organization
❌ No sense of scale
```

With context switcher:
```
✅ Feels like a platform
✅ Multi-org capability visible
✅ Professional, scalable system
```

---

### 2. Global Search (CENTER)

**Purpose:** Search across cases, clients, providers

**Design:**
```
Width: 100% (max 600px)
Height: 40px
Padding: 0 12px 0 40px
Border radius: 8px
Background: rgba(255, 255, 255, 0.05)
Border: rgba(255, 255, 255, 0.10)

Placeholder:
  "Zoek casussen, cliënten, aanbieders..."
  Font: Inter Regular 14px
  Color: rgba(255, 255, 255, 0.40)

Icon (left):
  Search 18px
  Position: Absolute left 12px
  Color: rgba(255, 255, 255, 0.60)
```

**Future enhancement:**
```
Quick results dropdown:
- Recent searches
- Suggested results
- Jump directly to:
  - Case detail
  - Provider profile
  - Municipality
```

---

### 3. Notifications (RIGHT)

**Purpose:** Action-required notifications only

**Design:**
```
Icon button:
  Size: 40x40px
  Border radius: 8px
  Bell icon 20px
  Color: rgba(255, 255, 255, 0.60)
  Hover: rgba(139, 92, 246, 0.05) background

Badge (when count > 0):
  Position: Absolute top-right (-4px, -4px)
  Size: 20x20px
  Background: #EF4444 (red)
  Border radius: 50%
  Font: Inter Bold 11px
  Text: White
  Content: Count (9+ if >9)
```

**What goes here:**
```
✅ New case assigned
✅ Provider response
✅ Intake scheduled
✅ Approval needed

❌ NOT system messages
❌ NOT newsletters
❌ NOT general updates
```

**Why selective:**
- Only actionable items
- User takes action or dismisses
- No notification fatigue

---

### 4. Account (RIGHT)

**Purpose:** User profile and logout

**Design:**
```
┌──────────────────────────┐
│ [Avatar] Jane Doe        │
│          Regisseur     ▾ │
└──────────────────────────┘
```

**Avatar:**
```
Size: 32x32px
Border radius: 50%

With image:
  Display: User photo

Without image (fallback):
  Background: rgba(139, 92, 246, 0.20)
  Text: Initials (e.g., "JD")
  Font: Inter Bold 12px
  Color: #8B5CF6 (primary)
```

**Dropdown:**
```
┌────────────────────────────┐
│ Jane Doe                   │
│ Regisseur                  │
├────────────────────────────┤
│ [Icon] Profiel             │
│ [Icon] Instellingen        │
├────────────────────────────┤
│ [Icon] Uitloggen           │
└────────────────────────────┘
```

**Logout item:**
```
Hover background: rgba(239, 68, 68, 0.10)
Icon color: #EF4444 (red)
Text color: #EF4444 (red)
```

---

### Top Bar Measurements

```
Height: 64px
Padding: 0 24px
Border bottom: 1px rgba(255, 255, 255, 0.10)
Background: Card (same as sidebar)
Position: Sticky top 0
Z-index: 40

Spacing between elements:
  Role switcher → Search: 32px
  Search → Notifications: 32px
  Divider (1px vertical): 32px height, muted
  Notifications → Account: 12px
```

---

## 🗂️ Role-Based Sidebar

### Three Navigation Configurations

---

### 1. GEMEENTE (Full Access - Primary User)

**Purpose:** Municipality manages entire care allocation process

**Sidebar:**
```
🟣 REGIE
├─ Regiekamer
├─ Casussen
└─ Acties [12]

🔵 NETWERK
├─ Zorgaanbieders
├─ Gemeenten
└─ Regio's

🟡 STURING
├─ Signalen [5]
└─ Rapportages

⚙️ INSTELLINGEN
├─ Documenten
├─ Audittrail
└─ Instellingen
```

**What they can do:**
- ✅ View regiekamer (control center)
- ✅ Manage all cases
- ✅ See all actions
- ✅ Browse providers
- ✅ Monitor regions
- ✅ View signals
- ✅ Generate reports
- ✅ Access audit trail

**What they CAN'T do:**
- ❌ Manage users (admin only)

---

### 2. ZORGAANBIEDER (Limited Access)

**Purpose:** Care provider receives intake and manages assigned cases

**Sidebar:**
```
🟣 WERK
├─ Intake [3]
└─ Mijn casussen

⚙️ INSTELLINGEN
└─ Documenten
```

**What they can do:**
- ✅ View intake requests
- ✅ Accept/decline intake
- ✅ Manage their assigned cases
- ✅ Access case documents

**What they CAN'T do:**
- ❌ See regiekamer
- ❌ Browse all cases
- ❌ View other providers
- ❌ Access regions/municipalities
- ❌ See system signals
- ❌ Generate reports
- ❌ View audit trail

**Why limited:**
- Providers receive work, don't manage the system
- Need focus on their cases only
- Simplified workflow

---

### 3. ADMIN (Full Access + Extras)

**Purpose:** System administrator oversees entire platform

**Sidebar:**
```
🟣 REGIE
├─ Regiekamer
├─ Casussen
└─ Acties [12]

🔵 NETWERK
├─ Zorgaanbieders
├─ Gemeenten
└─ Regio's

🟡 STURING
├─ Signalen [5]
└─ Rapportages

🔴 BEHEER
├─ Gebruikers
├─ Audittrail
└─ Instellingen
```

**What they can do:**
- ✅ Everything gemeente can do
- ✅ **Manage users** (extra)
- ✅ View cross-organization data
- ✅ System configuration

**New section: BEHEER**
```
Gebruikers:
  - Manage all users
  - Assign roles
  - Control permissions
  - Deactivate accounts

Audittrail:
  - System-wide audit log
  - User actions
  - Data changes
  - Security events

Instellingen:
  - System configuration
  - Integration settings
  - Feature flags
```

---

## 🎯 Role Switching Behavior

### When User Switches Role

**Example: Switch from "Gemeente Utrecht" to "Zorgaanbieder Horizon"**

**What happens:**
```
1. Context updates (top bar shows new organization)
2. Sidebar regenerates (different navigation)
3. Page resets to appropriate home:
   - Gemeente → Regiekamer
   - Zorgaanbieder → Intake
   - Admin → Regiekamer
4. Data filters by new context
```

**Implementation:**
```typescript
const handleContextSwitch = (contextId: string) => {
  const newContext = contexts.find(c => c.id === contextId);
  
  if (newContext) {
    // Update context
    setCurrentContext(newContext);
    
    // Reset to home page for role
    if (newContext.type === "zorgaanbieder") {
      setCurrentPage("intake");
    } else {
      setCurrentPage("regiekamer");
    }
    
    // Clear any case-specific state
    setSelectedCase(null);
    setSelectedProvider(null);
  }
};
```

---

## 🎨 Visual Design Specifications

### Top Bar

```
Container:
  Height: 64px
  Background: hsl(var(--card))
  Border bottom: 1px hsl(var(--border))
  Padding: 0 24px
  Position: Sticky
  Top: 0
  Z-index: 40

Role Switcher:
  Gap: 12px (icon to text)
  Padding: 8px 12px
  Border radius: 8px
  Hover: rgba(255, 255, 255, 0.05)
  Transition: 200ms ease

Search:
  Width: 100% (max 600px)
  Padding: 0 12px 0 40px
  Background: rgba(255, 255, 255, 0.05)
  Border: 1px rgba(255, 255, 255, 0.10)
  Focus: Background rgba(255, 255, 255, 0.08)

Notifications:
  Size: 40x40px
  Padding: 10px
  Border radius: 8px
  Hover: rgba(139, 92, 246, 0.05)

Account:
  Gap: 12px (avatar to text)
  Padding: 8px 12px
  Border radius: 8px
  Hover: rgba(255, 255, 255, 0.05)
```

---

### Dropdowns

```
Container:
  Width: 288px (role), 224px (account)
  Background: hsl(var(--card))
  Border: 1px hsl(var(--border))
  Border radius: 12px
  Shadow: 0 8px 32px rgba(0, 0, 0, 0.4)
  Padding: 8px
  Z-index: 50

Backdrop:
  Position: Fixed
  Inset: 0
  Z-index: 40
  Click to close

Item:
  Width: 100%
  Padding: 10px 12px
  Border radius: 8px
  Hover: rgba(255, 255, 255, 0.05)
  Transition: 200ms ease

Active item (role switcher):
  Background: rgba(139, 92, 246, 0.10)
  Border: 1px rgba(139, 92, 246, 0.20)
  Text: Primary
  Indicator: Purple dot 8px
```

---

### Sidebar (Role-Based)

**Same design as before, but:**
```
Navigation structure: Dynamic (based on role)
Sections: Different per role
Items: Filtered by permissions
```

**Gemeente sidebar:**
- 4 sections (REGIE, NETWERK, STURING, INSTELLINGEN)
- 11 items total

**Zorgaanbieder sidebar:**
- 2 sections (WERK, INSTELLINGEN)
- 3 items total

**Admin sidebar:**
- 4 sections (REGIE, NETWERK, STURING, BEHEER)
- 12 items total (includes Gebruikers)

---

## 🔤 Typography

```
Role Switcher:
  Label: Inter Semibold 12px, uppercase, tracking 0.8px
  Name: Inter Bold 14px

Search:
  Placeholder: Inter Regular 14px
  Input: Inter Regular 14px

Notification Badge:
  Count: Inter Bold 11px

Account:
  Name: Inter Semibold 14px
  Role: Inter Regular 12px

Dropdowns:
  Section header: Inter Semibold 12px
  Item label: Inter Regular 14px
  Item subtitle: Inter Regular 12px
```

---

## 🎯 User Flows

### Scenario 1: Gemeente User Checks Cases

**Flow:**
```
1. Opens app
2. Sees: "GEMEENTE Utrecht" (top-left)
3. Sidebar shows: Full navigation (11 items)
4. Lands on: Regiekamer
5. Clicks: "Casussen" in sidebar
6. Sees: All cases for Utrecht
```

**Time:** <3 seconds to navigate

---

### Scenario 2: Provider Receives Intake

**Flow:**
```
1. Opens app
2. Sees: "ZORGAANBIEDER Horizon Jeugdzorg" (top-left)
3. Sidebar shows: Limited navigation (3 items)
4. Lands on: Intake (default for providers)
5. Sees: 3 nieuwe intake verzoeken
6. Badge on "Intake" shows: [3]
7. Clicks intake → Reviews → Accepts/Declines
```

**Time:** <5 seconds to see new intake

---

### Scenario 3: User Switches Organization

**Flow:**
```
1. User is: "Gemeente Utrecht"
2. Clicks: Role switcher (top-left)
3. Dropdown opens: 4 available contexts
4. Clicks: "Gemeente Amsterdam"
5. Context updates: "GEMEENTE Amsterdam"
6. Sidebar: Same structure (gemeente role)
7. Page resets: Regiekamer (for Amsterdam)
8. Data filters: Amsterdam cases only
```

**Time:** <2 seconds to switch

---

### Scenario 4: Admin Manages Users

**Flow:**
```
1. User is: "Admin"
2. Sidebar shows: Extra "BEHEER" section
3. Clicks: "Gebruikers"
4. Sees: User management page (admin only)
5. Can: Add users, assign roles, control permissions
```

**Access:** Admin only

---

## 📊 Data Structure

### Context Object

```typescript
interface Context {
  id: string;              // Unique identifier
  type: RoleType;          // "gemeente" | "zorgaanbieder" | "admin"
  name: string;            // Display name
  subtitle?: string;       // Additional info
}

type RoleType = "gemeente" | "zorgaanbieder" | "admin";
```

**Examples:**
```typescript
const contexts: Context[] = [
  {
    id: "gemeente-utrecht",
    type: "gemeente",
    name: "Utrecht",
    subtitle: "Gemeente"
  },
  {
    id: "provider-horizon",
    type: "zorgaanbieder",
    name: "Horizon Jeugdzorg",
    subtitle: "Zorgaanbieder"
  },
  {
    id: "admin-system",
    type: "admin",
    name: "Systeem Beheer",
    subtitle: "Administrator"
  }
];
```

---

### Navigation Permissions

```typescript
const getNavigationForRole = (role: RoleType): NavSection[] => {
  switch (role) {
    case "gemeente":
      return gemeenteNavigation;    // Full access
    case "zorgaanbieder":
      return zorgaanbiederNavigation; // Limited
    case "admin":
      return adminNavigation;        // Full + extras
  }
};
```

---

## ♿ Accessibility

### Role Switcher

```
Button:
  aria-label: "Switch organization"
  aria-expanded: "true" | "false"
  aria-haspopup: "menu"

Dropdown:
  role: "menu"
  aria-orientation: "vertical"

Items:
  role: "menuitem"
  aria-selected: "true" | "false" (for active context)
```

**Screen reader:**
```
"Switch organization button, expanded false"
[Click]
"Menu, 4 items"
"Municipality Utrecht, selected"
"Municipality Amsterdam"
"Care provider Horizon Jeugdzorg"
"Administrator System Management"
```

---

### Account Dropdown

```
Similar ARIA structure to role switcher

Screen reader:
"Account menu button, Jane Doe, Regisseur"
[Click]
"Menu, 4 items"
"Profile"
"Settings"
"Separator"
"Logout"
```

---

### Notifications

```
Button:
  aria-label: "Notifications" (if 0)
  aria-label: "Notifications, 7 unread" (if >0)

Badge:
  aria-hidden: "true" (decorative)
```

---

## 🎓 Design Principles Applied

✅ **Multi-Tenancy** - Role switcher makes it feel like a platform  
✅ **Role-Based Access** - Navigation adapts to user permissions  
✅ **Context Awareness** - System knows WHO you are at all times  
✅ **Professional** - Clean, structured, elite design  
✅ **Efficient** - <2 seconds to switch context  
✅ **Scalable** - Easy to add new roles or organizations  

---

## 💡 Why This Design Works

### 1. Role Switcher (Platform Feel)

**Without it:**
```
❌ Single organization only
❌ Feels like basic app
❌ No sense of scale
```

**With it:**
```
✅ Multi-org visible immediately
✅ Feels like enterprise platform
✅ Professional, scalable
```

---

### 2. Role-Based Sidebar

**Instead of hiding items with permissions:**
```
❌ Gemeente user sees "Intake" (grayed out)
❌ Confusing - why can't I click?
❌ Cluttered with unavailable options
```

**With role-based navigation:**
```
✅ Gemeente user ONLY sees relevant items
✅ Clear - these are my options
✅ Clean - no clutter
```

---

### 3. Context-Driven Data

**Everything filters by current context:**
```
Gemeente Utrecht:
  → Shows Utrecht cases
  → Utrecht providers
  → Utrecht regions

Zorgaanbieder Horizon:
  → Shows Horizon intake
  → Horizon assigned cases
  → Horizon documents
```

**Result:** No confusion about what data you're seeing

---

## 📚 Files Created

```
Implementation:
  /components/navigation/TopBar.tsx
  /components/navigation/Sidebar.tsx (updated with roles)

Examples:
  /components/examples/MultiTenantDemo.tsx

Documentation:
  /MULTI_TENANT_PLATFORM_DOCS.md (this file)
```

---

## 🎉 Result

### What We've Built

**A multi-tenant platform where:**

1. **Role switcher** (top-left) shows WHO you are
2. **Sidebar** adapts to your permissions
3. **Data** filters by your organization
4. **Switching** is instant (<2 seconds)

---

### User Experience

**Opens app:**

**Immediate understanding:**
- "I am: Gemeente Utrecht" (top-left)
- "I can access: Regiekamer, Casussen, Acties, etc." (sidebar)
- "I have: 12 actions pending, 5 signals" (badges)

**Switches to provider:**

**Immediate change:**
- "I am now: Zorgaanbieder Horizon" (top-left updates)
- "I can access: Intake, Mijn casussen, Documenten" (sidebar regenerates)
- "I have: 3 nieuwe intake verzoeken" (badge)

---

### Platform Characteristics

✅ **Multi-tenant** - Support multiple organizations  
✅ **Role-based** - Different navigation per user type  
✅ **Context-aware** - System knows current organization  
✅ **Scalable** - Easy to add organizations or roles  
✅ **Professional** - Feels like enterprise SaaS  
✅ **Efficient** - Instant context switching  

---

**This is not just an app. It's a platform.** 🎉
