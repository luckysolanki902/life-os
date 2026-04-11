/**
 * Reports & Stats Tools Handler
 * MCP tools for reports, streaks, identity metric, and analytics
 */

import connectDB from '@/lib/db';
import Task from '@/models/Task';
import DailyLog from '@/models/DailyLog';
import DailyStreakRecord from '@/models/DailyStreakRecord';
import WeightLog from '@/models/WeightLog';
import ExerciseLog from '@/models/ExerciseLog';
import ExerciseDefinition from '@/models/ExerciseDefinition';
import HealthPage from '@/models/HealthPage';
import MoodLog from '@/models/MoodLog';
import Book from '@/models/Book';
import SimpleLearningLog from '@/models/SimpleLearningLog';
import LearningCategory from '@/models/LearningCategory';
import { dayjs } from '@/lib/server-date-utils';
import { getBetterPercentage } from '@/lib/better';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function textResult(data: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

function getDateRange(period: string): { start: Date; end: Date } {
  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day');
  switch (period) {
    case 'today': return { start: today.toDate(), end: today.add(1, 'day').toDate() };
    case 'last7Days': return { start: today.subtract(6, 'day').toDate(), end: today.add(1, 'day').toDate() };
    case 'last14Days': return { start: today.subtract(13, 'day').toDate(), end: today.add(1, 'day').toDate() };
    case 'thisWeek': return { start: today.startOf('week').toDate(), end: today.add(1, 'day').toDate() };
    case 'lastWeek': {
      const sow = today.startOf('week');
      return { start: sow.subtract(7, 'day').toDate(), end: sow.toDate() };
    }
    case 'thisMonth': return { start: today.startOf('month').toDate(), end: today.add(1, 'day').toDate() };
    case 'lastMonth': {
      const som = today.startOf('month');
      return { start: som.subtract(1, 'month').toDate(), end: som.toDate() };
    }
    case 'last3Months': return { start: today.subtract(3, 'month').toDate(), end: today.add(1, 'day').toDate() };
    case 'last6Months': return { start: today.subtract(6, 'month').toDate(), end: today.add(1, 'day').toDate() };
    case 'thisYear': return { start: today.startOf('year').toDate(), end: today.add(1, 'day').toDate() };
    case 'allTime': return { start: dayjs('2020-01-01').tz(DEFAULT_TIMEZONE).toDate(), end: today.add(1, 'day').toDate() };
    default: return { start: today.toDate(), end: today.add(1, 'day').toDate() };
  }
}

function getPreviousRange(period: string): { start: Date; end: Date } {
  const current = getDateRange(period);
  const duration = current.end.getTime() - current.start.getTime();
  return { start: new Date(current.start.getTime() - duration), end: current.start };
}

// ============ GET OVERALL REPORT ============
export async function getOverallReport(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const period = (args.period as string) || 'thisWeek';
  const { start, end } = getDateRange(period);
  const prev = getPreviousRange(period);
  const numDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);

  // --- Routine ---
  const [currentLogs, prevLogs, activeTasks] = await Promise.all([
    DailyLog.find({ date: { $gte: start, $lt: end } }).lean(),
    DailyLog.find({ date: { $gte: prev.start, $lt: prev.end } }).lean(),
    Task.find({ isActive: true }).countDocuments(),
  ]);

  const currentCompleted = (currentLogs as Record<string, unknown>[]).filter((l) => l.status === 'completed').length;
  // Total = active tasks per day × number of days (tasks that should have been done)
  const currentTotal = activeTasks * numDays;
  const prevCompleted = (prevLogs as Record<string, unknown>[]).filter((l) => l.status === 'completed').length;
  const prevNumDays = Math.ceil((prev.end.getTime() - prev.start.getTime()) / 86400000);
  const prevTotal = activeTasks * prevNumDays;

  const completionRate = currentTotal > 0 ? Number(((currentCompleted / currentTotal) * 100).toFixed(1)) : 0;
  const prevCompletionRate = prevTotal > 0 ? Number(((prevCompleted / prevTotal) * 100).toFixed(1)) : 0;

  const totalPoints = (currentLogs as Record<string, unknown>[]).reduce(
    (s, l) => s + ((l.pointsEarned as number) || 0),
    0
  );

  // --- Weight ---
  const [latestWeight, periodStartWeight] = await Promise.all([
    WeightLog.findOne({ date: { $lt: end } }).sort({ date: -1 }).lean(),
    WeightLog.findOne({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean(),
  ]);

  // --- Mood ---
  const moodLogs = await MoodLog.find({ date: { $gte: start, $lt: end } }).lean();
  const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
  const avgMood = moodLogs.length > 0
    ? Number(
        (
          (moodLogs as Record<string, unknown>[]).reduce(
            (s, l) => s + (moodValues[(l.mood as string)] || 3),
            0
          ) / moodLogs.length
        ).toFixed(2)
      )
    : null;

  // --- Exercise ---
  const exerciseLogs = await ExerciseLog.find({ date: { $gte: start, $lt: end } }).lean();
  const exerciseDays = new Set(
    (exerciseLogs as Record<string, unknown>[]).map((l) =>
      dayjs(l.date as Date).format('YYYY-MM-DD')
    )
  ).size;

  // --- Books ---
  const booksFinished = await Book.countDocuments({
    finishedOn: { $gte: start, $lt: end },
  });
  const booksStarted = await Book.countDocuments({
    startedOn: { $gte: start, $lt: end },
  });

  // --- Learning ---
  const learningLogs = await SimpleLearningLog.find({ date: { $gte: start, $lt: end } }).lean();
  const learningMinutes = (learningLogs as Record<string, unknown>[]).reduce(
    (s, l) => s + ((l.duration as number) || 0),
    0
  );

  return textResult({
    period,
    numDays,
    routine: {
      completionRate,
      change: Number((completionRate - prevCompletionRate).toFixed(1)),
      completed: currentCompleted,
      total: currentTotal,
      activeTasks,
      totalPoints,
    },
    weight: {
      current: latestWeight ? Number(((latestWeight as Record<string, unknown>).weight as number).toFixed(2)) : null,
      periodStart: periodStartWeight ? Number(((periodStartWeight as Record<string, unknown>).weight as number).toFixed(2)) : null,
      change: latestWeight && periodStartWeight
        ? Number((((latestWeight as Record<string, unknown>).weight as number) - ((periodStartWeight as Record<string, unknown>).weight as number)).toFixed(2))
        : null,
    },
    mood: {
      averageScore: avgMood,
      totalEntries: moodLogs.length,
    },
    exercise: {
      activeDays: exerciseDays,
      totalSessions: exerciseLogs.length,
      frequencyPerWeek: numDays > 0 ? Number(((exerciseDays / numDays) * 7).toFixed(1)) : 0,
    },
    books: {
      finished: booksFinished,
      started: booksStarted,
    },
    learning: {
      totalMinutes: learningMinutes,
      totalHours: Number((learningMinutes / 60).toFixed(1)),
      activeDays: new Set(
        (learningLogs as Record<string, unknown>[]).map((l) =>
          dayjs(l.date as Date).format('YYYY-MM-DD')
        )
      ).size,
    },
  });
}

// ============ GET ROUTINE REPORT ============
export async function getRoutineReport(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const period = (args.period as string) || 'thisWeek';
  const { start, end } = getDateRange(period);

  const numDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  const tasks = await Task.find({ isActive: true }).lean();
  const logs = await DailyLog.find({ date: { $gte: start, $lt: end } }).lean();

  const taskMap = new Map(
    (tasks as Record<string, unknown>[]).map((t) => [
      (t._id as { toString(): string }).toString(),
      t,
    ])
  );

  // Per-task stats
  const taskStats: Record<
    string,
    { title: string; domainId: string; completed: number; skipped: number; total: number; points: number }
  > = {};

  // Pre-populate all active tasks so unlogged tasks show 0/numDays (not missing)
  for (const task of tasks as Record<string, unknown>[]) {
    const taskId = (task._id as { toString(): string }).toString();
    taskStats[taskId] = {
      title: task.title as string,
      domainId: task.domainId as string,
      completed: 0,
      skipped: 0,
      total: numDays, // expected appearances
      points: 0,
    };
  }

  for (const log of logs as Record<string, unknown>[]) {
    const taskId = (log.taskId as { toString(): string }).toString();
    if (!taskStats[taskId]) continue; // inactive task, skip
    if (log.status === 'completed') {
      taskStats[taskId].completed++;
      taskStats[taskId].points += (log.pointsEarned as number) || 0;
    }
    if (log.status === 'skipped') taskStats[taskId].skipped++;
  }

  const sortedTasks = Object.entries(taskStats)
    .map(([id, s]) => ({
      id,
      ...s,
      completionRate: s.total > 0 ? Number(((s.completed / s.total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.completionRate - a.completionRate);

  // Domain breakdown
  const domainStats: Record<string, { completed: number; total: number; points: number }> = {};
  for (const t of sortedTasks) {
    if (!domainStats[t.domainId]) domainStats[t.domainId] = { completed: 0, total: 0, points: 0 };
    domainStats[t.domainId].completed += t.completed;
    domainStats[t.domainId].total += t.total;
    domainStats[t.domainId].points += t.points;
  }

  return textResult({
    period,
    tasks: sortedTasks,
    bestTasks: sortedTasks.slice(0, 5),
    worstTasks: sortedTasks.slice(-5).reverse(),
    domains: Object.entries(domainStats).map(([domain, s]) => ({
      domain,
      completionRate: s.total > 0 ? Number(((s.completed / s.total) * 100).toFixed(1)) : 0,
      completed: s.completed,
      total: s.total,
      points: s.points,
    })),
  });
}

// ============ GET HEALTH REPORT ============
export async function getHealthReport(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const period = (args.period as string) || 'thisWeek';
  const { start, end } = getDateRange(period);

  // Weight trend
  const weights = await WeightLog.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();

  // Exercise stats
  const pages = await HealthPage.find().lean();
  const allExercises = await ExerciseDefinition.find().lean();
  const exerciseLogs = await ExerciseLog.find({ date: { $gte: start, $lt: end } }).lean();

  const exerciseMap = new Map(
    (allExercises as Record<string, unknown>[]).map((e) => [
      (e._id as { toString(): string }).toString(),
      e,
    ])
  );

  // Muscle frequency
  const muscleCount: Record<string, number> = {};
  for (const log of exerciseLogs as Record<string, unknown>[]) {
    const ex = exerciseMap.get((log.exerciseId as { toString(): string }).toString());
    if (ex) {
      const muscles = (ex as Record<string, unknown>).targetMuscles as string[] || [];
      muscles.forEach((m) => {
        muscleCount[m] = (muscleCount[m] || 0) + 1;
      });
    }
  }

  // Mood trend
  const moods = await MoodLog.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
  const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };

  // Exercise day names
  const exerciseDayNames = new Set<string>();
  const pageIdToName = new Map(
    (pages as Record<string, unknown>[]).map((p) => [
      (p._id as { toString(): string }).toString(),
      (p as Record<string, unknown>).title as string,
    ])
  );
  const exerciseToPage = new Map(
    (allExercises as Record<string, unknown>[]).map((e) => [
      (e._id as { toString(): string }).toString(),
      (e.pageId as { toString(): string }).toString(),
    ])
  );
  for (const log of exerciseLogs as Record<string, unknown>[]) {
    const pageId = exerciseToPage.get((log.exerciseId as { toString(): string }).toString());
    if (pageId) {
      const name = pageIdToName.get(pageId);
      if (name) exerciseDayNames.add(name);
    }
  }

  return textResult({
    period,
    weight: {
      entries: (weights as Record<string, unknown>[]).map((w) => ({
        date: dayjs(w.date as Date).format('YYYY-MM-DD'),
        weight: Number((w.weight as number).toFixed(2)),
      })),
      startWeight: weights.length > 0 ? Number(((weights[0] as Record<string, unknown>).weight as number).toFixed(2)) : null,
      endWeight: weights.length > 0 ? Number(((weights[weights.length - 1] as Record<string, unknown>).weight as number).toFixed(2)) : null,
      change: weights.length >= 2
        ? Number((((weights[weights.length - 1] as Record<string, unknown>).weight as number) - ((weights[0] as Record<string, unknown>).weight as number)).toFixed(2))
        : null,
    },
    exercise: {
      totalSessions: exerciseLogs.length,
      uniqueDays: new Set(
        (exerciseLogs as Record<string, unknown>[]).map((l) =>
          dayjs(l.date as Date).format('YYYY-MM-DD')
        )
      ).size,
      muscleFrequency: Object.entries(muscleCount)
        .map(([muscle, count]) => ({ muscle, count }))
        .sort((a, b) => b.count - a.count),
      exerciseDayNamesHit: [...exerciseDayNames],
    },
    mood: {
      entries: (moods as Record<string, unknown>[]).map((m) => ({
        date: dayjs(m.date as Date).format('YYYY-MM-DD'),
        mood: m.mood,
        score: moodValues[(m.mood as string)] || 3,
      })),
      average: moods.length > 0
        ? Number(
            (
              (moods as Record<string, unknown>[]).reduce(
                (s, m) => s + (moodValues[(m.mood as string)] || 3),
                0
              ) / moods.length
            ).toFixed(2)
          )
        : null,
    },
  });
}

// ============ GET STREAK DATA ============
export async function getStreakData(): Promise<ToolResult> {
  await connectDB();

  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day');

  // Get all streak records
  const records = await DailyStreakRecord.find().sort({ date: -1 }).lean();

  if (records.length === 0) {
    return textResult({
      currentStreak: 0,
      longestStreak: 0,
      todayValid: false,
      totalStreakDays: 0,
      totalBonusPoints: 0,
    });
  }

  // Calculate current streak (consecutive days ending today or yesterday)
  let currentStreak = 0;
  let checkDate = today;

  for (let i = 0; i < 400; i++) {
    const dateStr = checkDate.format('YYYY-MM-DD');
    const record = (records as Record<string, unknown>[]).find((r) => {
      const recDate = dayjs(r.date as Date).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD');
      return recDate === dateStr;
    });

    if (record && (record as Record<string, unknown>).isValidDay) {
      currentStreak++;
      checkDate = checkDate.subtract(1, 'day');
    } else if (i === 0) {
      // Today might not be validated yet, check yesterday
      checkDate = checkDate.subtract(1, 'day');
      continue;
    } else {
      break;
    }
  }

  // Longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  const sortedAsc = [...records].reverse();
  let prevDate: ReturnType<typeof dayjs> | null = null;

  for (const r of sortedAsc as Record<string, unknown>[]) {
    if (!(r as Record<string, unknown>).isValidDay) {
      tempStreak = 0;
      prevDate = null;
      continue;
    }
    const d = dayjs(r.date as Date).tz(DEFAULT_TIMEZONE).startOf('day');
    if (prevDate && d.diff(prevDate, 'day') === 1) {
      tempStreak++;
    } else {
      tempStreak = 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    prevDate = d;
  }

  // Today valid?
  const todayStr = today.format('YYYY-MM-DD');
  const todayRecord = (records as Record<string, unknown>[]).find((r) => {
    return dayjs(r.date as Date).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD') === todayStr;
  });

  const totalBonusPoints = (records as Record<string, unknown>[]).reduce(
    (s, r) => s + ((r.bonusPointsAwarded as number) || 0),
    0
  );

  const milestones = [1, 3, 5, 7, 10, 15, 20, 30, 50, 75, 100, 150, 200, 250, 300, 365];
  const nextTarget = milestones.find((m) => m > currentStreak) || currentStreak + 50;

  return textResult({
    currentStreak,
    longestStreak,
    todayValid: todayRecord ? !!(todayRecord as Record<string, unknown>).isValidDay : false,
    totalStreakDays: (records as Record<string, unknown>[]).filter((r) => r.isValidDay).length,
    totalBonusPoints,
    nextMilestone: nextTarget,
    daysToNextMilestone: nextTarget - currentStreak,
  });
}

// ============ GET IDENTITY METRIC (BETTER %) ============
export async function getIdentityMetric(): Promise<ToolResult> {
  await connectDB();

  // Total routine points
  const routinePointsAgg = await DailyLog.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pointsEarned' } } },
  ]);

  // Streak bonus
  const streakBonusAgg = await DailyStreakRecord.aggregate([
    { $group: { _id: null, total: { $sum: '$bonusPointsAwarded' } } },
  ]);

  // Book points (unique books read)
  const BOOK_TASK_POINTS = 20;
  const EXERCISE_TASK_POINTS = 25;

  // Count exercise days with aggregation
  const exerciseDayCountAgg = await ExerciseLog.aggregate([
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: DEFAULT_TIMEZONE } } } },
    { $count: 'total' },
  ]);

  const basePoints = routinePointsAgg[0]?.total || 0;
  const streakBonus = streakBonusAgg[0]?.total || 0;
  const exercisePoints = (exerciseDayCountAgg[0]?.total || 0) * EXERCISE_TASK_POINTS;
  const totalPoints = basePoints + streakBonus + exercisePoints;
  const betterPercentage = getBetterPercentage(totalPoints);

  // Domain breakdown
  const domainBreakdown = await DailyLog.aggregate([
    { $match: { status: 'completed' } },
    {
      $lookup: {
        from: 'routinetasks',
        localField: 'taskId',
        foreignField: '_id',
        as: 'task',
      },
    },
    { $unwind: '$task' },
    {
      $group: {
        _id: '$task.domainId',
        points: { $sum: '$pointsEarned' },
        count: { $sum: 1 },
      },
    },
    { $sort: { points: -1 } },
  ]);

  return textResult({
    betterPercentage,
    totalPoints,
    breakdown: {
      routinePoints: basePoints,
      streakBonus,
      exercisePoints,
    },
    domains: domainBreakdown.map((d: Record<string, unknown>) => ({
      domain: d._id,
      points: d.points,
      completions: d.count,
    })),
  });
}

// ============ GET LAST 7 DAYS COMPLETION ============
export async function getLast7DaysCompletion(): Promise<ToolResult> {
  await connectDB();

  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day');
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = today.subtract(i, 'day');
    const start = d.toDate();
    const end = d.add(1, 'day').toDate();

    const [completed, total] = await Promise.all([
      DailyLog.countDocuments({ date: { $gte: start, $lt: end }, status: 'completed' }),
      DailyLog.countDocuments({ date: { $gte: start, $lt: end } }),
    ]);

    days.push({
      date: d.format('YYYY-MM-DD'),
      day: d.format('ddd'),
      completed,
      total,
      rate: total > 0 ? Number(((completed / total) * 100).toFixed(1)) : 0,
    });
  }

  return textResult({ days });
}
