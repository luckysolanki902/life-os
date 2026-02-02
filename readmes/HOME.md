# 🏠 Home Dashboard

> *Your command center for life optimization*

The Home Dashboard is the central hub of LifeOS, providing an at-a-glance view of your progress and quick access to essential actions.

---

## 📍 Overview

The Home page (`/`) displays:
- Your "Better %" identity metric
- Current streak status
- Today's incomplete tasks
- Weight quick-log widget
- 7-day completion visualization

---

## 🎯 Core Components

### 1. Better Percentage Widget

The crown jewel of LifeOS - your gamified identity score.

```
┌─────────────────────────────┐
│     You are                 │
│        4%                   │
│   Better Version            │
│   of Yourself               │
│                             │
│   Total: 612 pts            │
└─────────────────────────────┘
```

**Calculation:**
```typescript
Better % = Math.floor(totalPoints / 150)
```

- Every **150 points** earns you 1% improvement
- Points come exclusively from completing routine tasks
- Displayed prominently to reinforce your growth mindset

---

### 2. Streak Counter

Visual representation of your consistency.

```
┌─────────────────────────────┐
│  🔥 7-Day Streak            │
│                             │
│  M  T  W  T  F  S  S        │
│  ●  ●  ●  ●  ●  ●  ○        │
│  ✓  ✓  ✓  ✓  ✓  ✓  -        │
└─────────────────────────────┘
```

**Features:**
- Shows current streak count with flame icon
- 7-day visual calendar
- Green dots for valid days (tasks completed)
- Rest day indicator (no tasks = automatic rest)
- Gray for future/incomplete days

**Streak Rules:**
- A day is "valid" if all routine tasks are completed
- Rest days (no tasks scheduled) count as valid
- Breaking a day resets streak to 0

---

### 3. Incomplete Tasks Section

Quick view of today's remaining habits.

```
┌─────────────────────────────┐
│  📋 Today's Tasks           │
│                             │
│  ○ Morning Workout      💪  │
│  ○ Read 30 mins         📚  │
│  ○ Code Practice        💻  │
│                             │
│  Swipe right → Complete     │
│  Swipe left → Skip          │
└─────────────────────────────┘
```

**Interactions:**
- Tap to view task details
- Swipe right to mark complete
- Swipe left to skip
- Visual feedback with haptics

---

### 4. Weight Quick-Log

Fast weight entry without leaving home.

```
┌─────────────────────────────┐
│  ⚖️ Today's Weight          │
│                             │
│  [72.5] kg     ✓ Log        │
│                             │
│  Current: 72.5 kg           │
│  BMI: 23.4 (Normal)         │
│  Δ30d: -1.2 kg ↓            │
└─────────────────────────────┘
```

**Features:**
- Input field for quick logging
- Shows current weight if already logged
- BMI calculation based on height in profile
- 30-day delta comparison
- Edit capability for corrections

---

### 5. 7-Day Completion Graph

Mini area chart showing recent performance.

```
       ▲
   100%├────────●────────●
       │       ╱ ╲      ╱
    75%├──────●───●────●
       │     ╱         ╱
    50%├────●─────────●
       │   ╱
       └───M──T──W──T──F──S──S───►
```

**Visualization:**
- Area chart with gradient fill
- X-axis: Days of week
- Y-axis: Completion percentage
- Tooltip on hover/tap shows exact stats

---

## ⚡ Quick Actions

### Refresh Button
Located in the header - manually trigger data refresh

### Navigation
Bottom tab bar for quick page switching:
- 🏠 Home (current)
- ✅ Routine
- 💪 Health
- 📊 Reports

---

## 🔄 Data Flow

### Initial Load
1. Check local cache for instant render
2. Fetch fresh data from `/api/home`
3. Update cache and UI

### Background Sync
- Polling every 5 seconds for multi-device updates
- Device ID tracking for sync state
- Automatic refresh on external changes

### Optimistic Updates
When completing tasks from home:
1. UI updates instantly (0ms)
2. Server action executes (100-500ms)
3. Cache updates (instant)
4. Other devices notified (background)

---

## 📊 Data Structure

### Home API Response

```typescript
interface HomeData {
  incompleteTasks: Task[];        // Today's pending tasks
  domains: Domain[];              // Life domain summaries
  todaysWeight: WeightLog | null; // Today's weight entry
  streakData: {
    currentStreak: number;
    last7Days: {
      date: string;
      valid: boolean;
      points: number;
      isRestDay: boolean;
    }[];
    todayValid: boolean;
    todayRoutineTasks: number;
    todayCanBeRestDay: boolean;
    todayIsRestDay: boolean;
  };
  specialTasks: Task[];           // Scheduled book/learning tasks
  totalPoints: number;            // Cumulative points
  last7DaysCompletion: {
    date: string;
    completed: number;
    total: number;
    rate: number;
  }[];
}
```

---

## 🎨 UI/UX Details

### Design Principles
- **Dark Theme** - Easy on the eyes
- **Glass Morphism** - Semi-transparent cards
- **Minimal Chrome** - Focus on content
- **Touch-Friendly** - Large tap targets

### Animations
- Fade-in on load
- Scale on tap
- Smooth transitions between states
- Skeleton loaders for initial fetch

### Responsive Behavior
- Mobile: Single column, full-width cards
- Tablet: Two-column grid
- Desktop: Centered container with max-width

---

## 🛠️ Technical Implementation

### Files
- `src/app/page.tsx` - Server component entry
- `src/app/HomePageClient.tsx` - Client wrapper with sync
- `src/app/NewHomeClient.tsx` - Main UI component

### Key Hooks
```typescript
// Reactive cache for instant data
const { data, isLoading, refresh } = useReactiveCache<HomeData>(
  CACHE_KEYS.HOME_DATA,
  fetchHomeData
);

// Background sync initialization
useEffect(() => {
  startBackgroundSync(5000);
  return () => stopBackgroundSync();
}, []);
```

### State Management
- Local state for UI interactions
- Reactive cache for server data
- Redux store for cross-page persistence

---

## 🔗 Related Documentation

- [Routine System](./ROUTINE.md) - Task management details
- [Sync System](./SYNC.md) - Real-time sync architecture
- [Architecture](./ARCHITECTURE.md) - Overall system design
