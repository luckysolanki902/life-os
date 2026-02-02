# 💪 Health Module

> *Track your physical wellness and fitness journey*

The Health module provides comprehensive tracking for body metrics, workouts, and emotional well-being. Unlike Routine tasks, health logs don't generate points—they're for data tracking and insights.

---

## 📍 Overview

Access via `/health` - your fitness command center with:
- Weight tracking & BMI
- Workout page management
- Exercise logging
- Muscle map visualization
- Mood tracking
- Health-related routine tasks

---

## ⚖️ Weight Tracking

### Logging Weight

```
┌─────────────────────────────────┐
│  ⚖️ Weight Log                  │
│                                 │
│  Date: [2026-02-03    📅]       │
│  Weight: [72.5       ] kg       │
│                                 │
│  [Cancel]           [Log]       │
└─────────────────────────────────┘
```

### Weight Stats Dashboard

```
┌─────────────────────────────────┐
│  📊 Weight Overview             │
│                                 │
│  Current:     72.5 kg           │
│  BMI:         23.4 (Normal)     │
│  Δ 30 days:   -1.2 kg ↓         │
│  Last logged: Today             │
│                                 │
│  [Edit Today's Weight]          │
└─────────────────────────────────┘
```

### Weight Data Model

```typescript
interface WeightLog {
  _id: string;
  date: Date;           // Normalized to midnight
  weight: number;       // in kg
  createdAt: Date;
  updatedAt: Date;
}
```

### BMI Calculation

```typescript
// User height stored in profile (meters)
BMI = weight / (height * height)

// BMI Categories:
// < 18.5     → Underweight
// 18.5-24.9  → Normal
// 25-29.9    → Overweight
// ≥ 30       → Obese
```

### 30-Day Delta

Shows weight change compared to 30 days ago:
- **↓ Green** - Weight decreased
- **↑ Red** - Weight increased  
- **→ Gray** - No change / no data

---

## 🏋️ Workout Management

### Health Pages

Organize your workouts by day or focus area.

```
┌─────────────────────────────────┐
│  📋 My Workout Pages            │
│                                 │
│  🔵 Day A - Push               │
│     Chest, Shoulders, Triceps   │
│     [Current Cycle]             │
│                                 │
│  ⚪ Day B - Pull               │
│     Back, Biceps                │
│                                 │
│  ⚪ Day C - Legs               │
│     Quads, Hamstrings, Glutes   │
│                                 │
│  [+ Add Page]                   │
└─────────────────────────────────┘
```

### Health Page Model

```typescript
interface HealthPage {
  _id: string;
  title: string;          // "Day A - Push"
  description?: string;   // "Chest, Shoulders, Triceps"
  cycleStatus?: 'current' | 'done';
}
```

### Cycle Status
- **Current** - Active workout in rotation
- **Done** - Completed or on rotation rest

---

## 🎯 Exercise Definitions

Each workout page contains exercise definitions.

```
┌─────────────────────────────────┐
│  Day A - Push                   │
│                                 │
│  🏋️ Bench Press                │
│     Type: Reps & Weight         │
│     Targets: Chest, Triceps     │
│     [Log Exercise]              │
│                                 │
│  🏋️ Shoulder Press             │
│     Type: Reps & Weight         │
│     Targets: Shoulders          │
│     [Log Exercise]              │
│                                 │
│  🏋️ Plank                      │
│     Type: Duration              │
│     Targets: Core               │
│     [Log Exercise]              │
└─────────────────────────────────┘
```

### Exercise Definition Model

```typescript
interface ExerciseDefinition {
  _id: string;
  pageId: ObjectId;          // Parent HealthPage
  title: string;             // "Bench Press"
  type: 'reps_weight' | 'duration';
  targetMuscles: string[];   // ['chest', 'triceps']
  impact: 'high' | 'medium' | 'low';
}
```

### Target Muscle Options

```
Front Body:          Back Body:
- neck               - upper_back
- traps              - lats
- shoulders          - lower_back
- chest              - glutes
- biceps             - hamstrings
- forearms           - calves (rear)
- abs
- obliques
- quads
- adductors
- calves
```

---

## 📝 Exercise Logging

### Logging a Workout

When you tap "Log Exercise", you record your sets:

```
┌─────────────────────────────────┐
│  📝 Log: Bench Press            │
│  Feb 3, 2026                    │
│                                 │
│  Last session (Feb 1):          │
│  Set 1: 10 reps × 60kg          │
│  Set 2: 8 reps × 65kg           │
│  Set 3: 6 reps × 70kg           │
│                                 │
│  ─────────────────────          │
│                                 │
│  Today:                         │
│  Set 1: [10] reps × [60] kg  ➕ │
│  Set 2: [8 ] reps × [65] kg  ➕ │
│  Set 3: [6 ] reps × [70] kg  🗑️ │
│                                 │
│  [+ Add Set]                    │
│                                 │
│  [Cancel]           [Save]      │
└─────────────────────────────────┘
```

### Progressive Overload

The "Last session" preview helps with progressive overload:
- See previous reps/weight
- Try to beat it today
- Track strength gains over time

### Exercise Log Model

```typescript
interface ExerciseLog {
  _id: string;
  date: Date;                    // Workout date
  exerciseId: ObjectId;          // Reference to ExerciseDefinition
  sets: Set[];                   // Array of set data
}

interface Set {
  reps?: number;     // For reps_weight type
  weight?: number;   // For reps_weight type (kg)
  duration?: number; // For duration type (minutes)
}
```

### Exercise Types

**Reps & Weight:**
```
Set 1: 10 reps × 60 kg
Set 2: 8 reps × 65 kg
```

**Duration:**
```
Set 1: 2 minutes
Set 2: 2 minutes
```

---

## 🗺️ Muscle Map

Visual SVG representation showing which muscles you've recently worked.

```
      ┌───────────┐
      │    😊     │
      ├───────────┤
     /│ ████████  │\
    / │ ████████  │ \    ← Chest highlighted
   │  │    ██     │  │
   │  │   ████    │  │   ← Abs highlighted
   │  │  ██  ██   │  │
    \ │ ██    ██  │ /
     \│██      ██ │/
      ├──────────┤
       \        /
        \      /
         │    │
         │    │
```

### How It Works

1. **Fetch recent exercise logs** (last 7 days)
2. **Extract `targetMuscles`** from each exercise
3. **Calculate intensity score** (0.0 - 1.0) based on recency and volume
4. **Render SVG paths** with gradient fills

### Muscle Intensity Colors

```
No activity  → Gray (#2a2a2a)
Low (0.3)    → Light green (20% opacity)
Medium (0.6) → Medium green (50% opacity)
High (1.0)   → Bright green (full opacity)
```

### Front & Back Views

The MuscleMap component shows both:
- **Front view**: Chest, abs, quads, biceps, etc.
- **Back view**: Lats, glutes, hamstrings, etc.

---

## 😊 Mood Tracking

Daily emotional check-in.

```
┌─────────────────────────────────┐
│  How are you feeling today?     │
│                                 │
│  ✨ Great   👍 Good   😐 Okay   │
│  😔 Low     👎 Bad              │
│                                 │
│  [Note: (optional)]             │
│                                 │
└─────────────────────────────────┘
```

### Mood Options

| Mood | Icon | Color |
|------|------|-------|
| Great | ✨ | Emerald |
| Good | 👍 | Green |
| Okay | 😐 | Yellow |
| Low | 😔 | Orange |
| Bad | 👎 | Rose |

### Mood Log Model

```typescript
interface MoodLog {
  _id: string;
  date: Date;
  mood: 'great' | 'good' | 'okay' | 'low' | 'bad';
  note?: string;
}
```

### Mood in Reports

- Average mood score over time
- Correlation with exercise frequency
- Pattern detection (e.g., better mood on workout days)

---

## ✅ Health Routine Tasks

Tasks categorized under the "Health" domain appear in this module.

```
┌─────────────────────────────────┐
│  Today's Health Tasks           │
│                                 │
│  ○ Morning Workout         💪   │
│  ✓ Take vitamins          💊   │
│  ○ Evening stretch         🧘   │
│                                 │
│  Show completed ▼               │
└─────────────────────────────────┘
```

**Note:** Completing these tasks here earns points just like on the Routine page.

---

## 📸 Shareable Workout

Generate shareable workout summary image.

```
┌─────────────────────────────────┐
│  📸 Share Today's Workout       │
│                                 │
│  ┌─────────────────────────┐    │
│  │  🏋️ Day A - Push        │    │
│  │  Feb 3, 2026            │    │
│  │                         │    │
│  │  Bench Press: 3 sets    │    │
│  │  Shoulder Press: 3 sets │    │
│  │  Tricep Dips: 3 sets    │    │
│  │                         │    │
│  │  Total: 9 sets          │    │
│  │  Muscles: Chest, Delts  │    │
│  └─────────────────────────┘    │
│                                 │
│  [Share]        [Download]      │
└─────────────────────────────────┘
```

Uses `html-to-image` to generate shareable graphics.

---

## 🛠️ Technical Details

### Files
- `src/app/health/page.tsx` - Server component
- `src/app/health/HealthClient.tsx` - Main UI
- `src/app/health/ShareableWorkout.tsx` - Image generator
- `src/app/health/[id]/page.tsx` - Workout page detail
- `src/components/MuscleMap.tsx` - SVG muscle visualization
- `src/app/actions/health.ts` - Server actions

### Key Actions

```typescript
// Weight
logWeight(weight: number, date?: string)
updateWeight(id: string, weight: number)

// Mood
saveMood(mood: string, note?: string)

// Pages
createHealthPage(data: Partial<HealthPage>)
updateHealthPage(id: string, data: Partial<HealthPage>)
deleteHealthPage(id: string)

// Exercises
createExerciseDefinition(pageId: string, data: ...)
logExercise(exerciseId: string, sets: Set[], date?: string)
```

### API Endpoints

```
GET  /api/health           → Dashboard data
POST /api/health/weight    → Log weight
GET  /api/health/weight    → Weight history
POST /api/health/mood      → Log mood
GET  /api/health/pages     → Workout pages
POST /api/health/log       → Log exercise
```

---

## 📊 Health Insights (Reports)

In the Reports section, health data is visualized:

- **Weight Graph** - Historical trend line
- **Exercise Heatmap** - GitHub-style activity calendar
- **Mood Trends** - Emotional patterns
- **Muscle Coverage** - Which muscles need attention

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - Weight quick-log
- [Routine System](./ROUTINE.md) - Health domain tasks
- [Reports](./REPORTS.md) - Health analytics
- [Architecture](./ARCHITECTURE.md) - Data models
