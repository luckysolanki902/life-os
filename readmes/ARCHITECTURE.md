# 🏗️ Architecture

> *Technical design and system overview*

This document provides a deep dive into the technical architecture of LifeOS, including data models, system design patterns, and implementation details.

---

## 📍 Overview

LifeOS is built with:
- **Next.js 16** - App Router with Server Components
- **React 19** - Latest React with Server Actions
- **TypeScript** - Full type safety
- **MongoDB** - Document database with Mongoose ODM
- **Capacitor** - Native mobile capabilities

---

## 🎯 Design Principles

### 1. Local-First Architecture
Data is cached locally for instant access. Server sync happens in the background.

### 2. Optimistic Updates
UI updates immediately on user action. Server confirmation happens asynchronously.

### 3. Server Actions
Database mutations happen through Next.js Server Actions, not traditional API routes.

### 4. Mobile-First Design
Every feature is designed for mobile use first, then scaled up for larger screens.

### 5. Single Source of Truth
MongoDB is the authoritative data source. Local cache is ephemeral.

---

## 📊 Data Models

### Core Domain Models

#### User

```typescript
interface User {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  totalPoints: number;           // Cumulative points
  profile: {
    name: string;
    height: number;              // in cm
    birthDate?: Date;
  };
  settings: {
    timezone: string;            // e.g., 'Asia/Kolkata'
    notifications: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

#### Task (RoutineTask)

```typescript
interface Task {
  _id: ObjectId;
  title: string;
  domainId: DomainType;
  order: number;
  isScheduled: boolean;
  startTime?: string;            // "HH:mm"
  endTime?: string;              // "HH:mm"
  notificationsEnabled: boolean;
  timeOfDay: TimeOfDay;
  basePoints: number;            // 1-10
  isActive: boolean;             // Soft delete
  recurrenceType: RecurrenceType;
  recurrenceDays: number[];      // [0-6] for custom
  createdAt: Date;
  updatedAt: Date;
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
  | 'daily' 
  | 'weekdays' 
  | 'weekends' 
  | 'custom';
```

#### DailyLog

```typescript
interface DailyLog {
  _id: ObjectId;
  taskId: ObjectId;              // Reference to Task
  date: Date;                    // Normalized to midnight
  completedAt?: Date;            // Actual completion time
  status: 'completed' | 'pending' | 'skipped';
  pointsEarned: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Health Domain Models

#### WeightLog

```typescript
interface WeightLog {
  _id: ObjectId;
  date: Date;
  weight: number;                // in kg
  createdAt: Date;
  updatedAt: Date;
}
```

#### HealthPage

```typescript
interface HealthPage {
  _id: ObjectId;
  title: string;                 // "Day A - Push"
  description?: string;
  cycleStatus?: 'current' | 'done';
  createdAt: Date;
  updatedAt: Date;
}
```

#### ExerciseDefinition

```typescript
interface ExerciseDefinition {
  _id: ObjectId;
  pageId: ObjectId;              // Reference to HealthPage
  title: string;                 // "Bench Press"
  type: 'reps_weight' | 'duration';
  targetMuscles: string[];       // ['chest', 'triceps']
  impact: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
}
```

#### ExerciseLog

```typescript
interface ExerciseLog {
  _id: ObjectId;
  date: Date;
  exerciseId: ObjectId;          // Reference to ExerciseDefinition
  sets: Array<{
    reps?: number;
    weight?: number;             // in kg
    duration?: number;           // in minutes
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

#### MoodLog

```typescript
interface MoodLog {
  _id: ObjectId;
  date: Date;
  mood: 'great' | 'good' | 'okay' | 'low' | 'bad';
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Books Domain Models

#### BookDomain

```typescript
interface BookDomain {
  _id: ObjectId;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Book

```typescript
interface Book {
  _id: ObjectId;
  domainId: ObjectId;
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  status: 'reading' | 'paused' | 'completed' | 'dropped';
  startDate: Date;
  completedDate?: Date;
  rating?: number;               // 1-5
  notes?: string;
  isScheduled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### BookLog

```typescript
interface BookLog {
  _id: ObjectId;
  bookId: ObjectId;
  date: Date;
  pagesRead: number;
  currentPage: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Learning Domain Models

#### LearningArea

```typescript
interface LearningArea {
  _id: ObjectId;
  title: string;
  description?: string;
  color: string;
  icon: string;
  totalMinutes: number;          // Aggregated
  createdAt: Date;
  updatedAt: Date;
}
```

#### LearningSkill

```typescript
interface LearningSkill {
  _id: ObjectId;
  areaId: ObjectId;
  title: string;
  description?: string;
  totalMinutes: number;          // Aggregated
  createdAt: Date;
  updatedAt: Date;
}
```

#### PracticeMedium

```typescript
interface PracticeMedium {
  _id: ObjectId;
  skillId: ObjectId;
  title: string;
  description?: string;
  icon?: string;
  totalSessions: number;
  totalMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### LearningLog

```typescript
interface LearningLog {
  _id: ObjectId;
  mediumId: ObjectId;
  date: Date;
  duration: number;              // in minutes
  activities?: string;
  difficulty: 'easy' | 'moderate' | 'challenging' | 'hard';
  notes?: string;
  rating?: number;               // 1-5
  createdAt: Date;
  updatedAt: Date;
}
```

### Sync Models

#### SyncState

```typescript
interface SyncState {
  _id: ObjectId;
  deviceId: string;
  needsUpdate: boolean;
  lastSync: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### DailyStreakRecord

```typescript
interface DailyStreakRecord {
  _id: ObjectId;
  date: Date;
  isValid: boolean;
  isRestDay: boolean;
  totalTasks: number;
  completedTasks: number;
  points: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 🗂️ Entity Relationships

```
┌─────────────────────────────────────────────────────────┐
│                        USER                             │
│                          │                              │
│        ┌─────────────────┼─────────────────┐            │
│        │                 │                 │            │
│        ▼                 ▼                 ▼            │
│   ┌─────────┐      ┌──────────┐     ┌───────────┐      │
│   │  TASK   │      │ WEIGHT   │     │   MOOD    │      │
│   │         │      │   LOG    │     │   LOG     │      │
│   └────┬────┘      └──────────┘     └───────────┘      │
│        │                                                │
│        ▼                                                │
│   ┌─────────┐                                          │
│   │ DAILY   │                                          │
│   │  LOG    │                                          │
│   └─────────┘                                          │
│                                                         │
│   ┌──────────────────────────────────────────────────┐ │
│   │                    HEALTH                         │ │
│   │  ┌────────────┐                                   │ │
│   │  │HealthPage  │                                   │ │
│   │  └─────┬──────┘                                   │ │
│   │        │                                          │ │
│   │        ▼                                          │ │
│   │  ┌────────────────┐                               │ │
│   │  │ExerciseDefinit.│                               │ │
│   │  └───────┬────────┘                               │ │
│   │          │                                        │ │
│   │          ▼                                        │ │
│   │  ┌────────────┐                                   │ │
│   │  │ExerciseLog │                                   │ │
│   │  └────────────┘                                   │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
│   ┌──────────────────────────────────────────────────┐ │
│   │                    BOOKS                          │ │
│   │  ┌───────────┐                                    │ │
│   │  │BookDomain │                                    │ │
│   │  └─────┬─────┘                                    │ │
│   │        │                                          │ │
│   │        ▼                                          │ │
│   │  ┌───────────┐                                    │ │
│   │  │   Book    │                                    │ │
│   │  └─────┬─────┘                                    │ │
│   │        │                                          │ │
│   │        ▼                                          │ │
│   │  ┌───────────┐                                    │ │
│   │  │  BookLog  │                                    │ │
│   │  └───────────┘                                    │ │
│   └──────────────────────────────────────────────────┘ │
│                                                         │
│   ┌──────────────────────────────────────────────────┐ │
│   │                   LEARNING                        │ │
│   │  ┌──────────────┐                                 │ │
│   │  │LearningArea  │                                 │ │
│   │  └──────┬───────┘                                 │ │
│   │         │                                         │ │
│   │         ▼                                         │ │
│   │  ┌──────────────┐                                 │ │
│   │  │LearningSkill │                                 │ │
│   │  └──────┬───────┘                                 │ │
│   │         │                                         │ │
│   │         ▼                                         │ │
│   │  ┌──────────────┐                                 │ │
│   │  │PracticeMedium│                                 │ │
│   │  └──────┬───────┘                                 │ │
│   │         │                                         │ │
│   │         ▼                                         │ │
│   │  ┌──────────────┐                                 │ │
│   │  │ LearningLog  │                                 │ │
│   │  └──────────────┘                                 │ │
│   └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🏛️ Application Architecture

### Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                   │
│  ┌────────────────────────────────────────────────────┐│
│  │ React Components (Client Components)               ││
│  │ - HomeClient, HealthClient, RoutineList, etc.     ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                    │
│  ┌────────────────────────────────────────────────────┐│
│  │ Server Actions (src/app/actions/)                  ││
│  │ - routine.ts, health.ts, books.ts, learning.ts    ││
│  └────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────┐│
│  │ API Routes (src/app/api/)                          ││
│  │ - /api/home, /api/sync/*                          ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                       │
│  ┌────────────────────────────────────────────────────┐│
│  │ Utilities (src/lib/)                               ││
│  │ - reactive-cache.ts, sync-manager.ts              ││
│  │ - date-utils.ts, better.ts                        ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                      DATA LAYER                         │
│  ┌────────────────────────────────────────────────────┐│
│  │ Mongoose Models (src/models/)                      ││
│  │ - Task.ts, DailyLog.ts, WeightLog.ts, etc.        ││
│  └────────────────────────────────────────────────────┘│
│  ┌────────────────────────────────────────────────────┐│
│  │ MongoDB Database                                   ││
│  │ - Collections for all models                       ││
│  └────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
main-repo/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Home page
│   │   ├── globals.css             # Global styles
│   │   │
│   │   ├── actions/                # Server Actions
│   │   │   ├── auth.ts
│   │   │   ├── routine.ts
│   │   │   ├── health.ts
│   │   │   ├── books.ts
│   │   │   ├── learning.ts
│   │   │   └── reports.ts
│   │   │
│   │   ├── api/                    # API Routes
│   │   │   ├── home/route.ts
│   │   │   └── sync/
│   │   │       ├── check-update/
│   │   │       ├── mark-update/
│   │   │       ├── mark-synced/
│   │   │       └── notify-change/
│   │   │
│   │   ├── routine/                # Routine pages
│   │   ├── health/                 # Health pages
│   │   ├── books/                  # Books pages
│   │   ├── learning/               # Learning pages
│   │   ├── reports/                # Reports pages
│   │   └── login/                  # Auth pages
│   │
│   ├── components/                 # React Components
│   │   ├── ui/                     # Base UI components
│   │   ├── layout/                 # Layout components
│   │   ├── MuscleMap.tsx
│   │   ├── SwipeableTask.tsx
│   │   └── AuthGuard.tsx
│   │
│   ├── lib/                        # Utilities
│   │   ├── db.ts                   # MongoDB connection
│   │   ├── reactive-cache.ts       # Caching system
│   │   ├── sync-manager.ts         # Sync orchestration
│   │   ├── action-wrapper.ts       # Server action helpers
│   │   ├── date-utils.ts           # Date handling
│   │   ├── better.ts               # Better % calculation
│   │   ├── utils.ts                # General utilities
│   │   ├── haptics.ts              # Haptic feedback
│   │   └── auth-storage.ts         # Auth token storage
│   │
│   └── models/                     # Mongoose Models
│       ├── User.ts
│       ├── Task.ts
│       ├── DailyLog.ts
│       ├── WeightLog.ts
│       ├── HealthPage.ts
│       ├── ExerciseDefinition.ts
│       ├── ExerciseLog.ts
│       ├── MoodLog.ts
│       ├── Book.ts
│       ├── BookDomain.ts
│       ├── BookLog.ts
│       ├── LearningArea.ts
│       ├── LearningSkill.ts
│       ├── PracticeMedium.ts
│       ├── LearningLog.ts
│       ├── SyncState.ts
│       └── DailyStreakRecord.ts
│
├── android/                        # Capacitor Android
├── public/                         # Static assets
├── scripts/                        # Build scripts
└── readmes/                        # Documentation
```

---

## 🔐 Authentication

### Flow

```
┌──────────────────────────────────────────────────────┐
│                    LOGIN FLOW                        │
│                                                      │
│  1. User enters password                             │
│  2. Server validates against stored hash             │
│  3. JWT token generated (7-day expiry)               │
│  4. Token stored in Capacitor Preferences            │
│  5. Redirect to home                                 │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Token Storage

```typescript
// For web (localStorage)
localStorage.setItem('lifeos_token', token);

// For mobile (Capacitor Preferences)
await Preferences.set({ key: 'lifeos_token', value: token });
```

### AuthGuard Component

```typescript
function AuthGuard({ children }) {
  const [isValid, setIsValid] = useState(false);
  
  useEffect(() => {
    authStorage.isTokenValid().then(setIsValid);
  }, []);
  
  if (!isValid) {
    return <Redirect to="/login" />;
  }
  
  return children;
}
```

---

## 📱 Mobile (Capacitor)

### Plugins Used

| Plugin | Purpose |
|--------|---------|
| `@capacitor/preferences` | Persistent storage |
| `@capacitor/haptics` | Haptic feedback |
| `@capacitor/share` | Native share sheet |
| `@capacitor/filesystem` | File access |
| `@capacitor/push-notifications` | Push notifications |

### Capacitor Config

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.lifeos.app',
  appName: 'LifeOS',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};
```

### Building for Android

```bash
npm run build              # Build Next.js
npx cap sync android       # Sync to Android
npx cap open android       # Open in Android Studio
```

---

## 🎨 Styling

### Tech Stack

- **Tailwind CSS 4** - Utility-first CSS
- **tailwind-merge** - Class merging utility
- **tailwindcss-animate** - Animation utilities
- **Framer Motion** - Animation library

### Theme

Dark theme with CSS custom properties:

```css
:root {
  --background: 0 0% 7%;
  --foreground: 0 0% 95%;
  --card: 0 0% 10%;
  --primary: 142 76% 36%;
  --secondary: 0 0% 15%;
  --muted: 0 0% 40%;
  --border: 0 0% 20%;
}
```

### Component Pattern

```typescript
import { cn } from '@/lib/utils';

function Button({ className, ...props }) {
  return (
    <button 
      className={cn(
        "px-4 py-2 rounded-lg bg-primary text-white",
        className
      )}
      {...props}
    />
  );
}
```

---

## 📦 State Management

### Redux Toolkit

```typescript
// Store setup
const store = configureStore({
  reducer: {
    // reducers here
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(persistMiddleware),
});

// Redux Persist
const persistConfig = {
  key: 'root',
  storage,
};
```

### Reactive Cache

Primary state management for server data:

```typescript
// Read from cache
const data = getCache(CACHE_KEYS.HOME_DATA);

// Write to cache (triggers subscribers)
setCache(CACHE_KEYS.HOME_DATA, newData);

// Subscribe to changes
const unsubscribe = subscribe(CACHE_KEYS.HOME_DATA, (data) => {
  console.log('Data updated:', data);
});
```

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - UI implementation
- [Routine System](./ROUTINE.md) - Task logic
- [Sync System](./SYNC.md) - Real-time sync details
- [Mobile App](./MOBILE.md) - Capacitor setup
