/**
 * Routine Tools Handler
 * MCP tools for routine/task management
 */

import connectDB from '@/lib/db';
import Task from '@/models/Task';
import DailyLog from '@/models/DailyLog';
import {
  parseToISTMidnight,
  getTodayDateString,
  getDateRange,
  getDayOfWeek,
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

function shouldShowTaskOnDay(task: { recurrenceType?: string; recurrenceDays?: number[] }, dayOfWeek: number): boolean {
  const recurrenceType = task.recurrenceType || 'daily';
  switch (recurrenceType) {
    case 'daily': return true;
    case 'weekdays': return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends': return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom': return (task.recurrenceDays || []).includes(dayOfWeek);
    default: return true;
  }
}

// ============ GET ROUTINE ============
export async function getRoutine(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const dateStr = (args.date as string) || getTodayDateString();
  const { startOfDay, endOfDay } = getDateRange(dateStr);
  const dayOfWeek = getDayOfWeek(dateStr);

  const tasks = await Task.find({ isActive: true }).sort({ order: 1 }).lean();
  const todaysTasks = tasks.filter((t: Record<string, unknown>) =>
    shouldShowTaskOnDay(t as { recurrenceType?: string; recurrenceDays?: number[] }, dayOfWeek)
  );

  const logs = await DailyLog.find({
    date: { $gte: startOfDay, $lt: endOfDay },
    taskId: { $in: todaysTasks.map((t: Record<string, unknown>) => t._id) },
  }).lean();

  // Optional filters
  const statusFilter = args.status as string | undefined;
  const domainFilter = args.domain as string | undefined;
  const timeOfDayFilter = args.timeOfDay as string | undefined;

  const routine = todaysTasks.map((task: Record<string, unknown>) => {
    const log = (logs as Record<string, unknown>[]).find(
      (l) => (l.taskId as { toString(): string }).toString() === (task._id as { toString(): string }).toString()
    );
    const status = log ? (log.status as string) : 'pending';
    return {
      id: (task._id as { toString(): string }).toString(),
      title: task.title,
      domainId: task.domainId,
      timeOfDay: task.timeOfDay || 'none',
      basePoints: task.basePoints || 1,
      mustDo: task.mustDo || false,
      recurrenceType: task.recurrenceType || 'daily',
      order: task.order,
      status,
      pointsEarned: (log?.pointsEarned as number) || 0,
      completedAt: log?.completedAt || null,
      skippedAt: log?.skippedAt || null,
      isScheduled: task.isScheduled || false,
      startTime: task.startTime || null,
      endTime: task.endTime || null,
    };
  }).filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (domainFilter && t.domainId !== domainFilter) return false;
    if (timeOfDayFilter && t.timeOfDay !== timeOfDayFilter) return false;
    return true;
  });

  const completed = routine.filter((t) => t.status === 'completed').length;
  const skipped = routine.filter((t) => t.status === 'skipped').length;
  const pending = routine.filter((t) => t.status === 'pending').length;
  const totalPoints = routine.reduce((s, t) => s + t.pointsEarned, 0);

  return textResult({
    date: dateStr,
    summary: { total: routine.length, completed, skipped, pending, totalPoints },
    tasks: routine,
  });
}

// ============ GET ALL TASKS ============
export async function getAllTasks(): Promise<ToolResult> {
  await connectDB();

  const tasks = await Task.find({ isActive: true }).sort({ order: 1 }).lean();

  return textResult({
    total: tasks.length,
    tasks: tasks.map((t: Record<string, unknown>) => ({
      id: (t._id as { toString(): string }).toString(),
      title: t.title,
      domainId: t.domainId,
      timeOfDay: t.timeOfDay || 'none',
      basePoints: t.basePoints || 1,
      mustDo: t.mustDo || false,
      recurrenceType: t.recurrenceType || 'daily',
      recurrenceDays: t.recurrenceDays || [],
      order: t.order,
      isScheduled: t.isScheduled || false,
      startTime: t.startTime || null,
      endTime: t.endTime || null,
    })),
  });
}

// ============ CREATE TASK ============
export async function createTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { title, domainId, basePoints, timeOfDay, mustDo, recurrenceType, recurrenceDays } = args;

  if (!title || !domainId) {
    return textResult({ error: 'title and domainId are required' }, true);
  }

  const validDomains = ['health', 'career', 'learning', 'social', 'discipline', 'personality', 'startups'];
  if (!validDomains.includes(domainId as string)) {
    return textResult({ error: `domainId must be one of: ${validDomains.join(', ')}` }, true);
  }

  const task = await Task.create({
    title,
    domainId,
    basePoints: (basePoints as number) || 1,
    timeOfDay: (timeOfDay as string) || 'none',
    mustDo: mustDo || false,
    recurrenceType: (recurrenceType as string) || 'daily',
    recurrenceDays: (recurrenceDays as number[]) || [],
    order: 999,
  });

  return textResult({
    success: true,
    message: `Task "${title}" created`,
    task: {
      id: task._id.toString(),
      title: task.title,
      domainId: task.domainId,
      basePoints: task.basePoints,
      timeOfDay: task.timeOfDay,
    },
  });
}

// ============ UPDATE TASK ============
export async function updateTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, ...updateData } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updateData)) {
    if (v !== undefined) clean[k] = v;
  }

  const task = await Task.findByIdAndUpdate(id, clean, { new: true }).lean();
  if (!task) return textResult({ error: 'Task not found' }, true);

  return textResult({
    success: true,
    message: `Task "${(task as Record<string, unknown>).title}" updated`,
    task: {
      id: ((task as Record<string, unknown>)._id as { toString(): string }).toString(),
      title: (task as Record<string, unknown>).title,
      domainId: (task as Record<string, unknown>).domainId,
    },
  });
}

// ============ DELETE TASK (soft) ============
export async function deleteTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const task = await Task.findByIdAndUpdate(id, { isActive: false }, { new: true }).lean();
  if (!task) return textResult({ error: 'Task not found' }, true);

  return textResult({
    success: true,
    message: `Task "${(task as Record<string, unknown>).title}" deactivated`,
  });
}

// ============ COMPLETE TASK ============
export async function completeTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, date } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  const task = await Task.findById(id).lean();
  if (!task) return textResult({ error: 'Task not found' }, true);

  const log = await DailyLog.findOneAndUpdate(
    { taskId: id, date: targetDate },
    {
      taskId: id,
      date: targetDate,
      status: 'completed',
      completedAt: new Date(),
      pointsEarned: (task as Record<string, unknown>).basePoints || 1,
    },
    { upsert: true, new: true }
  ).lean();

  return textResult({
    success: true,
    message: `Task "${(task as Record<string, unknown>).title}" completed for ${dateStr}`,
    pointsEarned: (log as Record<string, unknown>).pointsEarned,
  });
}

// ============ UNCOMPLETE TASK ============
export async function uncompleteTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, date } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  await DailyLog.findOneAndUpdate(
    { taskId: id, date: targetDate },
    { status: 'pending', completedAt: null, skippedAt: null, pointsEarned: 0 },
    { upsert: true, new: true }
  );

  return textResult({ success: true, message: `Task uncompleted for ${dateStr}` });
}

// ============ SKIP TASK ============
export async function skipTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, date } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  await DailyLog.findOneAndUpdate(
    { taskId: id, date: targetDate },
    {
      taskId: id,
      date: targetDate,
      status: 'skipped',
      skippedAt: new Date(),
      pointsEarned: 0,
    },
    { upsert: true, new: true }
  );

  return textResult({ success: true, message: `Task skipped for ${dateStr}` });
}

// ============ UNSKIP TASK ============
export async function unskipTask(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, date } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  await DailyLog.findOneAndUpdate(
    { taskId: id, date: targetDate },
    { status: 'pending', skippedAt: null, pointsEarned: 0 },
    { upsert: true, new: true }
  );

  return textResult({ success: true, message: `Task unskipped for ${dateStr}` });
}

// ============ REORDER TASKS ============
export async function reorderTasks(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { items } = args;
  if (!items || !Array.isArray(items)) {
    return textResult({ error: 'items array is required: [{id, order}]' }, true);
  }

  const ops = (items as Array<{ id: string; order: number }>).map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Task.bulkWrite(ops);

  return textResult({ success: true, message: `Reordered ${ops.length} tasks` });
}

// ============ BULK CREATE TASKS ============
export async function bulkCreateTasks(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { tasks } = args;
  if (!tasks || !Array.isArray(tasks)) {
    return textResult({ error: 'tasks array is required' }, true);
  }

  const results = { success: [] as string[], failed: [] as { title: string; error: string }[] };

  for (const t of tasks as Array<Record<string, unknown>>) {
    try {
      if (!t.title || !t.domainId) {
        results.failed.push({ title: (t.title as string) || 'Unknown', error: 'Missing title or domainId' });
        continue;
      }
      const task = await Task.create({
        title: t.title,
        domainId: t.domainId,
        basePoints: (t.basePoints as number) || 1,
        timeOfDay: (t.timeOfDay as string) || 'none',
        mustDo: t.mustDo || false,
        recurrenceType: (t.recurrenceType as string) || 'daily',
        recurrenceDays: (t.recurrenceDays as number[]) || [],
        order: 999,
      });
      results.success.push(task._id.toString());
    } catch (err) {
      results.failed.push({
        title: (t.title as string) || 'Unknown',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return textResult({
    message: `Created ${results.success.length} tasks, ${results.failed.length} failed`,
    results,
  });
}
