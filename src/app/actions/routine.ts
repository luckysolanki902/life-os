'use server';

import connectDB from '@/lib/db';
import Task from '@/models/Task';
import DailyLog from '@/models/DailyLog';
import { revalidatePath } from 'next/cache';
import {
  parseToISTMidnight,
  getTodayISTMidnight,
  getTodayDateString,
  getDateRange,
  getDayOfWeek
} from '@/lib/server-date-utils';

// Helper function to check if a task should appear on a given day
function shouldShowTaskOnDay(task: { recurrenceType?: string; recurrenceDays?: number[] }, dayOfWeek: number): boolean {
  const recurrenceType = task.recurrenceType || 'daily';
  
  switch (recurrenceType) {
    case 'daily':
      return true;
    case 'weekdays':
      // Monday (1) through Friday (5)
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      // Saturday (6) and Sunday (0)
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      // Check if dayOfWeek is in the recurrenceDays array
      return (task.recurrenceDays || []).includes(dayOfWeek);
    default:
      return true;
  }
}

// --- Fetching ---

export async function getRoutine(dateStr?: string) {
  await connectDB();
  
  console.log('[getRoutine] Called with dateStr:', dateStr);
  
  // Use IST midnight for consistent date handling
  let targetDateStr = dateStr || getTodayDateString();
  
  // Validate date string before use
  if (!targetDateStr || typeof targetDateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(targetDateStr)) {
    console.error('[getRoutine] Invalid date string:', dateStr);
    targetDateStr = getTodayDateString();
  }
  
  console.log('[getRoutine] Using date:', targetDateStr);
  
  const { startOfDay, endOfDay } = getDateRange(targetDateStr);
  const dayOfWeek = getDayOfWeek(targetDateStr);

  // 1. Get all active tasks definition
  const tasks = await Task.find({ isActive: true }).sort({ order: 1 }).lean();
  
  // 2. Filter tasks by recurrence for today
  const todaysTasks = tasks.filter((task) => shouldShowTaskOnDay(task, dayOfWeek));

  // 3. Get today's logs for these tasks (use date range for safety)
  const logs = await DailyLog.find({
    date: { $gte: startOfDay, $lt: endOfDay },
    taskId: { $in: todaysTasks.map((t) => t._id) }
  }).lean();

  // 4. Merge them
  const routine = todaysTasks.map((task) => {
    const log = logs.find((l) => l.taskId.toString() === task._id.toString());
    
    // Destructure to remove potential subtasks or other non-serializable fields from old schema
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { subtasks, ...cleanTask } = task;

    return {
      ...cleanTask,
      _id: task._id.toString(),
      log: log ? {
        ...log,
        _id: log._id.toString(),
        taskId: log.taskId.toString(),
      } : null
    };
  });

  // 5. Get special tasks (auto-generated from activity logs)
  const { getSpecialTasks } = await import('./streak');
  console.log('[getRoutine] Fetching special tasks for date:', targetDateStr);
  const specialTasks = await getSpecialTasks(targetDateStr);
  console.log('[getRoutine] Special tasks returned:', specialTasks.length);

  return { routine, specialTasks };
}

// Get routine for a specific date (for viewing/editing past days)
export async function getRoutineForDate(dateStr: string) {
  await connectDB();
  
  // Parse the date string using IST timezone
  const { startOfDay, endOfDay } = getDateRange(dateStr);
  const dayOfWeek = getDayOfWeek(dateStr);
  
  // 1. Get all active tasks
  const tasks = await Task.find({ isActive: true }).sort({ order: 1 }).lean();
  
  // 2. Filter tasks by recurrence for that day
  const daysTasks = tasks.filter((task) => shouldShowTaskOnDay(task, dayOfWeek));
  
  // 3. Get logs for these tasks on that date
  const logs = await DailyLog.find({
    date: { $gte: startOfDay, $lt: endOfDay },
    taskId: { $in: daysTasks.map((t) => t._id) }
  }).lean();
  
  // 4. Merge them
  const routine = daysTasks.map((task) => {
    const log = logs.find((l) => l.taskId.toString() === task._id.toString());
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { subtasks, ...cleanTask } = task;

    return {
      ...cleanTask,
      _id: task._id.toString(),
      log: log ? {
        ...log,
        _id: log._id.toString(),
        taskId: log.taskId.toString(),
      } : null
    };
  });

  // 5. Get special tasks for this date
  const { getSpecialTasks } = await import('./streak');
  console.log('[getRoutineForDate] Fetching special tasks for date:', dateStr);
  const specialTasks = await getSpecialTasks(dateStr);
  console.log('[getRoutineForDate] Special tasks returned:', specialTasks.length);

  return { routine, specialTasks };
}

// Get all tasks (regardless of recurrence) for management view
export async function getAllTasks() {
  await connectDB();
  
  const tasks = await Task.find({ isActive: true }).sort({ order: 1 }).lean();
  
  return tasks.map((task) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { subtasks, ...cleanTask } = task;
    return {
      ...cleanTask,
      _id: task._id.toString(),
    };
  });
}

// --- Actions ---

export async function createTask(formData: FormData) {
  await connectDB();
  
  const title = formData.get('title');
  const domainId = formData.get('domainId');
  const basePoints = Number(formData.get('basePoints'));
  const timeOfDay = formData.get('timeOfDay') || 'none';
  
  const mustDo = formData.get('mustDo') === 'true';
  
  // Recurrence
  const recurrenceType = formData.get('recurrenceType') || 'daily';
  const recurrenceDaysStr = formData.get('recurrenceDays');
  const recurrenceDays = recurrenceDaysStr ? JSON.parse(recurrenceDaysStr as string) : [];

  // Basic validation
  if (!title || !domainId) return { error: 'Missing fields' };

  await Task.create({
    title,
    domainId,
    basePoints,
    timeOfDay,
    mustDo,
    recurrenceType,
    recurrenceDays,
    order: 999, // Append to end
  });

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/social');
  return { success: true };
}

export async function updateTask(taskId: string, data: {
  title?: string;
  domainId?: string;
  timeOfDay?: string;
  basePoints?: number;
  mustDo?: boolean;
  recurrenceType?: string;
  recurrenceDays?: number[];
}) {
  await connectDB();
  
  const task = await Task.findById(taskId);
  if (!task) return { error: 'Task not found' };
  
  await Task.findByIdAndUpdate(taskId, {
    $set: {
      ...data,
    }
  });

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/social');
  return { success: true };
}

export async function deleteTask(taskId: string) {
  await connectDB();
  
  // Soft delete - set isActive to false
  await Task.findByIdAndUpdate(taskId, { $set: { isActive: false } });

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/social');
  return { success: true };
}

export async function completeTask(taskId: string, dateStr?: string) {
  await connectDB();
  
  // Use client-provided date or today's date, always as IST midnight
  const targetDateStr = dateStr || getTodayDateString();
  const today = parseToISTMidnight(targetDateStr);

  const task = await Task.findById(taskId);
  if (!task) return { error: 'Task not found' };

  const points = task.basePoints || 0;

  // Create/Update Log - points are stored in DailyLog and calculated via aggregation
  // This is the single source of truth for points
  await DailyLog.findOneAndUpdate(
    { taskId, date: today },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        pointsEarned: points,
        skippedAt: null,
      }
    },
    { upsert: true, new: true }
  );

  // Update streak for this date
  const { updateStreakForDate } = await import('./streak');
  await updateStreakForDate(targetDateStr);

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/learning');
  revalidatePath('/books');
  revalidatePath('/');
  return { success: true };
}

export async function uncompleteTask(taskId: string, dateStr?: string) {
  await connectDB();
  
  // Use client-provided date or today's date, always as IST midnight
  const targetDateStr = dateStr || getTodayDateString();
  const today = parseToISTMidnight(targetDateStr);

  // Remove the log - points will be recalculated via aggregation
  // DailyLog is the single source of truth
  await DailyLog.deleteOne({ taskId, date: today });

  // Update streak for this date
  const { updateStreakForDate } = await import('./streak');
  await updateStreakForDate(targetDateStr);

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/learning');
  revalidatePath('/books');
  revalidatePath('/');
  return { success: true };
}

export async function skipTask(taskId: string, dateStr?: string) {
  await connectDB();
  
  // Use client-provided date or today's date, always as IST midnight
  const today = dateStr ? parseToISTMidnight(dateStr) : getTodayISTMidnight();

  const task = await Task.findById(taskId);
  if (!task) return { error: 'Task not found' };

  // Create/Update Log with skipped status (no points)
  await DailyLog.findOneAndUpdate(
    { taskId, date: today },
    {
      $set: {
        status: 'skipped',
        skippedAt: new Date(),
        pointsEarned: 0,
      }
    },
    { upsert: true, new: true }
  );

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/learning');
  revalidatePath('/books');
  revalidatePath('/');
  return { success: true };
}

export async function unskipTask(taskId: string, dateStr?: string) {
  await connectDB();
  
  // Use client-provided date or today's date, always as IST midnight
  const today = dateStr ? parseToISTMidnight(dateStr) : getTodayISTMidnight();

  // Find the log and remove it to allow fresh completion
  const log = await DailyLog.findOne({ taskId, date: today });
  
  if (log && log.status === 'skipped') {
    await DailyLog.deleteOne({ _id: log._id });
  }

  revalidatePath('/routine');
  revalidatePath('/health');
  revalidatePath('/learning');
  revalidatePath('/books');
  revalidatePath('/');
  return { success: true };
}

export async function toggleTaskStatus(taskId: string, isCurrentlyCompleted: boolean) {
    // If currently completed, we want to uncomplete. If not completed, we want to complete.
    if (isCurrentlyCompleted) {
        return uncompleteTask(taskId);
    } else {
        return completeTask(taskId);
    }
}

export async function updateTaskOrder(items: { id: string; order: number }[]) {
  await connectDB();
  
  const operations = items.map((item) => ({
    updateOne: {
      filter: { _id: item.id },
      update: { $set: { order: item.order } },
    },
  }));

  await Task.bulkWrite(operations);
  revalidatePath('/routine');
  return { success: true };
}

export async function bulkCreateTasks(tasksData: Array<{
  title: string;
  domainId?: string;
  timeOfDay?: string;
  basePoints?: string | number;
  startTime?: string | null;
  recurrenceType?: string;
  recurrenceDays?: number[];
  order?: number;
  [key: string]: unknown;
}>) {
  await connectDB();
  
  const tasksToInsert = tasksData.map((t, index) => ({
    title: t.title,
    domainId: t.domainId || 'health',
    timeOfDay: t.timeOfDay || 'none',
    basePoints: Number(t.basePoints) || 1,
    isScheduled: !!t.startTime,
    startTime: t.startTime || null,
    endTime: t.endTime || null,
    notificationsEnabled: true,
    recurrenceType: t.recurrenceType || 'daily',
    recurrenceDays: t.recurrenceDays || [],
    order: t.order !== undefined ? Number(t.order) : index
  }));

  if (tasksToInsert.length > 0) {
    await Task.insertMany(tasksToInsert);
    revalidatePath('/routine');
    revalidatePath('/health');
    revalidatePath('/social');
  }
  
  return { success: true };
}
