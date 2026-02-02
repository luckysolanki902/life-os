# 📚 Books Tracker

> *Manage your reading journey*

The Books module helps you track your reading habits across different domains. Organize books by category, track progress, and maintain consistent reading habits.

---

## 📍 Overview

Access via `/books` - your digital reading list with:
- Book domains/categories
- Reading status tracking
- Progress check-ins
- Reading routine integration

---

## 📂 Book Domains

Organize your reading by topic or genre.

```
┌─────────────────────────────────┐
│  📂 My Book Domains             │
│                                 │
│  📚 Business & Entrepreneurship │
│     12 books • 4 reading        │
│                                 │
│  🧠 Self-Improvement            │
│     8 books • 2 reading         │
│                                 │
│  📖 Fiction                     │
│     15 books • 1 reading        │
│                                 │
│  💻 Technical                   │
│     6 books • 1 reading         │
│                                 │
│  [+ New Domain]                 │
└─────────────────────────────────┘
```

### Domain Model

```typescript
interface BookDomain {
  _id: string;
  name: string;           // "Business & Entrepreneurship"
  description?: string;   // "Books about startups and business"
  color: DomainColor;     // 'blue' | 'purple' | 'emerald' | etc.
  icon?: string;          // Emoji icon "📚"
}

type DomainColor = 
  | 'blue' 
  | 'purple' 
  | 'emerald' 
  | 'orange' 
  | 'rose' 
  | 'cyan'
  | 'amber'
  | 'indigo';
```

### Domain Colors

Each domain has a distinct color for visual organization:

| Color | Use Case |
|-------|----------|
| 🔵 Blue | Business, Professional |
| 🟣 Purple | Philosophy, Psychology |
| 🟢 Emerald | Health, Wellness |
| 🟠 Orange | Creativity, Art |
| 🔴 Rose | Fiction, Literature |
| 🔷 Cyan | Technology, Science |
| 🟡 Amber | Finance, Economics |
| 🟦 Indigo | Spirituality |

---

## 📖 Books

### Adding a Book

```
┌─────────────────────────────────┐
│  ➕ Add New Book                │
│                                 │
│  Title: [Atomic Habits        ] │
│  Author: [James Clear         ] │
│                                 │
│  Domain: [Self-Improvement   ▼] │
│                                 │
│  Total Pages: [320           ]  │
│  Start Date: [2026-02-03    📅] │
│                                 │
│  Notes:                         │
│  [Great recommendation from... ]│
│                                 │
│  [Cancel]           [Add]       │
└─────────────────────────────────┘
```

### Book Model

```typescript
interface Book {
  _id: string;
  domainId: ObjectId;          // Reference to BookDomain
  title: string;               // "Atomic Habits"
  author: string;              // "James Clear"
  totalPages: number;          // 320
  currentPage: number;         // 145 (from check-ins)
  status: BookStatus;          // 'reading' | 'completed' | etc.
  startDate: Date;             // When started reading
  completedDate?: Date;        // When finished
  rating?: number;             // 1-5 stars
  notes?: string;              // Personal notes
  isScheduled: boolean;        // Linked to routine task
}

type BookStatus = 
  | 'reading'    // Currently reading
  | 'paused'     // On hold
  | 'completed'  // Finished
  | 'dropped';   // Abandoned
```

---

## 📊 Reading Status

### Status Flow

```
         ┌─────────┐
         │ reading │◄────────┐
         └────┬────┘         │
              │              │
    ┌─────────┼─────────┐    │
    ▼         ▼         ▼    │
┌───────┐ ┌───────┐ ┌───────┐│
│paused │ │compl. │ │dropped││
└───┬───┘ └───────┘ └───────┘│
    │                        │
    └────────────────────────┘
      (resume reading)
```

### Status Icons & Colors

| Status | Icon | Color | Meaning |
|--------|------|-------|---------|
| Reading | 📖 | Emerald | Currently active |
| Paused | ⏸️ | Amber | Temporarily on hold |
| Completed | ✅ | Blue | Successfully finished |
| Dropped | ❌ | Rose | Won't finish |

---

## ✓ Check-In System

Track your reading progress with check-ins.

```
┌─────────────────────────────────┐
│  📖 Atomic Habits               │
│  by James Clear                 │
│                                 │
│  Progress: 145 / 320 pages      │
│  ████████████░░░░░░░░ 45%       │
│                                 │
│  Last check-in: 2 days ago      │
│                                 │
│  [Check In]                     │
└─────────────────────────────────┘
```

### Check-In Action

When you tap "Check In":

```
┌─────────────────────────────────┐
│  📝 Reading Check-In            │
│                                 │
│  Atomic Habits                  │
│  Current: Page 145              │
│                                 │
│  Now on page: [175           ]  │
│                                 │
│  Pages read: 30 (auto-calc)     │
│                                 │
│  [Cancel]         [Check In]    │
└─────────────────────────────────┘
```

### Check-In Benefits

- Updates `currentPage` on book
- Records reading session
- Contributes to streak (if scheduled)
- Shows in "Recently Read" section

---

## 🔗 Scheduled Books

Link books to your daily routine.

### How It Works

1. Create a routine task: "Read for 30 mins"
2. Set `isScheduled: true` on a book
3. Book appears in Home's special tasks
4. Completing task = reading check-in

### Scheduled Books Widget

```
┌─────────────────────────────────┐
│  📚 Today's Reading             │
│                                 │
│  📖 Atomic Habits               │
│     Page 145/320 • 45%          │
│     [Check In]                  │
│                                 │
│  📖 Zero to One                 │
│     Page 89/210 • 42%           │
│     [Check In]                  │
└─────────────────────────────────┘
```

---

## 🔍 Search

Find books quickly across your library.

```
┌─────────────────────────────────┐
│  🔍 [atomic                   ] │
│                                 │
│  Search Results:                │
│                                 │
│  📖 Atomic Habits               │
│     Self-Improvement • Reading  │
│                                 │
│  📖 Atomic Design               │
│     Technical • Completed       │
└─────────────────────────────────┘
```

### Search Features

- Search by title
- Search by author
- Real-time results (300ms debounce)
- Minimum 2 characters

---

## 📈 Reading Stats

### Book Dashboard Stats

```
┌─────────────────────────────────┐
│  📊 Reading Stats               │
│                                 │
│  Currently Reading:    8 books  │
│  Completed This Year:  12 books │
│  Total Pages Read:     4,521    │
│  Avg Pages/Day:        15.2     │
│                                 │
└─────────────────────────────────┘
```

### Stats in Reports

- Books completed by period
- Pages read trend
- Reading streak
- Domain distribution

---

## 📋 Recently Read

Quick access to books with recent activity.

```
┌─────────────────────────────────┐
│  📖 Recently Read               │
│                                 │
│  Today:                         │
│  • Atomic Habits (pg 175)       │
│                                 │
│  Yesterday:                     │
│  • Zero to One (pg 89)          │
│                                 │
│  3 days ago:                    │
│  • Deep Work (pg 201)           │
└─────────────────────────────────┘
```

---

## 🎨 UI Components

### Book Card

```
┌─────────────────────────────────┐
│  📖 Atomic Habits               │
│  James Clear                    │
│                                 │
│  ████████████░░░░░░░░ 45%       │
│  145/320 pages                  │
│                                 │
│  🏷️ Self-Improvement  📖 Reading │
│                                 │
│  [Check In]  [⋮ More]           │
└─────────────────────────────────┘
```

### Context Menu

Tap the ⋮ menu for options:

- ✏️ Edit Book
- 📊 View Details
- ⏸️ Pause/Resume
- ✅ Mark Complete
- ❌ Drop Book
- 🗑️ Delete

---

## 🛠️ Technical Details

### Files
- `src/app/books/page.tsx` - Server component
- `src/app/books/BooksClient.tsx` - Main UI
- `src/app/books/BooksTableView.tsx` - Table layout
- `src/app/books/SimpleBooksClient.tsx` - Minimal view
- `src/app/actions/books.ts` - Server actions

### Key Actions

```typescript
// Domains
createBookDomain(data: Partial<BookDomain>)
updateBookDomain(id: string, data: Partial<BookDomain>)
deleteBookDomain(id: string)

// Books
createBook(data: Partial<Book>)
updateBook(id: string, data: Partial<Book>)
deleteBook(id: string)
searchBooks(query: string)

// Check-ins
checkInBook(bookId: string, currentPage?: number)
```

### Data Flow

```
┌─────────────┐     ┌─────────────┐
│ BookDomain  │◄────│    Book     │
└─────────────┘     └──────┬──────┘
                          │
                          │ references
                          ▼
                    ┌─────────────┐
                    │  BookLog    │
                    │ (check-ins) │
                    └─────────────┘
```

### BookLog Model

```typescript
interface BookLog {
  _id: string;
  bookId: ObjectId;
  date: Date;
  pagesRead: number;      // Pages in this session
  currentPage: number;    // Page reached
  notes?: string;
}
```

---

## 📊 Reports Integration

Books data appears in Reports:

- **Books Completed** - Count by period
- **Pages Read** - Trend chart
- **Reading Streak** - Consistency tracking
- **Domain Distribution** - Pie chart

---

## 🔗 Related Documentation

- [Home Dashboard](./HOME.md) - Scheduled books widget
- [Routine System](./ROUTINE.md) - Reading tasks
- [Reports](./REPORTS.md) - Reading analytics
- [Learning Hub](./LEARNING.md) - Similar structure
