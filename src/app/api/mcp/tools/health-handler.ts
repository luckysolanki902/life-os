/**
 * Health Tools Handler
 * MCP tools for health dashboard, weight, mood, exercise
 */

import connectDB from '@/lib/db';
import WeightLog from '@/models/WeightLog';
import HealthPage from '@/models/HealthPage';
import ExerciseDefinition from '@/models/ExerciseDefinition';
import ExerciseLog from '@/models/ExerciseLog';
import MoodLog from '@/models/MoodLog';
import {
  parseToISTMidnight,
  getTodayDateString,
  getDateRange,
  dayjs,
} from '@/lib/server-date-utils';

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

// ============ GET HEALTH DASHBOARD ============
export async function getHealthDashboard(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const dateStr = (args.date as string) || getTodayDateString();
  const { startOfDay, endOfDay } = getDateRange(dateStr);

  // Weight
  const latestWeight = await WeightLog.findOne({ date: { $lt: endOfDay } }).sort({ date: -1 }).lean();
  const todaysWeight = await WeightLog.findOne({ date: { $gte: startOfDay, $lt: endOfDay } }).lean();

  // Mood
  const todaysMood = await MoodLog.findOne({ date: { $gte: startOfDay, $lt: endOfDay } }).lean();

  // Exercise pages & today's workout
  const pages = await HealthPage.find().sort({ createdAt: 1 }).lean();
  const pageIds = pages.map((p: Record<string, unknown>) => (p._id as { toString(): string }).toString());

  const allExercises = pageIds.length > 0
    ? await ExerciseDefinition.find({ pageId: { $in: pageIds } }).lean()
    : [];
  const exerciseIds = allExercises.map((e: Record<string, unknown>) => e._id);

  // Today's exercise logs
  const todaysLogs = exerciseIds.length > 0
    ? await ExerciseLog.find({
        exerciseId: { $in: exerciseIds },
        date: { $gte: startOfDay, $lt: endOfDay },
      }).lean()
    : [];

  // Determine today's workout page (cycle)
  let todayWorkoutPageIndex = 0;
  if (pageIds.length > 0) {
    const exerciseToPage: Record<string, string> = {};
    (allExercises as Record<string, unknown>[]).forEach((ex) => {
      exerciseToPage[(ex._id as { toString(): string }).toString()] = (ex.pageId as { toString(): string }).toString();
    });

    const latestLog = await ExerciseLog.findOne({
      exerciseId: { $in: exerciseIds },
    }).sort({ date: -1 }).lean();

    if (latestLog) {
      const loggedPageId = exerciseToPage[((latestLog as Record<string, unknown>).exerciseId as { toString(): string })?.toString()];
      if (loggedPageId) {
        const lastIdx = pageIds.indexOf(loggedPageId);
        // If last log is NOT today, advance to next page
        const lastLogDate = dayjs((latestLog as Record<string, unknown>).date as Date).format('YYYY-MM-DD');
        todayWorkoutPageIndex = lastLogDate === dateStr ? lastIdx : (lastIdx + 1) % pageIds.length;
      }
    }
  }

  const todayPageId = pageIds[todayWorkoutPageIndex];
  const todayPageExercises = (allExercises as Record<string, unknown>[])
    .filter((e) => (e.pageId as { toString(): string }).toString() === todayPageId)
    .sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0));

  const exercisesWithLogs = todayPageExercises.map((ex) => {
    const log = (todaysLogs as Record<string, unknown>[]).find(
      (l) => (l.exerciseId as { toString(): string }).toString() === (ex._id as { toString(): string }).toString()
    );
    return {
      id: (ex._id as { toString(): string }).toString(),
      title: ex.title,
      type: ex.type || 'reps',
      targetMuscles: ex.targetMuscles || [],
      sets: log ? (log.sets as unknown[]) : [],
      hasLog: !!log,
    };
  });

  return textResult({
    date: dateStr,
    weight: {
      current: latestWeight ? Number(((latestWeight as Record<string, unknown>).weight as number).toFixed(2)) : null,
      todaysEntry: todaysWeight
        ? {
            id: ((todaysWeight as Record<string, unknown>)._id as { toString(): string }).toString(),
            weight: Number(((todaysWeight as Record<string, unknown>).weight as number).toFixed(2)),
          }
        : null,
    },
    mood: todaysMood
      ? {
          mood: (todaysMood as Record<string, unknown>).mood,
          note: (todaysMood as Record<string, unknown>).note || null,
        }
      : null,
    workout: {
      todayPageName: pages[todayWorkoutPageIndex]
        ? (pages[todayWorkoutPageIndex] as Record<string, unknown>).title
        : null,
      todayPageIndex: todayWorkoutPageIndex,
      totalPages: pages.length,
      exercises: exercisesWithLogs,
      exercisesCompleted: exercisesWithLogs.filter((e) => e.hasLog).length,
    },
    pages: pages.map((p: Record<string, unknown>) => ({
      id: (p._id as { toString(): string }).toString(),
      title: p.title,
      description: p.description || null,
    })),
  });
}

// ============ LOG WEIGHT ============
export async function logWeight(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { weight, date } = args;
  if (weight === undefined || weight === null) {
    return textResult({ error: 'weight (in kg) is required' }, true);
  }

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);
  const { startOfDay, endOfDay } = getDateRange(dateStr);

  // Upsert weight for the date
  const existing = await WeightLog.findOne({ date: { $gte: startOfDay, $lt: endOfDay } });
  if (existing) {
    existing.weight = weight as number;
    await existing.save();
    return textResult({ success: true, message: `Weight updated to ${weight} kg for ${dateStr}`, id: existing._id.toString() });
  }

  const log = await WeightLog.create({ date: targetDate, weight });
  return textResult({ success: true, message: `Weight logged: ${weight} kg for ${dateStr}`, id: log._id.toString() });
}

// ============ GET WEIGHT ============
export async function getWeight(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { date, startDate, endDate, limit } = args;

  // Single date
  if (date) {
    const { startOfDay, endOfDay } = getDateRange(date as string);
    const log = await WeightLog.findOne({ date: { $gte: startOfDay, $lt: endOfDay } }).lean();
    return textResult({
      date,
      weight: log ? Number(((log as Record<string, unknown>).weight as number).toFixed(2)) : null,
    });
  }

  // Date range
  if (startDate && endDate) {
    const start = parseToISTMidnight(startDate as string);
    const end = dayjs(parseToISTMidnight(endDate as string)).add(1, 'day').toDate();
    const logs = await WeightLog.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
    return textResult({
      range: { startDate, endDate },
      entries: (logs as Record<string, unknown>[]).map((l) => ({
        date: dayjs(l.date as Date).format('YYYY-MM-DD'),
        weight: Number((l.weight as number).toFixed(2)),
      })),
      count: logs.length,
    });
  }

  // Recent entries
  const logs = await WeightLog.find().sort({ date: -1 }).limit((limit as number) || 30).lean();
  return textResult({
    entries: (logs as Record<string, unknown>[]).map((l) => ({
      date: dayjs(l.date as Date).format('YYYY-MM-DD'),
      weight: Number((l.weight as number).toFixed(2)),
    })),
    count: logs.length,
  });
}

// ============ SAVE MOOD ============
export async function saveMood(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { mood, note, date } = args;
  if (!mood) return textResult({ error: 'mood is required (great|good|okay|low|bad)' }, true);

  const validMoods = ['great', 'good', 'okay', 'low', 'bad'];
  if (!validMoods.includes(mood as string)) {
    return textResult({ error: `mood must be one of: ${validMoods.join(', ')}` }, true);
  }

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  const result = await MoodLog.findOneAndUpdate(
    { date: targetDate },
    { date: targetDate, mood, note: note || undefined },
    { upsert: true, new: true }
  ).lean();

  return textResult({
    success: true,
    message: `Mood saved: ${mood} for ${dateStr}`,
    id: ((result as Record<string, unknown>)._id as { toString(): string }).toString(),
  });
}

// ============ GET MOOD ============
export async function getMood(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { date, startDate, endDate } = args;

  if (date) {
    const { startOfDay, endOfDay } = getDateRange(date as string);
    const log = await MoodLog.findOne({ date: { $gte: startOfDay, $lt: endOfDay } }).lean();
    return textResult({
      date,
      mood: log ? (log as Record<string, unknown>).mood : null,
      note: log ? (log as Record<string, unknown>).note || null : null,
    });
  }

  if (startDate && endDate) {
    const start = parseToISTMidnight(startDate as string);
    const end = dayjs(parseToISTMidnight(endDate as string)).add(1, 'day').toDate();
    const logs = await MoodLog.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
    return textResult({
      range: { startDate, endDate },
      entries: (logs as Record<string, unknown>[]).map((l) => ({
        date: dayjs(l.date as Date).format('YYYY-MM-DD'),
        mood: (l as Record<string, unknown>).mood,
        note: (l as Record<string, unknown>).note || null,
      })),
      count: logs.length,
    });
  }

  // Last 30 days
  const logs = await MoodLog.find().sort({ date: -1 }).limit(30).lean();
  return textResult({
    entries: (logs as Record<string, unknown>[]).map((l) => ({
      date: dayjs(l.date as Date).format('YYYY-MM-DD'),
      mood: (l as Record<string, unknown>).mood,
      note: (l as Record<string, unknown>).note || null,
    })),
  });
}

// ============ GET EXERCISE PAGES ============
export async function getExercisePages(): Promise<ToolResult> {
  await connectDB();

  const pages = await HealthPage.find().sort({ createdAt: 1 }).lean();
  const result = [];

  for (const page of pages as Record<string, unknown>[]) {
    const exercises = await ExerciseDefinition.find({ pageId: page._id }).sort({ order: 1 }).lean();
    result.push({
      id: (page._id as { toString(): string }).toString(),
      title: page.title,
      description: page.description || null,
      exercises: (exercises as Record<string, unknown>[]).map((e) => ({
        id: (e._id as { toString(): string }).toString(),
        title: e.title,
        type: e.type || 'reps',
        targetMuscles: e.targetMuscles || [],
        order: e.order,
        initialSets: e.initialSets,
        initialReps: e.initialReps,
        recommendedWeight: e.recommendedWeight,
      })),
    });
  }

  return textResult({ pages: result });
}

// ============ GET EXERCISE PAGE DETAIL ============
export async function getExercisePage(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { pageId, date } = args;
  if (!pageId) return textResult({ error: 'pageId is required' }, true);

  const page = await HealthPage.findById(pageId).lean();
  if (!page) return textResult({ error: 'Page not found' }, true);

  const exercises = await ExerciseDefinition.find({ pageId }).sort({ order: 1 }).lean();

  // Get logs for the date
  const dateStr = (date as string) || getTodayDateString();
  const { startOfDay, endOfDay } = getDateRange(dateStr);

  const exerciseIds = exercises.map((e: Record<string, unknown>) => e._id);
  const logs = await ExerciseLog.find({
    exerciseId: { $in: exerciseIds },
    date: { $gte: startOfDay, $lt: endOfDay },
  }).lean();

  const exercisesWithLogs = (exercises as Record<string, unknown>[]).map((ex) => {
    const log = (logs as Record<string, unknown>[]).find(
      (l) => (l.exerciseId as { toString(): string }).toString() === (ex._id as { toString(): string }).toString()
    );
    return {
      id: (ex._id as { toString(): string }).toString(),
      title: ex.title,
      type: ex.type || 'reps',
      targetMuscles: ex.targetMuscles || [],
      order: ex.order,
      initialSets: ex.initialSets,
      initialReps: ex.initialReps,
      recommendedWeight: ex.recommendedWeight,
      log: log
        ? {
            id: ((log as Record<string, unknown>)._id as { toString(): string }).toString(),
            sets: (log as Record<string, unknown>).sets,
          }
        : null,
    };
  });

  return textResult({
    page: {
      id: ((page as Record<string, unknown>)._id as { toString(): string }).toString(),
      title: (page as Record<string, unknown>).title,
      description: (page as Record<string, unknown>).description || null,
    },
    date: dateStr,
    exercises: exercisesWithLogs,
  });
}

// ============ LOG EXERCISE SET ============
export async function logExerciseSet(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { exerciseId, sets, date } = args;
  if (!exerciseId) return textResult({ error: 'exerciseId is required' }, true);
  if (!sets || !Array.isArray(sets)) return textResult({ error: 'sets array is required: [{reps, weight?, duration?}]' }, true);

  const exercise = await ExerciseDefinition.findById(exerciseId).lean();
  if (!exercise) return textResult({ error: 'Exercise not found' }, true);

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  const log = await ExerciseLog.findOneAndUpdate(
    { exerciseId, date: targetDate },
    { exerciseId, date: targetDate, sets },
    { upsert: true, new: true }
  ).lean();

  return textResult({
    success: true,
    message: `Logged ${(sets as unknown[]).length} sets for "${(exercise as Record<string, unknown>).title}" on ${dateStr}`,
    logId: ((log as Record<string, unknown>)._id as { toString(): string }).toString(),
  });
}

// ============ UPDATE EXERCISE SET ============
export async function updateExerciseSet(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { logId, setIndex, reps, weight, duration } = args;
  if (!logId) return textResult({ error: 'logId is required' }, true);
  if (setIndex === undefined) return textResult({ error: 'setIndex is required' }, true);

  const log = await ExerciseLog.findById(logId);
  if (!log) return textResult({ error: 'Exercise log not found' }, true);

  const idx = setIndex as number;
  if (idx < 0 || idx >= log.sets.length) {
    return textResult({ error: `setIndex out of bounds (0-${log.sets.length - 1})` }, true);
  }

  if (reps !== undefined) log.sets[idx].reps = reps as number;
  if (weight !== undefined) log.sets[idx].weight = weight as number;
  if (duration !== undefined) log.sets[idx].duration = duration as number;

  await log.save();

  return textResult({ success: true, message: `Set ${idx + 1} updated`, sets: log.sets });
}

// ============ DELETE EXERCISE SET ============
export async function deleteExerciseSet(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { logId, setIndex } = args;
  if (!logId) return textResult({ error: 'logId is required' }, true);
  if (setIndex === undefined) return textResult({ error: 'setIndex is required' }, true);

  const log = await ExerciseLog.findById(logId);
  if (!log) return textResult({ error: 'Exercise log not found' }, true);

  const idx = setIndex as number;
  if (idx < 0 || idx >= log.sets.length) {
    return textResult({ error: `setIndex out of bounds (0-${log.sets.length - 1})` }, true);
  }

  log.sets.splice(idx, 1);
  await log.save();

  return textResult({ success: true, message: `Set ${idx + 1} deleted`, remainingSets: log.sets.length });
}

// ============ GET WORKOUT SUMMARY ============
export async function getWorkoutSummary(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const dateStr = (args.date as string) || getTodayDateString();
  const { startOfDay, endOfDay } = getDateRange(dateStr);

  const pages = await HealthPage.find().sort({ createdAt: 1 }).lean();
  const pageIds = pages.map((p: Record<string, unknown>) => (p._id as { toString(): string }).toString());

  const allExercises = pageIds.length > 0
    ? await ExerciseDefinition.find({ pageId: { $in: pageIds } }).lean()
    : [];
  const exerciseIds = allExercises.map((e: Record<string, unknown>) => e._id);

  const todaysLogs = exerciseIds.length > 0
    ? await ExerciseLog.find({
        exerciseId: { $in: exerciseIds },
        date: { $gte: startOfDay, $lt: endOfDay },
      }).lean()
    : [];

  const exerciseMap = new Map(
    (allExercises as Record<string, unknown>[]).map((e) => [
      (e._id as { toString(): string }).toString(),
      e,
    ])
  );

  const summary = (todaysLogs as Record<string, unknown>[]).map((log) => {
    const ex = exerciseMap.get((log.exerciseId as { toString(): string }).toString());
    return {
      exercise: ex ? (ex as Record<string, unknown>).title : 'Unknown',
      targetMuscles: ex ? (ex as Record<string, unknown>).targetMuscles || [] : [],
      sets: (log.sets as Array<Record<string, unknown>>).length,
      totalReps: (log.sets as Array<Record<string, unknown>>).reduce((s, set) => s + ((set.reps as number) || 0), 0),
      maxWeight: Math.max(...(log.sets as Array<Record<string, unknown>>).map((set) => (set.weight as number) || 0)),
    };
  });

  const allMuscles = new Set<string>();
  summary.forEach((s) => (s.targetMuscles as string[]).forEach((m) => allMuscles.add(m)));

  return textResult({
    date: dateStr,
    exercisesLogged: summary.length,
    totalSets: summary.reduce((s, e) => s + e.sets, 0),
    musclesWorked: [...allMuscles],
    exercises: summary,
  });
}

// ============ CREATE EXERCISE ============
export async function createExercise(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { pageId, title, type, targetMuscles, initialSets, initialReps, recommendedWeight } = args;
  if (!pageId || !title) return textResult({ error: 'pageId and title are required' }, true);

  const page = await HealthPage.findById(pageId).lean();
  if (!page) return textResult({ error: 'Page not found' }, true);

  const maxOrder = await ExerciseDefinition.findOne({ pageId }).sort({ order: -1 }).lean();
  const order = ((maxOrder as Record<string, unknown> | null)?.order as number || 0) + 1;

  const exercise = await ExerciseDefinition.create({
    pageId,
    title,
    type: (type as string) || 'reps',
    targetMuscles: (targetMuscles as string[]) || [],
    order,
    initialSets: initialSets || null,
    initialReps: initialReps || null,
    recommendedWeight: recommendedWeight !== undefined ? recommendedWeight : null,
  });

  return textResult({
    success: true,
    message: `Exercise "${title}" created in page "${(page as Record<string, unknown>).title}"`,
    exercise: {
      id: exercise._id.toString(),
      title: exercise.title,
      type: exercise.type,
      targetMuscles: exercise.targetMuscles,
    },
  });
}

// ============ UPDATE EXERCISE ============
export async function updateExercise(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, ...updateData } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updateData)) {
    if (v !== undefined) clean[k] = v;
  }

  const exercise = await ExerciseDefinition.findByIdAndUpdate(id, clean, { new: true }).lean();
  if (!exercise) return textResult({ error: 'Exercise not found' }, true);

  return textResult({
    success: true,
    message: `Exercise "${(exercise as Record<string, unknown>).title}" updated`,
  });
}

// ============ DELETE EXERCISE ============
export async function deleteExercise(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const exercise = await ExerciseDefinition.findById(id).lean();
  if (!exercise) return textResult({ error: 'Exercise not found' }, true);

  await ExerciseDefinition.findByIdAndDelete(id);

  return textResult({
    success: true,
    message: `Exercise "${(exercise as Record<string, unknown>).title}" deleted`,
  });
}

// ============ CREATE HEALTH PAGE ============
export async function createHealthPage(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { title, description } = args;
  if (!title) return textResult({ error: 'title is required' }, true);

  const page = await HealthPage.create({ title, description: description || undefined });

  return textResult({
    success: true,
    message: `Health page "${title}" created`,
    page: { id: page._id.toString(), title: page.title },
  });
}

// ============ DELETE HEALTH PAGE ============
export async function deleteHealthPage(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const page = await HealthPage.findById(id).lean();
  if (!page) return textResult({ error: 'Page not found' }, true);

  // Delete associated exercises
  await ExerciseDefinition.deleteMany({ pageId: id });
  await HealthPage.findByIdAndDelete(id);

  return textResult({
    success: true,
    message: `Health page "${(page as Record<string, unknown>).title}" and all its exercises deleted`,
  });
}
