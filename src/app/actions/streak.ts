'use server';

import connectDB from '@/lib/db';
import DailyStreakRecord, { STREAK_TARGETS } from '@/models/DailyStreakRecord';
import DailyLog from '@/models/DailyLog';
import ExerciseLog from '@/models/ExerciseLog';
import BookLog from '@/models/BookLog';
import Book from '@/models/Book';
import { revalidatePath } from 'next/cache';
import {
  getTodayDateString,
  getDateRange,
  dayjs
} from '@/lib/server-date-utils';

const MIN_ROUTINE_TASKS = 5;
const MIN_BOOK_READING_MINUTES = 5;
const BOOK_TASK_POINTS = 20;

// ===== Batch helpers: fetch all data for a date range in 2 queries =====

interface DayCounts {
  routineTasks: number;
  exerciseCount: number;
}

/**
 * Batch-fetch routine task counts and exercise counts for a date range.
 * Returns a Map<YYYY-MM-DD, DayCounts> — 2 aggregate queries total.
 */
async function batchFetchDayCounts(startDate: Date, endDate: Date): Promise<Map<string, DayCounts>> {
  const map = new Map<string, DayCounts>();

  const [routineAgg, exerciseAgg] = await Promise.all([
    DailyLog.aggregate([
      { $match: { date: { $gte: startDate, $lt: endDate }, status: 'completed' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
    ]),
    ExerciseLog.aggregate([
      { $match: { date: { $gte: startDate, $lt: endDate } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
    ]),
  ]);

  for (const r of routineAgg) {
    const existing = map.get(r._id) || { routineTasks: 0, exerciseCount: 0 };
    existing.routineTasks = r.count;
    map.set(r._id, existing);
  }
  for (const e of exerciseAgg) {
    const existing = map.get(e._id) || { routineTasks: 0, exerciseCount: 0 };
    existing.exerciseCount = e.count;
    map.set(e._id, existing);
  }

  return map;
}

/** Check if a day is valid for streak using pre-fetched data */
function isDayValidFromCounts(
  dateStr: string,
  counts: Map<string, DayCounts>,
): { valid: boolean; isRestDay: boolean; routineTasks: number; hasExercise: boolean } {
  const dc = counts.get(dateStr) || { routineTasks: 0, exerciseCount: 0 };
  const hasExercise = dc.exerciseCount > 0;
  const hasEnoughTasks = dc.routineTasks >= MIN_ROUTINE_TASKS;

  if (hasExercise && hasEnoughTasks) {
    return { valid: true, isRestDay: false, routineTasks: dc.routineTasks, hasExercise };
  }

  if (hasEnoughTasks && !hasExercise) {
    // Check rest day: at least 1 consecutive workout day before this date
    const isRestDay = canBeRestDayFromCounts(dateStr, counts);
    return { valid: isRestDay, isRestDay, routineTasks: dc.routineTasks, hasExercise };
  }

  return { valid: false, isRestDay: false, routineTasks: dc.routineTasks, hasExercise };
}

/** Check rest-day eligibility from pre-fetched counts (no DB queries) */
function canBeRestDayFromCounts(dateStr: string, counts: Map<string, DayCounts>): boolean {
  const checkDate = dayjs(dateStr).tz('Asia/Kolkata').subtract(1, 'day');
  for (let i = 0; i < 10; i++) {
    const ds = checkDate.format('YYYY-MM-DD');
    const dc = counts.get(ds);
    if (dc && dc.exerciseCount > 0) {
      return true; // Found at least 1 consecutive workout day
    }
    // No exercise this day — stop looking
    break;
  }
  return false;
}

// Legacy per-query helpers kept for updateStreakForDate (called rarely)
async function canBeRestDay(dateStr: string): Promise<boolean> {
  const checkDate = dayjs(dateStr).tz('Asia/Kolkata');
  const dayToCheck = checkDate.subtract(1, 'day');
  for (let i = 0; i < 10; i++) {
    const { startOfDay, endOfDay } = getDateRange(dayToCheck.format('YYYY-MM-DD'));
    const exerciseCount = await ExerciseLog.countDocuments({ date: { $gte: startOfDay, $lt: endOfDay } });
    if (exerciseCount > 0) return true;
    break;
  }
  return false;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayValid: boolean;
  todayRoutineTasks: number;
  todayHasExercise: boolean;
  todayIsRestDay: boolean;
  todayCanBeRestDay: boolean;
  last7Days: { date: string; valid: boolean; isRestDay?: boolean }[];
  nextTarget: { days: number; points: number; label: string } | null;
  totalStreakPoints: number;
  reachedMilestones: { days: number; points: number; label: string }[];
}

// Calculate and update streak for a specific date
export async function updateStreakForDate(dateStr: string) {
  await connectDB();
  
  const { startOfDay, endOfDay } = getDateRange(dateStr);
  
  // Count completed routine tasks
  const completedTasks = await DailyLog.countDocuments({
    date: { $gte: startOfDay, $lt: endOfDay },
    status: 'completed'
  });
  
  // Check for exercise logs
  const exerciseLogs = await ExerciseLog.countDocuments({
    date: { $gte: startOfDay, $lt: endOfDay }
  });
  
  const hasExercise = exerciseLogs > 0;
  
  // Check if today is a valid rest day
  // Valid if: has enough tasks AND (is workout day OR can be rest day)
  const canRest = await canBeRestDay(dateStr);
  
  // Streak is valid if:
  // 1. Tasks done + Exercise done (Standard)
  // 2. Tasks done + No Exercise but can be rest day (Rest Day)
  const streakValid = completedTasks >= MIN_ROUTINE_TASKS && (hasExercise || canRest);
  
  // Calculate current streak to determine milestones
  let currentStreak = 0;
  if (streakValid) {
    // Count consecutive valid days backwards from this date
    currentStreak = 1;
    let checkDate = dayjs(dateStr).tz('Asia/Kolkata').subtract(1, 'day');
    
    while (true) {
      const prevRecord = await DailyStreakRecord.findOne({
        date: { 
          $gte: checkDate.startOf('day').toDate(),
          $lt: checkDate.add(1, 'day').startOf('day').toDate()
        }
      });
      
      if (prevRecord && prevRecord.streakValid) {
        currentStreak++;
        checkDate = checkDate.subtract(1, 'day');
      } else {
        break;
      }
    }
  }
  
  // Find new milestones reached
  const existingRecord = await DailyStreakRecord.findOne({
    date: { $gte: startOfDay, $lt: endOfDay }
  });
  
  const previousMilestones = existingRecord?.milestonesReached || [];
  const newMilestones: number[] = [];
  let bonusPoints = 0;
  
  if (streakValid) {
    for (const target of STREAK_TARGETS) {
      if (currentStreak >= target.days && !previousMilestones.includes(target.days)) {
        newMilestones.push(target.days);
        bonusPoints += target.points;
      }
    }
  }
  
  // Update or create record
  await DailyStreakRecord.findOneAndUpdate(
    { date: { $gte: startOfDay, $lt: endOfDay } },
    {
      date: startOfDay,
      routineTasksCompleted: completedTasks,
      hasExerciseLog: hasExercise,
      streakValid,
      bonusPointsAwarded: (existingRecord?.bonusPointsAwarded || 0) + bonusPoints,
      milestonesReached: [...previousMilestones, ...newMilestones]
    },
    { upsert: true, new: true }
  );
  
  revalidatePath('/');
  return { streakValid, currentStreak, bonusPoints };
}

// Get streak data for homepage — optimized: 4 queries total instead of 80-150+
export async function getStreakData(): Promise<StreakData> {
  await connectDB();

  const now = dayjs().tz('Asia/Kolkata');
  const today = now.format('YYYY-MM-DD');

  // Fetch 400 days of data in 2 aggregate queries (covers up to 365-day streak + 7-day window)
  const rangeStart = now.subtract(400, 'day').startOf('day').toDate();
  const rangeEnd = now.endOf('day').toDate();

  const [counts, allRecords, totalStreakPointsResult] = await Promise.all([
    batchFetchDayCounts(rangeStart, rangeEnd),
    DailyStreakRecord.find({ streakValid: true }).sort({ date: 1 }).lean(),
    DailyStreakRecord.aggregate([
      { $group: { _id: null, total: { $sum: '$bonusPointsAwarded' } } },
    ]),
  ]);

  // Today's validation from pre-fetched counts
  const todayResult = isDayValidFromCounts(today, counts);
  const todayValid = todayResult.valid;
  const todayRoutineTasks = todayResult.routineTasks;
  const todayHasExercise = todayResult.hasExercise;
  const todayIsRestDay = todayResult.isRestDay;
  const todayCanBeRestDay = canBeRestDayFromCounts(today, counts);

  // Current streak: count backwards from yesterday using pre-fetched data
  let currentStreak = 0;
  let checkDate = now.subtract(1, 'day');
  while (currentStreak <= 365) {
    const dateStr = checkDate.format('YYYY-MM-DD');
    const dayResult = isDayValidFromCounts(dateStr, counts);
    if (!dayResult.valid) break;
    currentStreak++;
    checkDate = checkDate.subtract(1, 'day');
  }
  if (todayValid) currentStreak++;

  // Longest streak from DailyStreakRecord (already fetched)
  let longestStreak = currentStreak;
  let tempStreak = 0;
  let prevDate: dayjs.Dayjs | null = null;
  for (const record of allRecords) {
    const recordDate = dayjs(record.date).tz('Asia/Kolkata');
    if (prevDate && recordDate.diff(prevDate, 'day') === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    prevDate = recordDate;
  }

  // Last 7 days from pre-fetched data
  const last7Days: { date: string; valid: boolean; isRestDay?: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = now.subtract(i, 'day').format('YYYY-MM-DD');
    if (i === 0) {
      last7Days.push({ date: dateStr, valid: todayValid, isRestDay: todayIsRestDay });
    } else {
      const r = isDayValidFromCounts(dateStr, counts);
      last7Days.push({ date: dateStr, valid: r.valid, isRestDay: r.isRestDay });
    }
  }

  // Next target
  let nextTarget: { days: number; points: number; label: string } | null = null;
  for (const target of STREAK_TARGETS) {
    if (currentStreak < target.days) {
      nextTarget = target;
      break;
    }
  }

  const totalStreakPoints = totalStreakPointsResult[0]?.total || 0;
  const reachedMilestones = STREAK_TARGETS.filter(t => currentStreak >= t.days);

  return {
    currentStreak,
    longestStreak,
    todayValid,
    todayRoutineTasks,
    todayHasExercise,
    todayIsRestDay,
    todayCanBeRestDay,
    last7Days,
    nextTarget,
    totalStreakPoints,
    reachedMilestones,
  };
}

// Get special tasks for domains (auto-generated based on activity)
export async function getSpecialTasks(dateStr?: string) {
  await connectDB();
  
  const today = dateStr || getTodayDateString();
  const { startOfDay, endOfDay } = getDateRange(today);
  
  const specialTasks: Array<{
    _id: string;
    title: string;
    type: 'health' | 'books' | 'learning';
    points: number;
    completed: boolean;
    source: string;
  }> = [];
  
  // Check for book reading logs today (at least 5 minutes per book)
  const bookLogs = await BookLog.find({
    date: { $gte: startOfDay, $lt: endOfDay },
    duration: { $gte: MIN_BOOK_READING_MINUTES }
  });
  
  // Also check book check-ins (lastReadDate = today)
  const booksReadToday = await Book.find({
    lastReadDate: { $gte: startOfDay, $lt: endOfDay }
  });
  
  // Combine unique books
  const readBookIds = new Set([
    ...bookLogs.map((l: { bookId: { toString: () => string } }) => l.bookId.toString()),
    ...booksReadToday.map((b: { _id: { toString: () => string } }) => b._id.toString())
  ]);
  
  // Batch fetch all books at once instead of N+1 queries
  const books = await Book.find({ _id: { $in: [...readBookIds] } }).lean();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookMap = new Map(books.map((b: Record<string, any>) => [b._id.toString(), b]));
  
  for (const bookId of readBookIds) {
    const book = bookMap.get(bookId);
    if (book) {
      specialTasks.push({
        _id: `special-book-${bookId}-${today}`,
        title: `Read Book (${(book as { title: string }).title.substring(0, 20)}${(book as { title: string }).title.length > 20 ? '...' : ''})`,
        type: 'books',
        points: BOOK_TASK_POINTS,
        completed: true,
        source: (book as { title: string }).title
      });
    }
  }
  
  console.log('[getSpecialTasks] Final special tasks count:', specialTasks.length);
  console.log('[getSpecialTasks] All special tasks:', specialTasks);
  
  return specialTasks;
}

// Calculate total points including streak bonuses and special tasks
export async function getTotalPointsWithBonuses() {
  await connectDB();
  
  const today = getTodayDateString();
  const { startOfDay, endOfDay } = getDateRange(today);

  // Run all independent queries in parallel
  const [basePointsResult, streakBonusResult, booksReadToday] = await Promise.all([
    DailyLog.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$pointsEarned' } } },
    ]),
    DailyStreakRecord.aggregate([
      { $group: { _id: null, total: { $sum: '$bonusPointsAwarded' } } },
    ]),
    Book.countDocuments({
      lastReadDate: { $gte: startOfDay, $lt: endOfDay },
    }),
  ]);

  const basePoints = basePointsResult[0]?.total || 0;
  const streakBonus = streakBonusResult[0]?.total || 0;
  const bookPoints = booksReadToday * BOOK_TASK_POINTS;

  return {
    basePoints,
    streakBonus,
    specialTaskPoints: bookPoints,
    totalPoints: basePoints + streakBonus + bookPoints,
  };
}
