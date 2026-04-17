# Regio's Page - Complete Documentation

## 🎯 Purpose

The **Regio's** (Regions) page is a **system-level geographical overview** that provides clarity on how the care system is distributed across regions.

**This is NOT a workflow page. It's a structural overview.**

---

## 🔄 User Goals

Users come to this page to:

1. **Understand distribution** - How are cases spread across regions?
2. **Monitor capacity** - Which regions are under pressure?
3. **Identify imbalances** - Where are the shortages or bottlenecks?
4. **Navigate deeper** - Drill into municipalities and providers

---

## 📐 Page Architecture

### Two-Level Structure

```
Level 1: Regio's Overview
├─ System-level statistics
├─ All regions list
├─ Heat visualization
└─ Quick navigation

Level 2: Regio Detail
├─ Region overview
├─ Municipalities in region
├─ Providers in region
└─ Regional signals
```

---

## 📊 Level 1: Regio's Overview

### Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  HEADER                                                          │
│  Regio's                                                         │
│  Overzicht van capaciteit en casussen per regio                 │
├──────────────────────────────────────────────────────────────────┤
│  SYSTEM-LEVEL STATS                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│  │ Totaal  │ │ Systeem │ │ Regio's │ │ Hoge    │             │
│  │ Casussen│ │ Bezetting│ │ Tekort │ │ Wachttijd│             │
│  │   508   │ │   78%   │ │    2    │ │    2     │             │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘             │
├──────────────────────────────────────────────────────────────────┤
│  🤖 SYSTEM INSIGHTS                                             │
│  ⚠️ 2 regio's hebben capaciteitstekort: Utrecht, Eindhoven     │
│  ⚠️ Systeem bezetting is 78% - binnen norm                      │
├──────────────────────────────────────────────────────────────────┤
│  SEARCH + FILTERS                                               │
│  [Search...]  [Capaciteit status ▼]  [Sorteer ▼]              │
├──────────────────────────────────────────────────────────────────┤
│  CAPACITY HEAT VISUALIZATION                                    │
│  Utrecht     ████████████████░░░░  87%                         │
│  Amsterdam   ████████████████░░░░  79%                         │
│  Rotterdam   ████████████░░░░░░░░  65%                         │
│  ...                                                            │
├──────────────────────────────────────────────────────────────────┤
│  REGION CARDS                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ Utrecht      │ │ Amsterdam    │ │ Rotterdam    │          │
│  │ [TEKORT]     │ │ [DRUK]       │ │ [NORMAAL]    │          │
│  │              │ │              │ │              │          │
│  │ 87 casussen  │ │ 132 casussen │ │ 95 casussen  │          │
│  │ 8d wachttijd │ │ 5d wachttijd │ │ 6d wachttijd │          │
│  │              │ │              │ │              │          │
│  │ 26 gemeenten │ │ 15 gemeenten │ │ 18 gemeenten │          │
│  │ 34 aanbieders│ │ 52 aanbieders│ │ 41 aanbieders│          │
│  │              │ │              │ │              │          │
│  │ ████████87%  │ │ ██████79%    │ │ █████65%     │          │
│  │              │ │              │ │              │          │
│  │[Gemeenten][Aanbieders]                                      │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

---

### Components Breakdown

#### 1. System-Level Statistics

**Purpose:** Show overall system health at a glance

**Metrics:**
```
Totaal Casussen:
  Value: Sum of all cases across regions
  Context: Number of regions
  Example: "508 casussen in 6 regio's"

Systeem Bezetting:
  Value: Total used / total capacity (%)
  Context: Actual numbers
  Example: "78% (445 / 570)"
  Warning: >85% triggers alert

Regio's met Tekort:
  Value: Count of regions with "shortage" status
  Context: Which regions
  Example: "2 - Utrecht, Eindhoven"
  Color: Red if >0

Hoge Wachttijd:
  Value: Count of regions with wait time >7 days
  Context: Status message
  Example: "2 regio's >7 dagen gemiddeld"
  Color: Amber if >0
```

---

#### 2. System Insights

**Component:** `SystemInsight` from AI library

**Examples:**
```
⚠️ 2 regio's hebben capaciteitstekort: Utrecht, Eindhoven
⚠️ Systeem bezetting is 85% - boven advies norm
ℹ️ Amsterdam en Rotterdam hebben voldoende capaciteit
```

**Logic:**
```typescript
if (shortageRegions.length > 0) {
  show: "X regio's hebben capaciteitstekort: [names]"
  type: "warning"
}

if (systemUtilization > 85) {
  show: "Systeem bezetting is X% - boven advies norm van 85%"
  type: "warning"
}
```

---

#### 3. Heat Visualization

**Purpose:** Quick visual scan of capacity pressure across regions

**Design:**
```
Region Name      Progress Bar         Percentage

Utrecht          ████████████████░░░░  87%
Amsterdam        ████████████████░░░░  79%
Rotterdam        ████████████░░░░░░░░  65%
Den Haag         ████████████░░░░░░░░  74%
Eindhoven        █████████████████░░░  87%
Groningen        ██████████░░░░░░░░░░  65%
```

**Color Logic:**
```typescript
const utilization = (used / total) * 100;

if (utilization >= 90) return "bg-red-400";     // Critical
if (utilization >= 75) return "bg-amber-400";   // Warning
return "bg-green-400";                          // Normal
```

**Measurements:**
```
Region name: 
  Width: 150px
  Font: Inter Semibold 14px
  Align: Left

Progress bar:
  Width: Fill remaining space
  Height: 8px
  Border radius: 9999px (full)
  Background: rgba(255,255,255,0.10)
  
  Fill:
    Height: 8px
    Border radius: 9999px
    Dynamic width based on %
    Color: Semantic (green/amber/red)

Percentage:
  Width: 50px
  Font: Inter Regular 14px
  Align: Right
  Color: Muted
```

---

#### 4. Region Cards

**Purpose:** Detailed overview of each region

**Card Structure:**
```
┌──────────────────────────────────┐
│ Utrecht                       ↗  │  ← Name + Trend icon
│ [TEKORT]                         │  ← Status badge
│                                  │
│ 87 casussen     8d wachttijd     │  ← Key metrics (2 col)
│                                  │
│ 26 gemeenten    34 aanbieders    │  ← Structure (2 col)
│                                  │
│ Capaciteit              87%      │  ← Capacity label
│ ████████████████████░░░░         │  ← Progress bar
│ 105 / 120 in gebruik             │  ← Detail text
│                                  │
│ [Gemeenten]  [Aanbieders]        │  ← Navigation buttons
└──────────────────────────────────┘
```

**Status Badge:**
```
Normaal (green):
  Label: "Normaal"
  Background: rgba(34, 197, 94, 0.10)
  Border: rgba(34, 197, 94, 0.30)
  Text: #22C55E
  Icon: Activity

Druk (amber):
  Label: "Druk"
  Background: rgba(245, 158, 11, 0.10)
  Border: rgba(245, 158, 11, 0.30)
  Text: #F59E0B
  Icon: Activity

Tekort (red):
  Label: "Tekort"
  Background: rgba(239, 68, 68, 0.10)
  Border: rgba(239, 68, 68, 0.30)
  Text: #EF4444
  Icon: Activity
```

**Capacity Status Logic:**
```typescript
const utilization = (used / total) * 100;

if (utilization >= 90) return "shortage";  // Red
if (utilization >= 75) return "busy";      // Amber
return "normal";                           // Green
```

**Trend Indicator:**
```
Up (red):
  Icon: TrendingUp
  Color: #EF4444
  Meaning: Cases or utilization increasing

Down (green):
  Icon: TrendingDown
  Color: #22C55E
  Meaning: Cases or utilization decreasing

Stable (muted):
  Icon: Activity
  Color: Muted
  Meaning: No significant change
```

---

#### 5. Search and Filters

**Search:**
```
Placeholder: "Zoek regio..."
Icon: Search (left side)
Searches: Region name
Real-time filtering
```

**Capacity Status Filter:**
```
Options:
  - Alle capaciteit statussen
  - Normaal
  - Druk
  - Tekort

Default: "Alle"
```

**Sort Options:**
```
Options:
  - Sorteer op casussen (default)
  - Sorteer op bezetting
  - Sorteer op wachttijd

Logic:
  Cases: Descending (most cases first)
  Capacity: Descending (highest utilization first)
  Wait time: Descending (longest wait first)
```

---

## 📊 Level 2: Regio Detail

### Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP BAR (Sticky)                                                │
│  [← Terug naar regio's]                                          │
├──────────────────────────────────────────────────────────────────┤
│  REGION HEADER                                                   │
│  Utrecht                                             [TEKORT]    │
│                                                                  │
│  87 casussen    87% capaciteit    8d wachttijd    15 beschikbaar│
│                                                                  │
│  Capaciteit verdeling             87% in gebruik                │
│  ████████████████████░░░░                                       │
├──────────────────────────────────────────────────────────────────┤
│  SIGNALEN                                                        │
│  🔴 Capaciteitstekort: 15 casussen zonder beschikbare plekken   │
│  ⚠️ Gemiddelde wachttijd (8 dagen) ligt boven norm             │
│  ℹ️ Gemeente Veenendaal heeft verhoogd aantal casussen         │
├──────────────────────────────────────────────────────────────────┤
│  GEMEENTEN IN UTRECHT                                           │
│  [Filter ▼]                          [Bekijk alle gemeenten →] │
│                                                                  │
│  ┌──────────────────┐ ┌──────────────────┐                     │
│  │ Utrecht (stad)   │ │ Amersfoort       │                     │
│  │ 45 casussen   ●  │ │ 23 casussen   ●  │                     │
│  └──────────────────┘ └──────────────────┘                     │
├──────────────────────────────────────────────────────────────────┤
│  AANBIEDERS IN UTRECHT                                          │
│  [Filter ▼]                          [Bekijk alle aanbieders →]│
│                                                                  │
│  ┌────────────────────────────────────────────────┐            │
│  │ Jeugdzorg Plus Utrecht                         │            │
│  │ Residentieel                    [2 beschikbaar]│            │
│  │ 28 / 30 (93%) ████████████████████░            │            │
│  └────────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────────┘
```

---

### Components Breakdown

#### 1. Region Header

**Key Metrics (4 cards):**
```
Actieve casussen:
  Value: Total cases in region
  Example: 87

Capaciteit:
  Value: Utilization percentage
  Sub: Used / Total
  Example: 87% (105 / 120)

Gem. wachttijd:
  Value: Average waiting time
  Color: Red if >7 days
  Example: 8d

Beschikbare plekken:
  Value: Total - Used
  Color: Red if <10
  Example: 15
```

**Capacity Visualization:**
```
Same as overview level:
  - Progress bar
  - Percentage
  - Detail text
  
Height: 12px (larger than overview)
```

---

#### 2. Signalen (Signals)

**Purpose:** Highlight regional issues and bottlenecks

**Signal Types:**
```
Critical (red):
  Icon: AlertTriangle
  Example: "Capaciteitstekort: 15 casussen zonder beschikbare plekken"
  Trigger: More cases than available spots

Warning (amber):
  Icon: AlertCircle
  Example: "Gemiddelde wachttijd (8 dagen) ligt boven norm van 7 dagen"
  Trigger: Avg wait time >7 days

Info (blue):
  Icon: Info
  Example: "Gemeente Veenendaal heeft verhoogd aantal casussen (+40%)"
  Trigger: Significant trends
```

**Uses:** `SystemInsight` component from AI library

---

#### 3. Gemeenten in Region

**List View:**
```
Each gemeente card:
  - Name (with MapPin icon)
  - Case count
  - Status indicator dot (green/amber/red)
  - Clickable → navigate to gemeente detail
```

**Status Dot:**
```
Normal (green):
  Cases within expected range
  No issues

Busy (amber):
  Higher than average case load
  Watch closely

Problem (red):
  Significant issues
  Capacity concerns or delays
```

**Filters:**
```
Options:
  - Alle gemeenten
  - Normaal
  - Druk
  - Probleem
```

**Navigation:**
```
"Bekijk alle gemeenten" button:
  → Navigates to Gemeenten page
  → Pre-filtered to this region
```

---

#### 4. Providers in Region

**List View:**
```
Each provider card:
  - Name (with Building2 icon)
  - Type (Residentieel, Ambulant, etc.)
  - Available spots badge
  - Capacity bar with percentage
  - Used / Total detail
  - Clickable → navigate to provider profile
```

**Available Spots Badge:**
```
>3 spots (green):
  Background: rgba(34, 197, 94, 0.10)
  Text: #22C55E
  Label: "X beschikbaar"

1-3 spots (amber):
  Background: rgba(245, 158, 11, 0.10)
  Text: #F59E0B
  Label: "X beschikbaar"

0 spots (red):
  Background: rgba(239, 68, 68, 0.10)
  Text: #EF4444
  Label: "Vol"
```

**Filters:**
```
Options:
  - Alle aanbieders
  - Met capaciteit (available > 0)
  - Vol (available = 0)
```

**Navigation:**
```
"Bekijk alle aanbieders" button:
  → Navigates to Providers page
  → Pre-filtered to this region
```

---

## 🎨 Visual Design

### Color System

**Capacity Status Colors:**
```
Normal (Green):
  Primary: #22C55E
  Background: rgba(34, 197, 94, 0.10)
  Border: rgba(34, 197, 94, 0.30)
  
Busy (Amber):
  Primary: #F59E0B
  Background: rgba(245, 158, 11, 0.10)
  Border: rgba(245, 158, 11, 0.30)
  
Shortage (Red):
  Primary: #EF4444
  Background: rgba(239, 68, 68, 0.10)
  Border: rgba(239, 68, 68, 0.30)
```

**Progress Bars:**
```
Background: rgba(255, 255, 255, 0.10)

Fill colors:
  0-74%:   #22C55E (Green)
  75-89%:  #F59E0B (Amber)
  90-100%: #EF4444 (Red)
```

---

### Typography

```
Page Title:
  Font: Inter Bold 30px
  Color: #FFFFFF

Section Headers:
  Font: Inter Bold 18px
  Color: #FFFFFF

Region Names (Cards):
  Font: Inter Bold 18px
  Color: #FFFFFF
  Hover: #8B5CF6 (Primary)

Metric Values:
  Font: Inter Bold 24px (stats)
         Inter Bold 20px (cards)
  Color: #FFFFFF or Semantic

Metric Labels:
  Font: Inter Regular 11px
  Color: rgba(255,255,255,0.60)

Body Text:
  Font: Inter Regular 14px
  Color: rgba(255,255,255,0.90)

Small Text:
  Font: Inter Regular 12px
  Color: rgba(255,255,255,0.60)
```

---

### Spacing

```
Page padding: 24px
Section gap: 24px

System stats grid:
  Gap: 16px
  Card padding: 16px

Region cards grid:
  Gap: 16px
  Card padding: 20px
  Internal gaps: 12-16px

Heat visualization:
  Row gap: 12px
  Padding: 24px

Detail page:
  Gemeenten grid: 2 columns, gap 12px
  Providers list: Gap 12px
```

---

## 🔗 Navigation Flows

### From Overview to Detail

```
User clicks region card
  ↓
Navigate to RegioDetailPage
  ↓
Show region overview + municipalities + providers
```

### From Detail to Gemeenten

```
User clicks "Bekijk alle gemeenten"
  ↓
Navigate to Gemeenten page
  ↓
Pre-filter: region = current region
```

### From Detail to Providers

```
User clicks "Bekijk alle aanbieders"
  ↓
Navigate to Providers page
  ↓
Pre-filter: region = current region
```

### From Detail to Specific Gemeente

```
User clicks gemeente card
  ↓
Navigate to Gemeente detail page
  ↓
Show full gemeente information
```

### From Detail to Specific Provider

```
User clicks provider card
  ↓
Navigate to Provider profile page
  ↓
Show full provider information
```

---

## 📊 Data Requirements

### Region Object

```typescript
interface Region {
  id: string;              // Unique identifier
  name: string;            // Display name
  casesCount: number;      // Total active cases
  gemeentenCount: number;  // Number of municipalities
  providersCount: number;  // Number of providers
  avgWaitingTime: number;  // Average wait in days
  capacityStatus: "normal" | "busy" | "shortage";
  totalCapacity: number;   // Total system capacity
  usedCapacity: number;    // Currently used spots
  trend: "up" | "down" | "stable";
}
```

### Gemeente Object (in Region Detail)

```typescript
interface Gemeente {
  id: string;
  name: string;
  casesCount: number;
  status: "normal" | "busy" | "problem";
}
```

### Provider Object (in Region Detail)

```typescript
interface Provider {
  id: string;
  name: string;
  type: string;           // "Residentieel", "Ambulant", etc.
  capacity: number;       // Total capacity
  used: number;           // Currently used
  availableSpots: number; // Available spots
}
```

### Signal Object

```typescript
interface Signal {
  type: "warning" | "info" | "critical";
  message: string;
}
```

---

## 🎯 User Scenarios

### Scenario 1: Capacity Manager Morning Check

**Goal:** Understand system pressure

**Flow:**
1. Opens Regio's page
2. Sees system stats: "2 regio's met tekort"
3. Sees system insight: "Utrecht, Eindhoven hebben capaciteitstekort"
4. Scans heat visualization → Utrecht at 87%
5. Clicks Utrecht card
6. Reviews signals: "15 casussen zonder beschikbare plekken"
7. Checks providers in Utrecht
8. Sees which providers are full

**Time:** <2 minutes to full understanding

---

### Scenario 2: Regional Coordinator

**Goal:** Deep dive into specific region

**Flow:**
1. Opens Regio's page
2. Searches "Amsterdam"
3. Clicks Amsterdam card
4. Reviews regional stats
5. Clicks "Bekijk alle gemeenten"
6. Navigates to Gemeenten page (filtered to Amsterdam)
7. Reviews municipality distribution

**Time:** <1 minute to navigate

---

### Scenario 3: System Analyst

**Goal:** Compare regions

**Flow:**
1. Opens Regio's page
2. Sorts by "Sorteer op bezetting"
3. Sees Utrecht (87%) and Eindhoven (87%) at top
4. Sees Groningen (65%) at bottom
5. Identifies imbalance
6. Clicks regions to investigate

**Time:** <30 seconds to identify patterns

---

## ♿ Accessibility

### Keyboard Navigation

```
Tab: Navigate between regions, filters, buttons
Enter: Activate region card or button
Space: Toggle filters
Arrow ↑↓: Navigate region list
Esc: Clear search/filters
```

### Screen Reader

**Region Card:**
```
"Region: Utrecht. Status: Tekort (shortage). 
 87 cases, average waiting time 8 days. 
 26 municipalities, 34 providers. 
 Capacity: 87 percent, 105 out of 120 spots used. 
 Click to view details."
```

**Heat Visualization:**
```
"Capacity distribution. 
 Utrecht: 87 percent utilization, warning level.
 Amsterdam: 79 percent utilization, warning level.
 Rotterdam: 65 percent utilization, normal."
```

---

## 🎯 Success Metrics

### Understanding

**Target:** User can answer in <30 seconds:
- Which regions have capacity issues?
- What is system-wide utilization?
- Where are the bottlenecks?

**Measure:** User testing with questions

---

### Navigation

**Target:** <3 clicks to reach any municipality or provider

**Current:**
- Overview → Region detail → Gemeente: 2 clicks
- Overview → Region detail → Provider: 2 clicks
- Overview → "Bekijk gemeenten" button → Gemeente: 2 clicks

**Achieved:** ✅

---

### Decision Support

**Target:** Managers can identify priority regions in <1 minute

**Method:**
- System insights at top
- Heat visualization
- Sort by utilization

**Achieved:** ✅

---

## 📚 Files Created

```
Implementation:
  /components/care/RegiosPage.tsx
  /components/care/RegioDetailPage.tsx

Examples:
  /components/examples/RegiosDemo.tsx

AI Components (reused):
  /components/ai/SystemInsight.tsx

Documentation:
  /REGIOS_DOCS.md (this file)
  /REGIOS_FIGMA_SPEC.md (design specifications)
```

---

## 🎓 Design Principles Applied

✅ **System Map:** Structured geographical view  
✅ **Clear Hierarchy:** Overview → Detail → Specific items  
✅ **Capacity Focus:** All visualizations emphasize utilization  
✅ **Quick Navigation:** 2-3 clicks to any entity  
✅ **Calm & Informative:** No clutter, clear metrics  
✅ **AI-Enhanced:** System insights guide attention  

---

## 💡 Key Features

### 1. System-Level Intelligence
- Automatic calculation of system health
- Proactive alerts for shortage regions
- Trend indicators (up/down/stable)

### 2. Heat Visualization
- Quick visual scan of all regions
- Color-coded pressure levels
- Immediate identification of issues

### 3. Drill-Down Navigation
- Click region → See detail
- Click gemeente → Gemeente page
- Click provider → Provider profile
- Filtered navigation ("Bekijk alle gemeenten in Utrecht")

### 4. Contextual Filtering
- Filter by capacity status
- Sort by different metrics
- Search by name

---

## 🎉 Result

**User opens page and knows:**

1. **System health:** "78% utilization, 2 regions with shortage"
2. **Problem areas:** "Utrecht and Eindhoven need attention"
3. **Next action:** "Click Utrecht to investigate"

**This is a system map that provides clarity on geographical distribution and capacity balance.**  ✅
