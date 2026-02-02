# 🧠 Learning Hub

> *Track your skill development journey*

The Learning Hub helps you organize and track deliberate practice across various skills. Structure your learning with Areas, Skills, and Mediums for comprehensive progress tracking.

---

## 📍 Overview

Access via `/learning` - your skill development dashboard with:
- Learning areas (high-level categories)
- Skills (specific abilities)
- Practice mediums (how you learn)
- Session logging
- Time tracking

---

## 🏗️ Hierarchical Structure

```
Learning Area (e.g., Music)
    │
    ├── Skill (e.g., Guitar)
    │       │
    │       ├── Medium (e.g., Justin Guitar Course)
    │       │       └── Logs (practice sessions)
    │       │
    │       └── Medium (e.g., Songbook Practice)
    │               └── Logs (practice sessions)
    │
    └── Skill (e.g., Piano)
            │
            └── Medium (e.g., Simply Piano App)
                    └── Logs (practice sessions)
```

---

## 🎨 Learning Areas

High-level categories for your learning pursuits.

```
┌─────────────────────────────────┐
│  🎨 My Learning Areas           │
│                                 │
│  🎵 Music                       │
│     Total: 45h 30m              │
│     3 skills • 5 mediums        │
│                                 │
│  💻 Programming                 │
│     Total: 120h 15m             │
│     4 skills • 8 mediums        │
│                                 │
│  🗣️ Languages                   │
│     Total: 30h 0m               │
│     2 skills • 3 mediums        │
│                                 │
│  [+ New Area]                   │
└─────────────────────────────────┘
```

### Area Model

```typescript
interface LearningArea {
  _id: string;
  title: string;          // "Music"
  description?: string;   // "Learning musical instruments"
  color: AreaColor;       // 'blue' | 'purple' | 'emerald' | etc.
  icon: AreaIcon;         // 'music' | 'code' | 'brain' | etc.
  totalMinutes: number;   // Aggregated from all logs
}

type AreaColor = 
  | 'blue' 
  | 'purple' 
  | 'emerald' 
  | 'orange' 
  | 'rose' 
  | 'cyan';

type AreaIcon = 
  | 'music'     // 🎵
  | 'code'      // 💻
  | 'brain'     // 🧠
  | 'art'       // 🎨
  | 'fitness'   // 💪
  | 'language'  // 🗣️
  | 'default';  // 📚
```

### Area Icons

| Icon Key | Visual | Use Case |
|----------|--------|----------|
| music | 🎵 | Musical skills |
| code | 💻 | Programming |
| brain | 🧠 | Mental skills |
| art | 🎨 | Creative arts |
| fitness | 💪 | Physical skills |
| language | 🗣️ | Languages |
| default | 📚 | General learning |

---

## 🎯 Skills

Specific abilities within a learning area.

```
┌─────────────────────────────────┐
│  🎵 Music                       │
│                                 │
│  ▼ 🎸 Guitar                    │
│    │  Total: 30h 15m            │
│    │                            │
│    │  📺 Justin Guitar Course   │
│    │     12h 30m • 25 sessions  │
│    │                            │
│    │  📖 Chord Songbook         │
│    │     8h 45m • 18 sessions   │
│    │                            │
│    └─ [+ Add Medium]            │
│                                 │
│  ▶ 🎹 Piano (15h 15m)           │
│                                 │
│  [+ Add Skill]                  │
└─────────────────────────────────┘
```

### Skill Model

```typescript
interface LearningSkill {
  _id: string;
  areaId: ObjectId;       // Parent LearningArea
  title: string;          // "Guitar"
  description?: string;   // "Acoustic guitar fundamentals"
  totalMinutes: number;   // Aggregated from mediums
}
```

---

## 📚 Practice Mediums

How you practice a skill (resources, courses, methods).

```
┌─────────────────────────────────┐
│  📺 Justin Guitar Course        │
│                                 │
│  Total Time: 12h 30m            │
│  Sessions: 25                   │
│  Last practiced: Yesterday      │
│                                 │
│  Recent Sessions:               │
│  • Feb 2: 45m (Moderate)        │
│  • Jan 31: 30m (Easy)           │
│  • Jan 29: 60m (Challenging)    │
│                                 │
│  [Quick Log]    [Full Log]      │
└─────────────────────────────────┘
```

### Medium Model

```typescript
interface PracticeMedium {
  _id: string;
  skillId: ObjectId;         // Parent LearningSkill
  title: string;             // "Justin Guitar Course"
  description?: string;      // "Beginner to intermediate"
  icon?: string;             // Emoji
  totalSessions: number;     // Count of logs
  totalMinutes: number;      // Sum of all log durations
}
```

---

## 📝 Session Logging

### Quick Log

Fast entry for simple sessions.

```
┌─────────────────────────────────┐
│  ⚡ Quick Log                   │
│                                 │
│  Medium: [Justin Guitar    ▼]   │
│  Duration: [30] minutes         │
│  Difficulty: ○Easy ●Mod ○Hard   │
│                                 │
│  [Cancel]          [Log]        │
└─────────────────────────────────┘
```

### Full Log

Detailed entry with notes.

```
┌─────────────────────────────────┐
│  📝 Log Practice Session        │
│                                 │
│  Medium: [Justin Guitar     ▼]  │
│  Date: [2026-02-03         📅]  │
│  Duration: [45        ] mins    │
│                                 │
│  What did you practice?         │
│  [Barre chords, F major shape ] │
│                                 │
│  Difficulty:                    │
│  ○ Easy      ○ Moderate         │
│  ● Challenging  ○ Hard          │
│                                 │
│  Notes:                         │
│  [Still struggling with clean  ]│
│  [barres, need more practice   ]│
│                                 │
│  [Cancel]           [Log]       │
└─────────────────────────────────┘
```

### Log Model

```typescript
interface LearningLog {
  _id: string;
  mediumId: ObjectId;        // Reference to PracticeMedium
  date: Date;                // Session date
  duration: number;          // Minutes practiced
  activities?: string;       // What was practiced
  difficulty: Difficulty;    // Perceived difficulty
  notes?: string;            // Additional notes
  rating?: number;           // 1-5 satisfaction rating
}

type Difficulty = 
  | 'easy'        // Comfortable practice
  | 'moderate'    // Some challenge
  | 'challenging' // Pushed limits
  | 'hard';       // Very difficult
```

### Difficulty Colors

| Difficulty | Color | Meaning |
|------------|-------|---------|
| Easy | 🟢 Emerald | Comfortable, consolidating |
| Moderate | 🟡 Yellow | Good challenge level |
| Challenging | 🟠 Orange | Pushing boundaries |
| Hard | 🔴 Rose | At the edge of ability |

---

## 📊 Time Tracking

### Total Time Display

```typescript
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Examples:
// 45 → "45m"
// 90 → "1h 30m"
// 120 → "2h"
// 1500 → "25h"
```

### Time Aggregation

```
Area Total = Σ(Skill Totals)
Skill Total = Σ(Medium Totals)
Medium Total = Σ(Log Durations)
```

---

## 🕐 Recent Logs

Quick view of recent practice sessions.

```
┌─────────────────────────────────┐
│  🕐 Recent Practice             │
│                                 │
│  Today                          │
│  • Justin Guitar • 45m 🟠       │
│                                 │
│  Yesterday                      │
│  • Python Course • 60m 🟡       │
│  • Duolingo Spanish • 15m 🟢    │
│                                 │
│  3 days ago                     │
│  • Justin Guitar • 30m 🟢       │
└─────────────────────────────────┘
```

### Relative Date Formatting

```typescript
function formatRelativeDate(date: Date): string {
  const diffDays = daysSince(date);
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDate(date, 'D MMM');
}
```

---

## ✅ Learning Routine Tasks

Tasks categorized under "Learning" domain.

```
┌─────────────────────────────────┐
│  Today's Learning Tasks         │
│                                 │
│  ○ Practice guitar (30m)   🎸   │
│  ✓ Duolingo lesson         🗣️   │
│  ○ Read tech articles      💻   │
│                                 │
└─────────────────────────────────┘
```

**Note:** Completing these earns points, while logging sessions is for time tracking.

---

## 🔍 Medium Search

Find mediums across all areas/skills.

```
┌─────────────────────────────────┐
│  🔍 [guitar                   ] │
│                                 │
│  Results:                       │
│                                 │
│  📺 Justin Guitar Course        │
│     Music > Guitar              │
│                                 │
│  📖 Chord Songbook              │
│     Music > Guitar              │
└─────────────────────────────────┘
```

---

## 📈 Learning Stats

### Dashboard Overview

```
┌─────────────────────────────────┐
│  📊 Learning Stats              │
│                                 │
│  Total Practice:    195h 45m    │
│  Active Areas:      4           │
│  Active Skills:     12          │
│  This Week:         8h 30m      │
│  Avg Session:       42m         │
│                                 │
└─────────────────────────────────┘
```

### Stats in Reports

- Learning minutes by period
- Practice frequency
- Skill breakdown
- Difficulty distribution

---

## 🗂️ Expandable UI

### Accordion Behavior

Areas, Skills, and Mediums use expandable sections:

```
▼ 🎵 Music (45h 30m)        ← Expanded
  │
  ├─ ▼ 🎸 Guitar (30h 15m)  ← Expanded
  │    │
  │    ├─ 📺 Justin Guitar   ← Medium
  │    └─ 📖 Songbook        ← Medium
  │
  └─ ▶ 🎹 Piano (15h 15m)   ← Collapsed

▶ 💻 Programming (120h 15m)  ← Collapsed
```

### Expand/Collapse State

```typescript
const [expandedAreas, setExpandedAreas] = useState<Set<string>>(
  new Set(areas.map(a => a._id)) // All expanded by default
);

const [expandedSkills, setExpandedSkills] = useState<Set<string>>(
  new Set() // All collapsed by default
);
```

---

## 🛠️ Technical Details

### Files
- `src/app/learning/page.tsx` - Server component
- `src/app/learning/LearningClient.tsx` - Main UI
- `src/app/learning/SimpleLearningClient.tsx` - Minimal view
- `src/app/actions/learning.ts` - Server actions

### Key Actions

```typescript
// Areas
createArea(data: Partial<LearningArea>)
updateArea(id: string, data: Partial<LearningArea>)
deleteArea(id: string)

// Skills
createSkill(areaId: string, data: Partial<LearningSkill>)
updateSkill(id: string, data: Partial<LearningSkill>)
deleteSkill(id: string)

// Mediums
createMedium(skillId: string, data: Partial<PracticeMedium>)
updateMedium(id: string, data: Partial<PracticeMedium>)
deleteMedium(id: string)

// Logs
createLog(mediumId: string, data: Partial<LearningLog>)
quickLog(mediumId: string, duration: number, difficulty: Difficulty)
```

### Data Flow

```
┌──────────────┐
│ LearningArea │
└──────┬───────┘
       │ hasMany
       ▼
┌──────────────┐
│ LearningSkill│
└──────┬───────┘
       │ hasMany
       ▼
┌──────────────┐
│PracticeMedium│
└──────┬───────┘
       │ hasMany
       ▼
┌──────────────┐
│ LearningLog  │
└──────────────┘
```

---

## 💡 Best Practices

### Structuring Your Learning

1. **Areas** = Broad categories (Music, Programming, Languages)
2. **Skills** = Specific abilities (Guitar, Python, Spanish)
3. **Mediums** = Resources/methods (Course name, Book, App)

### Logging Tips

- Log immediately after practice
- Use Quick Log for most sessions
- Use Full Log when you want to reflect
- Be honest about difficulty

### Time Tracking

- Don't inflate duration
- Include focused practice only
- Breaks don't count

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - Learning tasks widget
- [Routine System](./ROUTINE.md) - Learning domain tasks
- [Reports](./REPORTS.md) - Learning analytics
- [Books Tracker](./BOOKS.md) - Similar hierarchical structure
