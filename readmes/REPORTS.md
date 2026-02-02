# 📊 Reports & Analytics

> *Data-driven insights into your life*

The Reports module provides comprehensive analytics across all domains. Visualize trends, track progress, and gain insights into your habits and behaviors.

---

## 📍 Overview

Access via `/reports` - your analytics dashboard featuring:
- Period-based filtering
- Routine completion rates
- Domain breakdowns
- Activity heatmaps
- Weight trends
- Mood patterns
- Learning statistics
- Reading progress

---

## 📅 Period Selection

Choose your analysis timeframe.

```
┌─────────────────────────────────────────┐
│  [7D] [30D] [Month] [3M] [Year] [All]   │
└─────────────────────────────────────────┘
```

### Available Periods

| Period | Description |
|--------|-------------|
| **7D** | Last 7 days |
| **30D** | Last 30 days |
| **Month** | Current calendar month |
| **3M** | Last 3 months |
| **Year** | Current calendar year |
| **All** | All time data |

---

## 📈 Routine Analytics

### Completion Rate Widget

```
┌─────────────────────────────────┐
│  ✅ Routine Completion          │
│                                 │
│         87%                     │
│     ████████░░                  │
│                                 │
│  vs last period: +5% ↑         │
│  Total tasks: 245/280          │
└─────────────────────────────────┘
```

### Daily Breakdown Chart

```
       ▲ 100%
       │     ●───────●
       │    ╱         ╲
   75% │   ●           ●───●
       │  ╱                 ╲
   50% │ ●                   ●
       │
       └───M──T──W──T──F──S──S──►
```

**Chart Type:** Area chart with gradient fill
**Data:** Completion percentage per day

---

## 🎯 Domain Breakdown

Performance by life area.

```
┌─────────────────────────────────┐
│  🎯 Domain Breakdown            │
│                                 │
│  💪 Health       ████████░░ 85% │
│  💼 Career       ███████░░░ 72% │
│  📚 Learning     █████████░ 91% │
│  👥 Social       ██████░░░░ 63% │
│  🎯 Discipline   ████████░░ 78% │
│  ✨ Personality  ███████░░░ 70% │
│  🚀 Startups     █████░░░░░ 55% │
│                                 │
└─────────────────────────────────┘
```

### Domain Stats

```typescript
interface DomainStats {
  domain: string;          // 'health'
  completionRate: number;  // 0-100
  points: number;          // Total points earned
  tasksCompleted: number;  // Count
  totalTasks: number;      // Count scheduled
}
```

---

## 🗓️ Activity Heatmap

GitHub-style yearly activity visualization.

```
┌────────────────────────────────────────────────────────┐
│  Exercise Activity                                     │
│                                                        │
│  M  ░░░░░░▓▓░░▓▓▓▓░░░▓▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓░░▓▓          │
│  T  ░░░░▓▓░░▓▓░░▓▓░░▓▓▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓          │
│  W  ░░░░░░▓▓▓▓░░░░▓▓▓▓░░▓▓░░▓▓░░▓▓▓▓░░▓▓▓▓░░          │
│  T  ░░░░▓▓░░▓▓▓▓░░▓▓░░▓▓▓▓░░▓▓▓▓░░▓▓░░▓▓░░▓▓          │
│  F  ░░░░░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓░░▓▓▓▓░░▓▓░░          │
│  S  ░░░░▓▓▓▓░░░░▓▓░░▓▓▓▓░░░░▓▓░░▓▓░░▓▓░░▓▓▓▓          │
│  S  ░░░░░░░░▓▓░░░░░░░░▓▓░░░░░░▓▓░░░░▓▓░░░░▓▓          │
│                                                        │
│  Jan    Feb    Mar    Apr    May    Jun    Jul        │
│                                                        │
│  Less ░░░▓▓▓███ More                                  │
└────────────────────────────────────────────────────────┘
```

### Heatmap Logic

```typescript
interface HeatmapData {
  date: string;   // "2026-02-03"
  count: number;  // Activity count (0-n)
}

// Color intensity based on count
function getColor(count: number): string {
  if (count === 0) return 'bg-secondary/50';      // Gray
  if (count === 1) return 'bg-emerald-500/40';    // Light green
  if (count === 2) return 'bg-emerald-500/70';    // Medium green
  return 'bg-emerald-500';                        // Full green
}
```

### Technical Implementation

- Displays last 365 days
- Grouped into 52-53 weekly columns
- 7 rows for days of week
- Auto-scrolls to latest on mobile
- Tooltip on hover shows date and count

---

## ⚖️ Weight Trends

Historical weight visualization.

```
┌─────────────────────────────────┐
│  ⚖️ Weight History              │
│                                 │
│  75 ─┐                          │
│      │    ╭─╮                   │
│  73 ─│   ╱   ╲    ╭───╮         │
│      │  ╱     ╲  ╱     ╲        │
│  71 ─│ ╱       ╲╱       ╲___    │
│      │╱                         │
│  69 ─└──────────────────────    │
│      Jan  Feb  Mar  Apr  May    │
│                                 │
│  Current: 72.5 kg               │
│  Δ Period: -1.8 kg              │
└─────────────────────────────────┘
```

### Weight Stats

```typescript
interface WeightStats {
  current: number;        // Latest weight
  periodStart: number;    // Weight at period start
  periodEnd: number;      // Weight at period end
  delta: number;          // Change over period
  bmi: number;            // Current BMI
  history: WeightEntry[]; // For chart
}

interface WeightEntry {
  date: string;
  weight: number;
}
```

---

## 😊 Mood Trends

Emotional pattern analysis.

```
┌─────────────────────────────────┐
│  😊 Mood Patterns               │
│                                 │
│  Great  ●     ●        ●    ●   │
│  Good     ● ●   ● ●  ●   ●      │
│  Okay           ●    ●          │
│  Low                      ●     │
│  Bad                            │
│         M  T  W  T  F  S  S     │
│                                 │
│  Average: 😊 Good (3.8/5)       │
│  Best day: Monday               │
└─────────────────────────────────┘
```

### Mood Stats

```typescript
interface MoodStats {
  averageScore: number;      // 1-5 scale
  averageLabel: string;      // 'Good'
  distribution: {
    great: number;           // Count
    good: number;
    okay: number;
    low: number;
    bad: number;
  };
  bestDay: string;           // Day of week
  worstDay: string;
}
```

### Mood Score Mapping

| Mood | Score |
|------|-------|
| Great | 5 |
| Good | 4 |
| Okay | 3 |
| Low | 2 |
| Bad | 1 |

---

## 📚 Reading Stats

Book progress analytics.

```
┌─────────────────────────────────┐
│  📚 Reading Progress            │
│                                 │
│  Books Completed: 3             │
│  vs last period: +1             │
│                                 │
│  Pages Read: 847                │
│  Avg/Day: 28 pages              │
│                                 │
│  Reading Streak: 12 days        │
│                                 │
│  Top Domain: Self-Improvement   │
└─────────────────────────────────┘
```

### Reading Metrics

- Books started
- Books completed
- Pages read
- Average pages per day
- Reading streak
- Completion rate
- Domain distribution

---

## 🧠 Learning Stats

Skill development analytics.

```
┌─────────────────────────────────┐
│  🧠 Learning Time               │
│                                 │
│  Total Practice: 24h 30m        │
│  vs last period: +4h 15m ↑      │
│                                 │
│  Sessions: 42                   │
│  Avg Session: 35m               │
│                                 │
│  Most Practiced:                │
│  • Guitar: 8h 30m               │
│  • Python: 6h 45m               │
│  • Spanish: 5h 15m              │
│                                 │
│  Difficulty Breakdown:          │
│  Easy: 30% | Mod: 45% | Hard: 25%│
└─────────────────────────────────┘
```

### Learning Metrics

- Total practice time
- Session count
- Average session length
- Top skills
- Difficulty distribution
- Area breakdown

---

## 🔥 Streak Analytics

Consistency tracking.

```
┌─────────────────────────────────┐
│  🔥 Streak Stats                │
│                                 │
│  Current Streak: 23 days        │
│  Longest Ever: 45 days          │
│                                 │
│  Valid Days (30D): 28/30        │
│  Rest Days: 4                   │
│                                 │
│  Streak History:                │
│  • 45 days (Jan 2026)           │
│  • 23 days (current)            │
│  • 18 days (Dec 2025)           │
└─────────────────────────────────┘
```

---

## 🏆 Points Summary

Gamification overview.

```
┌─────────────────────────────────┐
│  🏆 Points Summary              │
│                                 │
│  Total Points: 2,847            │
│  Better %: 18%                  │
│                                 │
│  This Period: +342 pts          │
│  Avg/Day: 11.4 pts              │
│                                 │
│  Top Contributors:              │
│  • Workout (5pts): 45 times     │
│  • Reading (3pts): 28 times     │
│  • Meditation (2pts): 30 times  │
└─────────────────────────────────┘
```

---

## 📱 Sub-Reports

Access detailed reports for specific domains.

```
┌─────────────────────────────────┐
│  📋 Detailed Reports            │
│                                 │
│  ▶ Routine Report         →     │
│  ▶ Health Report          →     │
│  ▶ Books Report           →     │
│  ▶ Learning Report        →     │
│                                 │
└─────────────────────────────────┘
```

### Available Sub-Reports

- `/reports/routine` - Detailed task analytics
- `/reports/health` - Weight, exercise, mood details
- `/reports/books` - Reading analytics
- `/reports/learning` - Practice time breakdown

---

## 🛠️ Technical Details

### Files
- `src/app/reports/page.tsx` - Server component
- `src/app/reports/ReportsClient.tsx` - Main dashboard
- `src/app/reports/routine/` - Routine sub-report
- `src/app/reports/health/` - Health sub-report
- `src/app/reports/books/` - Books sub-report
- `src/app/reports/learning/` - Learning sub-report
- `src/app/actions/reports.ts` - Server actions

### Key Actions

```typescript
// Main report data
getOverallReport(period: string)

// Dashboard stats (heatmap, weight history)
getDashboardStats()

// Domain-specific
getRoutineReport(period: string)
getHealthReport(period: string)
getBooksReport(period: string)
getLearningReport(period: string)
```

### Report Data Structure

```typescript
interface ReportData {
  summary: {
    routineCompletionRate: number;
    routineChange: number;
    totalPoints: number;
    pointsChange: number;
    exerciseDays: number;
    exerciseChange: number;
    currentWeight: number | null;
    weightChange: number;
    avgMood: number;
    booksCompleted: number;
    booksChange: number;
    pagesRead: number;
    pagesReadChange: number;
    learningMinutes: number;
    learningChange: number;
  };
  domainBreakdown: DomainStats[];
  dailyBreakdown: DailyStats[];
}

interface DashboardStats {
  heatmapData: { date: string; count: number }[];
  weightHistory: { date: string; weight: number }[];
}
```

### Charts Library

Uses **Recharts** for all visualizations:

```typescript
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
```

### Chart Styling

- Dark theme colors
- Gradient fills
- Responsive containers
- Touch-friendly tooltips

---

## 📊 Data Aggregation

### Period Calculations

```typescript
function getPeriodDates(period: string) {
  const now = new Date();
  
  switch (period) {
    case 'last7Days':
      return { start: subDays(now, 7), end: now };
    case 'last30Days':
      return { start: subDays(now, 30), end: now };
    case 'thisMonth':
      return { start: startOfMonth(now), end: now };
    case 'last3Months':
      return { start: subMonths(now, 3), end: now };
    case 'thisYear':
      return { start: startOfYear(now), end: now };
    case 'allTime':
      return { start: new Date(0), end: now };
  }
}
```

### Comparison Periods

Changes are calculated vs previous equivalent period:
- 7D compares to previous 7 days
- 30D compares to previous 30 days
- Month compares to last month
- etc.

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - Quick stats overview
- [Routine System](./ROUTINE.md) - Task data source
- [Health Module](./HEALTH.md) - Health data source
- [Books Tracker](./BOOKS.md) - Reading data source
- [Learning Hub](./LEARNING.md) - Learning data source
