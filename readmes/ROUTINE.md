# ✅ Routine System

> *The engine that drives your daily habits*

The Routine system is the core of LifeOS. It's where you define, manage, and execute your daily habits. This is the **only** module that generates points for your "Better %" metric.

---

## 📍 Overview

Access via `/routine` - the daily driver page showing all your scheduled tasks.

---

## 🎯 Core Concepts

### Routine Tasks

A **Routine Task** is a habit or activity that appears in your daily routine.

```typescript
interface RoutineTask {
  _id: string;
  title: string;                    // "Morning Workout"
  domainId: DomainType;             // 'health' | 'career' | etc.
  order: number;                    // Drag-and-drop position
  isScheduled: boolean;             // Linked to external item?
  startTime?: string;               // "06:30" (HH:mm)
  endTime?: string;                 // "07:30" (HH:mm)
  notificationsEnabled: boolean;    // Push notifications
  timeOfDay: TimeOfDay;             // 'morning' | 'afternoon' | etc.
  basePoints: number;               // 1-10 points per completion
  isActive: boolean;                // Soft delete flag
  recurrenceType: RecurrenceType;   // 'daily' | 'weekdays' | etc.
  recurrenceDays?: number[];        // [1, 3, 5] = Mon, Wed, Fri
}

type DomainType = 
  | 'health' 
  | 'career' 
  | 'learning' 
  | 'social' 
  | 'discipline' 
  | 'personality' 
  | 'startups';

type TimeOfDay = 
  | 'none' 
  | 'morning' 
  | 'afternoon' 
  | 'evening' 
  | 'night' 
  | 'day';

type RecurrenceType = 
  | 'daily'      // Every day
  | 'weekdays'   // Monday - Friday
  | 'weekends'   // Saturday - Sunday
  | 'custom';    // Specific days
```

### Daily Logs

A **Daily Log** records the completion of a task for a specific date.

```typescript
interface DailyLog {
  _id: string;
  taskId: ObjectId;           // Reference to RoutineTask
  date: Date;                 // Normalized to midnight
  completedAt?: Date;         // Actual completion timestamp
  status: 'completed' | 'pending' | 'skipped';
  pointsEarned: number;       // Points awarded
}
```

---

## 📋 Task Management

### Creating Tasks

```
┌─────────────────────────────────┐
│  ➕ New Task                    │
│                                 │
│  Title: [Morning Workout      ] │
│                                 │
│  Domain: [💪 Health         ▼] │
│                                 │
│  Time of Day:                   │
│  ○ Morning  ○ Afternoon         │
│  ○ Evening  ○ Night             │
│                                 │
│  Base Points: [5            ]   │
│                                 │
│  Recurrence:                    │
│  ● Daily                        │
│  ○ Weekdays Only                │
│  ○ Weekends Only                │
│  ○ Custom Days                  │
│                                 │
│  [Cancel]           [Create]    │
└─────────────────────────────────┘
```

### Task Properties

| Property | Description |
|----------|-------------|
| **Title** | Clear, action-oriented name |
| **Domain** | Life area categorization |
| **Time of Day** | When task typically occurs |
| **Base Points** | 1-10 based on difficulty/importance |
| **Recurrence** | Which days task appears |

---

## 📅 Recurrence Patterns

### Daily
Task appears every single day.

### Weekdays
Task appears Monday through Friday only.
```typescript
// Condition
dayOfWeek >= 1 && dayOfWeek <= 5
```

### Weekends
Task appears Saturday and Sunday only.
```typescript
// Condition
dayOfWeek === 0 || dayOfWeek === 6
```

### Custom
Task appears on specific days you select.
```typescript
// Example: Mon, Wed, Fri
recurrenceDays: [1, 3, 5]

// Day mapping:
// 0 = Sunday
// 1 = Monday
// 2 = Tuesday
// 3 = Wednesday
// 4 = Thursday
// 5 = Friday
// 6 = Saturday
```

---

## 🔄 Task States

### Pending (Default)
Task is scheduled but not yet acted upon.
```
○ Morning Workout     💪
```

### Completed ✅
Task was successfully completed.
```
✓ Morning Workout     💪  ✓
```

### Skipped ⏭️
Task was intentionally skipped (no points earned).
```
⊘ Morning Workout     💪  (skipped)
```

---

## 👆 Interactions

### Swipe Gestures

| Gesture | Action |
|---------|--------|
| **Swipe Right** | Mark as Complete |
| **Swipe Left** | Skip Task |
| **Tap** | View Details |
| **Long Press** | Open Context Menu |

### Context Menu Options

- ✏️ Edit Task
- 🔄 Reset to Pending
- ⊘ Skip Task
- 🗑️ Delete Task
- 📋 Duplicate Task

---

## 📊 Today's View

The default view shows only today's tasks, filtered by recurrence.

```
┌─────────────────────────────────┐
│  Today - Monday, Feb 3          │
│                                 │
│  🌅 MORNING                     │
│  ○ Wake up early          🌙    │
│  ○ Morning workout        💪    │
│  ○ Meditation             🧘    │
│                                 │
│  ☀️ AFTERNOON                   │
│  ○ Deep work block        💻    │
│  ○ Read 30 mins           📚    │
│                                 │
│  🌙 EVENING                     │
│  ○ Review day             📝    │
│  ○ Plan tomorrow          📋    │
└─────────────────────────────────┘
```

### Time-of-Day Grouping

Tasks are organized into collapsible sections:
- 🌅 **Morning** - Before noon
- ☀️ **Afternoon** - 12pm - 5pm
- 🌆 **Evening** - 5pm - 9pm
- 🌙 **Night** - After 9pm
- 📅 **Day** - Anytime (no specific time)

---

## 🔀 Drag & Drop Ordering

### Edit Mode

Toggle edit mode to reorder tasks:

1. Tap **Edit** button in header
2. Drag tasks using handle (⋮⋮)
3. Drop in new position
4. Order persists to database

```
┌─────────────────────────────────┐
│  [Edit Mode: ON]                │
│                                 │
│  ⋮⋮ ○ Wake up early        🌙  │
│  ⋮⋮ ○ Morning workout      💪  │
│  ⋮⋮ ○ Meditation           🧘  │
│                                 │
│  [Done]                         │
└─────────────────────────────────┘
```

### Technical Implementation

Uses `@dnd-kit` for smooth drag-and-drop:

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (active.id !== over?.id) {
    const oldIndex = tasks.findIndex(t => t._id === active.id);
    const newIndex = tasks.findIndex(t => t._id === over?.id);
    const newOrder = arrayMove(tasks, oldIndex, newIndex);
    setTasks(newOrder);
    updateTaskOrder(newOrder.map(t => t._id));
  }
}
```

---

## 📅 Custom Date View

Navigate to view/complete tasks for past dates:

```
┌─────────────────────────────────┐
│  ◀ Feb 2, 2026 ▶               │
│                                 │
│  ✓ Wake up early          🌙   │
│  ✓ Morning workout        💪   │
│  ⊘ Meditation (skipped)   🧘   │
│                                 │
│  Completion: 66%                │
└─────────────────────────────────┘
```

**Rules:**
- Can view any past date
- Can complete/modify past tasks
- Cannot view future dates
- Today shows "Today" label

---

## 🎮 Points System

### Earning Points

```
Task Completed → basePoints earned
Task Skipped → 0 points
Task Pending → 0 points
```

### Point Recommendations

| Difficulty | Suggested Points |
|------------|-----------------|
| Easy habit | 1-2 pts |
| Medium effort | 3-5 pts |
| Hard task | 6-8 pts |
| Major achievement | 9-10 pts |

### Daily Maximum

No cap on daily points - complete all your tasks!

---

## 🔥 Streak Impact

Completing all routine tasks makes the day **"valid"** for streak purposes.

### Valid Day Conditions
1. **All tasks completed** - Every scheduled task is done
2. **Rest day** - No tasks scheduled for today

### Streak Calculation
```
If today is valid AND yesterday was valid:
  streak++
Else if today is valid:
  streak = 1
Else:
  streak = 0
```

---

## 🔔 Notifications (Future)

Planned notification features:
- Push reminders at scheduled times
- Streak warning at end of day
- Weekly summary digest

---

## 🛠️ Technical Details

### Files
- `src/app/routine/page.tsx` - Server component
- `src/app/routine/RoutineList.tsx` - Main list component
- `src/app/routine/TaskItem.tsx` - Individual task row
- `src/app/routine/NewTaskForm.tsx` - Task creation form
- `src/app/actions/routine.ts` - Server actions

### Key Actions

```typescript
// Complete a task
toggleTaskStatus(taskId: string, status: 'completed' | 'pending')

// Skip a task
skipTask(taskId: string)

// Undo skip
unskipTask(taskId: string)

// Reorder tasks
updateTaskOrder(taskIds: string[])

// Get today's routine
getRoutine(timezone: string)

// Get routine for specific date
getRoutineForDate(dateStr: string, timezone: string)
```

### Database Indexes

```typescript
// For fast queries
TaskSchema.index({ domainId: 1, isActive: 1 });
TaskSchema.index({ isActive: 1, order: 1 });
TaskSchema.index({ timeOfDay: 1, isActive: 1 });
TaskSchema.index({ recurrenceType: 1 });
```

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - Incomplete tasks display
- [Reports](./REPORTS.md) - Routine completion analytics
- [Sync System](./SYNC.md) - Real-time task updates
