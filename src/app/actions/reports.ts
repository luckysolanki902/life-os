'use server';

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
import BookLog from '@/models/BookLog';
import BookDomain from '@/models/BookDomain';
import LearningCategory from '@/models/LearningCategory';
import LearningArea from '@/models/LearningArea';
import LearningSkill from '@/models/LearningSkill';
import PracticeMedium from '@/models/PracticeMedium';
import LearningLog from '@/models/LearningLog';
import SimpleLearningLog from '@/models/SimpleLearningLog';
import {
  dayjs
} from '@/lib/server-date-utils';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

// Helper functions for date ranges - using dayjs with IST
function getDateRange(period: string): { start: Date; end: Date } {
  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day');
  
  switch (period) {
    case 'last7Days': {
      // Last 7 days including today
      const sevenDaysAgo = today.subtract(6, 'day');
      return { start: sevenDaysAgo.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'last14Days': {
      const fourteenDaysAgo = today.subtract(13, 'day');
      return { start: fourteenDaysAgo.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'thisWeek': {
      // Start of week (Sunday) to today
      const startOfWeek = today.startOf('week');
      return { start: startOfWeek.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'lastWeek': {
      const startOfThisWeek = today.startOf('week');
      const startOfLastWeek = startOfThisWeek.subtract(7, 'day');
      return { start: startOfLastWeek.toDate(), end: startOfThisWeek.toDate() };
    }
    case 'thisMonth': {
      const startOfMonth = today.startOf('month');
      return { start: startOfMonth.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'lastMonth': {
      const startOfThisMonth = today.startOf('month');
      const startOfLastMonth = startOfThisMonth.subtract(1, 'month');
      return { start: startOfLastMonth.toDate(), end: startOfThisMonth.toDate() };
    }
    case 'last3Months': {
      const threeMonthsAgo = today.subtract(3, 'month');
      return { start: threeMonthsAgo.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'last6Months': {
      const sixMonthsAgo = today.subtract(6, 'month');
      return { start: sixMonthsAgo.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'thisYear': {
      const startOfYear = today.startOf('year');
      return { start: startOfYear.toDate(), end: today.add(1, 'day').toDate() };
    }
    case 'allTime': {
      return { start: dayjs('2020-01-01').tz(DEFAULT_TIMEZONE).toDate(), end: today.add(1, 'day').toDate() };
    }
    default:
      // Default to last 7 days
      const sevenDaysAgo = today.subtract(6, 'day');
      return { start: sevenDaysAgo.toDate(), end: today.add(1, 'day').toDate() };
  }
}

function getPreviousPeriodRange(period: string): { start: Date; end: Date } {
  const current = getDateRange(period);
  const duration = current.end.getTime() - current.start.getTime();
  return {
    start: new Date(current.start.getTime() - duration),
    end: current.start
  };
}

function getDaysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

// ============ OVERALL DASHBOARD REPORT ============
export async function getOverallReport(period: string = 'thisWeek') {
  await connectDB();
  
  const { start, end } = getDateRange(period);
  const prev = getPreviousPeriodRange(period);
  const daysInPeriod = getDaysBetween(start, end);
  
  // ROUTINE: Task completion stats
  const allTasks = await Task.find({ isActive: true }).lean();
  const taskIds = allTasks.map((t: any) => t._id);
  
  const completedLogs = await DailyLog.countDocuments({
    taskId: { $in: taskIds },
    date: { $gte: start, $lt: end },
    status: 'completed'
  });
  
  const totalPossibleTasks = await DailyLog.countDocuments({
    taskId: { $in: taskIds },
    date: { $gte: start, $lt: end }
  });
  
  const prevCompletedLogs = await DailyLog.countDocuments({
    taskId: { $in: taskIds },
    date: { $gte: prev.start, $lt: prev.end },
    status: 'completed'
  });
  
  const prevTotalPossibleTasks = await DailyLog.countDocuments({
    taskId: { $in: taskIds },
    date: { $gte: prev.start, $lt: prev.end }
  });
  
  const routineCompletionRate = totalPossibleTasks > 0 ? Math.round((completedLogs / totalPossibleTasks) * 100) : 0;
  const prevRoutineCompletionRate = prevTotalPossibleTasks > 0 ? Math.round((prevCompletedLogs / prevTotalPossibleTasks) * 100) : 0;
  
  // Points earned - USE COMPREHENSIVE CALCULATION
  // Get base points from routine tasks for the period
  const routinePointsResult = await DailyLog.aggregate([
    { $match: { date: { $gte: start, $lt: end }, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
  ]);
  const routinePoints = routinePointsResult[0]?.total || 0;
  
  // Get streak bonuses for the period
  const streakBonusResult = await DailyStreakRecord.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$bonusPointsAwarded' } } }
  ]);
  const periodStreakBonus = streakBonusResult[0]?.total || 0;
  
  // Count books read in period
  const booksReadInPeriod = await Book.countDocuments({
    lastReadDate: { $gte: start, $lt: end }
  });
  const periodBookPoints = booksReadInPeriod * 5; // BOOK_TASK_POINTS = 5
  
  // Count learning sessions in period
  const learningSessionsInPeriod = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: { date: '$date', skill: '$skillName' } } },
    { $count: 'total' }
  ]);
  const periodLearningPoints = (learningSessionsInPeriod[0]?.total || 0) * 10; // LEARNING_TASK_POINTS = 10
  
  const totalPoints = routinePoints + periodStreakBonus + periodBookPoints + periodLearningPoints;
  
  // Previous period points (same calculation)
  const prevRoutinePointsResult = await DailyLog.aggregate([
    { $match: { date: { $gte: prev.start, $lt: prev.end }, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
  ]);
  const prevRoutinePoints = prevRoutinePointsResult[0]?.total || 0;
  
  const prevStreakBonusResult = await DailyStreakRecord.aggregate([
    { $match: { date: { $gte: prev.start, $lt: prev.end } } },
    { $group: { _id: null, total: { $sum: '$bonusPointsAwarded' } } }
  ]);
  const prevStreakBonus = prevStreakBonusResult[0]?.total || 0;
  
  const prevBooksRead = await Book.countDocuments({
    lastReadDate: { $gte: prev.start, $lt: prev.end }
  });
  const prevBookPoints = prevBooksRead * 5;
  
  const prevLearningSessions = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: prev.start, $lt: prev.end } } },
    { $group: { _id: { date: '$date', skill: '$skillName' } } },
    { $count: 'total' }
  ]);
  const prevLearningPoints = (prevLearningSessions[0]?.total || 0) * 10;
  
  const prevTotalPoints = prevRoutinePoints + prevStreakBonus + prevBookPoints + prevLearningPoints;
  
  // HEALTH: Exercise days (unique days with exercise), weight change
  const exerciseDaysResult = await ExerciseLog.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
    { $count: 'days' }
  ]);
  const exerciseDays = exerciseDaysResult[0]?.days || 0;
  
  const prevExerciseDaysResult = await ExerciseLog.aggregate([
    { $match: { date: { $gte: prev.start, $lt: prev.end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
    { $count: 'days' }
  ]);
  const prevExerciseDays = prevExerciseDaysResult[0]?.days || 0;
  
  // Weight change
  const latestWeight = await WeightLog.findOne({ date: { $lt: end } }).sort({ date: -1 }).lean();
  const startWeight = await WeightLog.findOne({ date: { $lt: start } }).sort({ date: -1 }).lean();
  const currentWeight = latestWeight ? Number(((latestWeight as any).weight).toFixed(1)) : null;
  const weightChange = latestWeight && startWeight 
    ? Number(((latestWeight as any).weight - (startWeight as any).weight).toFixed(1))
    : 0;
    
  // Mood average
  const moodLogs = await MoodLog.find({ date: { $gte: start, $lt: end } }).lean();
  const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
  const avgMood = moodLogs.length > 0 
    ? (moodLogs.reduce((acc, m: any) => acc + moodValues[m.mood], 0) / moodLogs.length).toFixed(1)
    : 0;
  
  // BOOKS: Pages read (calculate from progress), books completed
  const bookLogs = await BookLog.find({ date: { $gte: start, $lt: end } })
    .populate('bookId')
    .sort({ date: 1 })
    .lean();
  
  // Calculate pages read by tracking progress per book
  const bookPageTracker: Record<string, { firstPage: number; lastPage: number }> = {};
  bookLogs.forEach((log: any) => {
    const bookId = log.bookId?._id?.toString() || log.bookId?.toString();
    if (!bookId) return;
    
    if (!bookPageTracker[bookId]) {
      bookPageTracker[bookId] = { firstPage: log.currentPage, lastPage: log.currentPage };
    } else {
      bookPageTracker[bookId].lastPage = Math.max(bookPageTracker[bookId].lastPage, log.currentPage);
      bookPageTracker[bookId].firstPage = Math.min(bookPageTracker[bookId].firstPage, log.currentPage);
    }
  });
  
  const totalPagesRead = Object.values(bookPageTracker).reduce(
    (acc, p) => acc + Math.max(0, p.lastPage - p.firstPage), 
    0
  );
  
  // Previous period pages read
  const prevBookLogs = await BookLog.find({ date: { $gte: prev.start, $lt: prev.end } })
    .sort({ date: 1 })
    .lean();
  
  const prevBookPageTracker: Record<string, { firstPage: number; lastPage: number }> = {};
  prevBookLogs.forEach((log: any) => {
    const bookId = log.bookId?._id?.toString() || log.bookId?.toString();
    if (!bookId) return;
    
    if (!prevBookPageTracker[bookId]) {
      prevBookPageTracker[bookId] = { firstPage: log.currentPage, lastPage: log.currentPage };
    } else {
      prevBookPageTracker[bookId].lastPage = Math.max(prevBookPageTracker[bookId].lastPage, log.currentPage);
      prevBookPageTracker[bookId].firstPage = Math.min(prevBookPageTracker[bookId].firstPage, log.currentPage);
    }
  });
  
  const prevPagesRead = Object.values(prevBookPageTracker).reduce(
    (acc, p) => acc + Math.max(0, p.lastPage - p.firstPage), 
    0
  );
  
  const booksCompleted = await Book.countDocuments({
    completedDate: { $gte: start, $lt: end }
  });
  const prevBooksCompleted = await Book.countDocuments({
    completedDate: { $gte: prev.start, $lt: prev.end }
  });
  
  // LEARNING: Total minutes practiced (using SimpleLearningLog)
  const learningResult = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$duration' } } }
  ]);
  const learningMinutes = learningResult[0]?.total || 0;
  
  const prevLearningResult = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: prev.start, $lt: prev.end } } },
    { $group: { _id: null, total: { $sum: '$duration' } } }
  ]);
  const prevLearningMinutes = prevLearningResult[0]?.total || 0;
  
  // Domain breakdown for the period
  // Health: based on routine tasks
  const healthTasks = await Task.find({ domainId: 'health', isActive: true }).lean();
  const healthTaskIds = healthTasks.map((t: any) => t._id);
  
  const healthCompleted = await DailyLog.countDocuments({
    taskId: { $in: healthTaskIds },
    date: { $gte: start, $lt: end },
    status: 'completed'
  });
  
  const healthTotal = await DailyLog.countDocuments({
    taskId: { $in: healthTaskIds },
    date: { $gte: start, $lt: end }
  });
  
  const healthPointsRes = await DailyLog.aggregate([
    { $match: { taskId: { $in: healthTaskIds }, date: { $gte: start, $lt: end }, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
  ]);
  
  // Learning: based on learning logs - calculate days with practice vs total days
  const learningLogDays = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
    { $count: 'days' }
  ]);
  const learningDaysWithPractice = learningLogDays[0]?.days || 0;
  
  // Learning points: calculate from duration (1 point per 5 minutes)
  const learningPoints = Math.floor(learningMinutes / 5);
  
  const domainBreakdown = [
    {
      domain: 'health',
      completed: healthCompleted,
      total: healthTotal,
      completionRate: healthTotal > 0 ? Math.round((healthCompleted / healthTotal) * 100) : 0,
      points: healthPointsRes[0]?.total || 0
    },
    {
      domain: 'learning',
      completed: learningDaysWithPractice,
      total: daysInPeriod,
      completionRate: daysInPeriod > 0 ? Math.round((learningDaysWithPractice / daysInPeriod) * 100) : 0,
      points: learningPoints
    }
  ];
  
  // Daily breakdown for charts
  const dailyBreakdown = [];
  
  // Helper function to check if task should appear on a given day
  const shouldShowTaskOnDay = (task: any, dayOfWeek: number): boolean => {
    const recurrenceType = task.recurrenceType || 'daily';
    switch (recurrenceType) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      case 'weekends':
        return dayOfWeek === 0 || dayOfWeek === 6;
      case 'custom':
        return (task.recurrenceDays || []).includes(dayOfWeek);
      default:
        return true;
    }
  };
  
  for (let i = 0; i < daysInPeriod && i < 31; i++) {
    const dayStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dayOfWeek = dayStart.getDay();
    
    // Calculate how many tasks SHOULD appear on this day based on recurrence
    const expectedTasksForDay = allTasks.filter((task: any) => shouldShowTaskOnDay(task, dayOfWeek)).length;
    
    // Get actual completed tasks from DailyLog
    const dayCompleted = await DailyLog.countDocuments({
      taskId: { $in: taskIds },
      date: { $gte: dayStart, $lt: dayEnd },
      status: 'completed'
    });
    
    // Get learning duration for this day
    const dayLearningResult = await SimpleLearningLog.aggregate([
      { $match: { date: { $gte: dayStart, $lt: dayEnd } } },
      { $group: { _id: null, total: { $sum: '$duration' } } }
    ]);
    const dayLearningMinutes = dayLearningResult[0]?.total || 0;
    
    // Get pages read for this day
    const dayBookLogs = await BookLog.find({ date: { $gte: dayStart, $lt: dayEnd } })
      .sort({ date: 1 })
      .lean();
    
    const dayBookPageTracker: Record<string, { firstPage: number; lastPage: number }> = {};
    dayBookLogs.forEach((log: any) => {
      const bookId = log.bookId?._id?.toString() || log.bookId?.toString();
      if (!bookId) return;
      
      if (!dayBookPageTracker[bookId]) {
        dayBookPageTracker[bookId] = { firstPage: log.currentPage, lastPage: log.currentPage };
      } else {
        dayBookPageTracker[bookId].lastPage = Math.max(dayBookPageTracker[bookId].lastPage, log.currentPage);
        dayBookPageTracker[bookId].firstPage = Math.min(dayBookPageTracker[bookId].firstPage, log.currentPage);
      }
    });
    
    const dayPagesRead = Object.values(dayBookPageTracker).reduce(
      (acc, p) => acc + Math.max(0, p.lastPage - p.firstPage), 
      0
    );

    // Get weight for this day
    const dayWeightLog = await WeightLog.findOne({
      date: { $gte: dayStart, $lt: dayEnd }
    }).sort({ date: -1 }).lean();
    
    // Use expected tasks as total (not just logged tasks)
    dailyBreakdown.push({
      date: dayStart.toISOString().split('T')[0],
      dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      completed: dayCompleted,
      total: expectedTasksForDay,
      rate: expectedTasksForDay > 0 ? Math.round((dayCompleted / expectedTasksForDay) * 100) : 0,
      learningMinutes: dayLearningMinutes,
      pagesRead: dayPagesRead,
      weight: dayWeightLog?.weight || null
    });
  }
  
  return {
    period,
    dateRange: { start: start.toISOString(), end: end.toISOString() },
    summary: {
      routineCompletionRate,
      routineChange: routineCompletionRate - prevRoutineCompletionRate,
      totalPoints,
      pointsChange: totalPoints - prevTotalPoints,
      exerciseDays,
      exerciseChange: exerciseDays - prevExerciseDays,
      currentWeight,
      weightChange,
      avgMood: Number(avgMood),
      booksCompleted,
      booksChange: booksCompleted - prevBooksCompleted,
      pagesRead: totalPagesRead,
      pagesReadChange: totalPagesRead - prevPagesRead,
      learningMinutes,
      learningChange: learningMinutes - prevLearningMinutes,
      interactions: 0,
      interactionsChange: 0
    },
    domainBreakdown,
    dailyBreakdown
  };
}

// ============ ROUTINE REPORT ============
export async function getRoutineReport(period: string = 'thisWeek') {
  await connectDB();
  
  const { start, end } = getDateRange(period);
  const prev = getPreviousPeriodRange(period);
  const daysInPeriod = getDaysBetween(start, end);
  
  // Get all tasks grouped by domain
  const tasks = await Task.find({ isActive: true }).sort({ order: 1 }).lean();
  
  const taskStats = await Promise.all(tasks.map(async (task: any) => {
    const completed = await DailyLog.countDocuments({
      taskId: task._id,
      date: { $gte: start, $lt: end },
      status: 'completed'
    });
    
    const total = await DailyLog.countDocuments({
      taskId: task._id,
      date: { $gte: start, $lt: end }
    });
    
    const prevCompleted = await DailyLog.countDocuments({
      taskId: task._id,
      date: { $gte: prev.start, $lt: prev.end },
      status: 'completed'
    });
    
    const prevTotal = await DailyLog.countDocuments({
      taskId: task._id,
      date: { $gte: prev.start, $lt: prev.end }
    });
    
    const pointsRes = await DailyLog.aggregate([
      { $match: { taskId: task._id, date: { $gte: start, $lt: end }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
    ]);
    
    // Get streak
    const recentLogs = await DailyLog.find({ taskId: task._id })
      .sort({ date: -1 })
      .limit(30)
      .lean();
    
    let currentStreak = 0;
    
    for (let i = 0; i < recentLogs.length; i++) {
      const log = recentLogs[i] as any;
      if (log.status === 'completed') {
        currentStreak++;
      } else {
        break;
      }
    }
    
    return {
      _id: task._id.toString(),
      title: task.title,
      domainId: task.domainId,
      timeOfDay: task.timeOfDay,
      completed,
      total,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      prevCompletionRate: prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0,
      points: pointsRes[0]?.total || 0,
      currentStreak
    };
  }));
  
  // Group by domain
  const byDomain: Record<string, any[]> = {};
  taskStats.forEach(task => {
    if (!byDomain[task.domainId]) byDomain[task.domainId] = [];
    byDomain[task.domainId].push(task);
  });
  
  // Group by time of day
  const byTimeOfDay: Record<string, any[]> = {};
  taskStats.forEach(task => {
    const time = task.timeOfDay || 'none';
    if (!byTimeOfDay[time]) byTimeOfDay[time] = [];
    byTimeOfDay[time].push(task);
  });
  
  // Overall stats
  const totalCompleted = taskStats.reduce((acc, t) => acc + t.completed, 0);
  const totalTasks = taskStats.reduce((acc, t) => acc + t.total, 0);
  const totalPoints = taskStats.reduce((acc, t) => acc + t.points, 0);
  const avgCompletionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  
  // Best and worst performing tasks
  const sortedByRate = [...taskStats].sort((a, b) => b.completionRate - a.completionRate);
  const bestTasks = sortedByRate.slice(0, 5);
  const worstTasks = sortedByRate.filter(t => t.total > 0).slice(-5).reverse();
  
  // Daily completion chart
  const dailyData = [];
  for (let i = 0; i < Math.min(daysInPeriod, 31); i++) {
    const dayStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const dayCompleted = await DailyLog.countDocuments({
      date: { $gte: dayStart, $lt: dayEnd },
      status: 'completed'
    });
    
    const dayTotal = await DailyLog.countDocuments({
      date: { $gte: dayStart, $lt: dayEnd }
    });
    
    dailyData.push({
      date: dayStart.toISOString().split('T')[0],
      dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      completed: dayCompleted,
      total: dayTotal,
      rate: dayTotal > 0 ? Math.round((dayCompleted / dayTotal) * 100) : 0
    });
  }
  
  return {
    period,
    summary: {
      totalCompleted,
      totalTasks,
      avgCompletionRate,
      totalPoints,
      totalActiveTasks: tasks.length
    },
    taskStats: taskStats.sort((a, b) => b.completionRate - a.completionRate),
    byDomain,
    byTimeOfDay,
    bestTasks,
    worstTasks,
    dailyData
  };
}

// ============ HEALTH REPORT ============
export async function getHealthReport(period: string = 'thisWeek') {
  await connectDB();
  
  // Explicitly ensure ExerciseDefinition model is registered
  if (!ExerciseDefinition) {
    throw new Error('ExerciseDefinition model not loaded');
  }
  
  const { start, end } = getDateRange(period);
  const prev = getPreviousPeriodRange(period);
  const daysInPeriod = getDaysBetween(start, end);
  
  // Exercise stats
  const exerciseLogs = await ExerciseLog.find({ date: { $gte: start, $lt: end } })
    .populate('exerciseId')
    .exec()
    .then((docs) => docs.map(doc => doc.toObject({ flattenMaps: true })));
    
  const prevExerciseLogs = await ExerciseLog.find({ date: { $gte: prev.start, $lt: prev.end } }).lean();
  
  // Group exercises by muscle
  const muscleWork: Record<string, number> = {};
  const exercisesByType: Record<string, { count: number; totalSets: number; totalReps: number; totalWeight: number }> = {};
  
  exerciseLogs.forEach((log: any) => {
    if (log.exerciseId?.targetMuscles) {
      log.exerciseId.targetMuscles.forEach((muscle: string) => {
        muscleWork[muscle] = (muscleWork[muscle] || 0) + 1;
      });
    }
    
    const exerciseName = log.exerciseId?.title || 'Unknown';
    if (!exercisesByType[exerciseName]) {
      exercisesByType[exerciseName] = { count: 0, totalSets: 0, totalReps: 0, totalWeight: 0 };
    }
    exercisesByType[exerciseName].count++;
    exercisesByType[exerciseName].totalSets += log.sets?.length || 0;
    log.sets?.forEach((set: any) => {
      exercisesByType[exerciseName].totalReps += set.reps || 0;
      exercisesByType[exerciseName].totalWeight += (set.weight || 0) * (set.reps || 0);
    });
  });
  
  // Weight tracking
  const weightLogs = await WeightLog.find({ date: { $gte: start, $lt: end } })
    .sort({ date: 1 })
    .lean();
    
  const startWeight = await WeightLog.findOne({ date: { $lt: start } }).sort({ date: -1 }).lean();
  const latestWeight = weightLogs.length > 0 
    ? weightLogs[weightLogs.length - 1] 
    : await WeightLog.findOne({ date: { $lt: end } }).sort({ date: -1 }).lean();
  
  const weightChange = latestWeight && startWeight 
    ? Number(((latestWeight as any).weight - (startWeight as any).weight).toFixed(1))
    : 0;
  
  // Mood tracking
  const moodLogs = await MoodLog.find({ date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean();
  const moodValues: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
  const moodDistribution: Record<string, number> = { great: 0, good: 0, okay: 0, low: 0, bad: 0 };
  moodLogs.forEach((m: any) => {
    moodDistribution[m.mood] = (moodDistribution[m.mood] || 0) + 1;
  });
  
  const avgMood = moodLogs.length > 0 
    ? (moodLogs.reduce((acc, m: any) => acc + moodValues[m.mood], 0) / moodLogs.length).toFixed(1)
    : 0;
  
  // Health routine tasks
  const healthTasks = await Task.find({ domainId: 'health', isActive: true }).lean();
  const healthTaskIds = healthTasks.map((t: any) => t._id);
  
  const healthTasksCompleted = await DailyLog.countDocuments({
    taskId: { $in: healthTaskIds },
    date: { $gte: start, $lt: end },
    status: 'completed'
  });
  
  const healthTasksTotal = await DailyLog.countDocuments({
    taskId: { $in: healthTaskIds },
    date: { $gte: start, $lt: end }
  });

  // Calculate workout streak with rest day logic
  // Get all exercise logs for streak calculation (last 90 days)
  const streakStart = dayjs().tz(DEFAULT_TIMEZONE).subtract(90, 'day').startOf('day').toDate();
  const streakEnd = dayjs().tz(DEFAULT_TIMEZONE).add(1, 'day').startOf('day').toDate();
  const allExerciseLogs = await ExerciseLog.find({ 
    date: { $gte: streakStart, $lt: streakEnd } 
  }).sort({ date: -1 }).lean();

  // Group by date
  const exerciseByDate: Record<string, boolean> = {};
  allExerciseLogs.forEach((log: any) => {
    const logDate = dayjs(log.date).tz(DEFAULT_TIMEZONE).format('YYYY-MM-DD');
    exerciseByDate[logDate] = true;
  });

  // Calculate streak backwards from today (counting both workout and valid rest days)
  let workoutStreak = 0;
  let checkDate = dayjs().tz(DEFAULT_TIMEZONE);
  let consecutiveWorkoutDays = 0;

  // Start from today and go backwards
  while (true) {
    const dateStr = checkDate.format('YYYY-MM-DD');
    const hasWorkout = exerciseByDate[dateStr];

    if (hasWorkout) {
      workoutStreak++;
      consecutiveWorkoutDays++;
    } else {
      // For today specifically, just break if no workout (don't count it yet)
      const isToday = checkDate.isSame(dayjs().tz(DEFAULT_TIMEZONE), 'day');
      if (isToday) {
        break;
      }
      
      // Check if this can be a rest day (after 2+ consecutive workout days)
      if (consecutiveWorkoutDays >= 2) {
        // This is a valid rest day, streak continues
        workoutStreak++; // Count rest day in streak
        consecutiveWorkoutDays = 0; // Reset counter for next rest day eligibility
      } else {
        // Can't be a rest day, streak breaks
        break;
      }
    }

    checkDate = checkDate.subtract(1, 'day');
    if (workoutStreak > 365) break; // Safety limit
  }
  
  // Calculate unique exercise days in the period
  const exerciseDaysResult = await ExerciseLog.aggregate([
    { $match: { date: { $gte: start, $lt: end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
    { $count: 'days' }
  ]);
  const totalExerciseDays = exerciseDaysResult[0]?.days || 0;
  
  const prevExerciseDaysResult = await ExerciseLog.aggregate([
    { $match: { date: { $gte: prev.start, $lt: prev.end } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
    { $count: 'days' }
  ]);
  const prevExerciseDays = prevExerciseDaysResult[0]?.days || 0;
  
  // Daily exercise chart - use dayjs for proper IST timezone handling
  const dailyExercise = [];
  for (let i = 0; i < Math.min(daysInPeriod, 31); i++) {
    const currentDay = dayjs(start).tz(DEFAULT_TIMEZONE).add(i, 'day');
    const dayStart = currentDay.startOf('day').toDate();
    const dayEnd = currentDay.add(1, 'day').startOf('day').toDate();
    
    const dayLogs = await ExerciseLog.find({ date: { $gte: dayStart, $lt: dayEnd } }).lean();
    const totalSets = dayLogs.reduce((acc, log: any) => acc + (log.sets?.length || 0), 0);
    
    dailyExercise.push({
      date: currentDay.format('YYYY-MM-DD'),
      dayName: currentDay.format('ddd'),
      sessions: dayLogs.length,
      sets: totalSets
    });
  }
  
  return {
    period,
    summary: {
      totalExerciseDays,
      prevExerciseDays,
      exerciseDaysChange: totalExerciseDays - prevExerciseDays,
      currentWeight: latestWeight ? (latestWeight as any).weight : null,
      weightChange,
      avgMood: Number(avgMood),
      healthTasksCompletionRate: healthTasksTotal > 0 
        ? Math.round((healthTasksCompleted / healthTasksTotal) * 100) 
        : 0,
      workoutStreak
    },
    muscleWork: Object.entries(muscleWork)
      .map(([muscle, count]) => ({ muscle, count }))
      .sort((a, b) => b.count - a.count),
    exercisesByType: Object.entries(exercisesByType)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    weightLogs: weightLogs.map((w: any) => ({
      date: w.date.toISOString().split('T')[0],
      weight: w.weight
    })),
    moodDistribution,
    moodLogs: moodLogs.map((m: any) => ({
      date: m.date.toISOString().split('T')[0],
      mood: m.mood,
      value: moodValues[m.mood]
    })),
    dailyExercise
  };
}

// Get recent moods (last 30 days or all available if less)
export async function getRecentMoods(limit: number = 30) {
  await connectDB();
  
  const moods = await MoodLog.find()
    .sort({ date: -1 })
    .limit(limit)
    .lean();
  
  return moods.map((m: any) => ({
    date: m.date.toISOString().split('T')[0],
    mood: m.mood,
    notes: m.notes || ''
  })); // Return in reverse chronological order (most recent first)
}

// ============ BOOKS REPORT ============
export async function getBooksReport(period: string = 'thisWeek') {
  await connectDB();
  
  const { start, end } = getDateRange(period);
  const prev = getPreviousPeriodRange(period);
  const daysInPeriod = getDaysBetween(start, end);
  
  // Books completed
  const booksCompleted = await Book.find({ completedDate: { $gte: start, $lt: end } }).lean();
  const prevBooksCompleted = await Book.countDocuments({ completedDate: { $gte: prev.start, $lt: prev.end } });
  
  // Books started
  const booksStarted = await Book.find({ startDate: { $gte: start, $lt: end } }).lean();
  
  // Reading logs
  const readingLogs = await BookLog.find({ date: { $gte: start, $lt: end } })
    .populate('bookId')
    .sort({ date: -1 })
    .lean();
  
  // Calculate total pages read from logs
  const totalPagesRead = readingLogs.reduce((acc, log: any) => acc + (log.pagesRead || 0), 0);
  const totalReadingSessions = readingLogs.length;
  
  // Reading by domain
  const domains = await BookDomain.find().lean();
  const byDomain = await Promise.all(domains.map(async (domain: any) => {
    const domainBooks = await Book.find({ domainId: domain._id }).lean();
    const domainBookIds = domainBooks.map((b: any) => b._id);
    
    const completed = domainBooks.filter((b: any) => b.status === 'completed').length;
    const reading = domainBooks.filter((b: any) => b.status === 'reading').length;
    const paused = domainBooks.filter((b: any) => b.status === 'paused').length;
    
    const periodLogs = await BookLog.find({
      bookId: { $in: domainBookIds },
      date: { $gte: start, $lt: end }
    }).lean();
    
    return {
      _id: domain._id.toString(),
      name: domain.name,
      color: domain.color,
      totalBooks: domainBooks.length,
      completed,
      reading,
      paused,
      sessionsThisPeriod: periodLogs.length
    };
  }));
  
  // Currently reading books with progress
  const currentlyReading = await Book.find({ status: 'reading' })
    .sort({ lastReadDate: -1 })
    .limit(10)
    .lean();
  
  const currentlyReadingWithProgress = await Promise.all(currentlyReading.map(async (book: any) => {
    const domain = await BookDomain.findById(book.domainId).lean();
    const progress = book.totalPages && book.currentPage 
      ? Math.round((book.currentPage / book.totalPages) * 100)
      : 0;
    
    const lastLog = await BookLog.findOne({ bookId: book._id }).sort({ date: -1 }).lean();
    
    return {
      _id: book._id.toString(),
      title: book.title,
      author: book.author,
      domain: domain ? { name: (domain as any).name, color: (domain as any).color } : null,
      currentPage: book.currentPage,
      totalPages: book.totalPages,
      progress,
      lastReadDate: book.lastReadDate
    };
  }));
  
  // Daily reading chart - pages read per day
  const dailyReading = [];
  for (let i = 0; i < Math.min(daysInPeriod, 31); i++) {
    const dayStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const dayLogs = await BookLog.find({ date: { $gte: dayStart, $lt: dayEnd } }).lean();
    
    // Sum up pagesRead from all logs for this day
    const dayPages = dayLogs.reduce((acc, log: any) => acc + (log.pagesRead || 0), 0);
    
    dailyReading.push({
      date: dayStart.toISOString().split('T')[0],
      dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      sessions: dayLogs.length,
      pagesRead: dayPages
    });
  }
  
  return {
    period,
    summary: {
      booksCompleted: booksCompleted.length,
      prevBooksCompleted,
      booksStarted: booksStarted.length,
      totalReadingSessions,
      totalPagesRead,
      currentlyReading: currentlyReading.length
    },
    booksCompleted: booksCompleted.map((b: any) => ({
      _id: b._id.toString(),
      title: b.title,
      author: b.author,
      completedDate: b.completedDate,
      rating: b.rating
    })),
    byDomain: byDomain.filter(d => d.totalBooks > 0),
    currentlyReadingWithProgress,
    dailyReading
  };
}

// ============ LEARNING REPORT ============
export async function getLearningReport(period: string = 'thisWeek', skillId?: string, categoryId?: string) {
  await connectDB();
  
  const { start, end } = getDateRange(period);
  const prev = getPreviousPeriodRange(period);
  const daysInPeriod = getDaysBetween(start, end);
  
  // Get filter options for dropdowns
  const allCategories = await LearningCategory.find().sort({ order: 1 }).lean();
  const allSkills = await LearningSkill.find().sort({ order: 1 }).lean();
  
  // Build filter based on skill/category selection
  let logFilter: any = {};
  if (skillId) {
    logFilter = { skillId };
  } else if (categoryId) {
    const skills = await LearningSkill.find({ categoryId }).lean();
    logFilter = { skillId: { $in: skills.map((s: any) => s._id) } };
  }
  
  // Get all learning logs for period with filter
  const logs = await SimpleLearningLog.find({ 
    date: { $gte: start, $lt: end },
    ...logFilter
  }).lean();
  
  const prevLogs = await SimpleLearningLog.find({ 
    date: { $gte: prev.start, $lt: prev.end },
    ...logFilter
  }).lean();
  
  // Total stats
  const totalMinutes = logs.reduce((acc, log: any) => acc + (log.duration || 0), 0);
  const prevTotalMinutes = prevLogs.reduce((acc, log: any) => acc + (log.duration || 0), 0);
  const totalSessions = logs.length;
  
  // By skill breakdown (more detailed)
  const skillsWithData = await Promise.all(allSkills.map(async (skill: any) => {
    const category = skill.categoryId ? allCategories.find((c: any) => c._id.toString() === skill.categoryId.toString()) : null;
    
    const skillLogs = await SimpleLearningLog.find({
      skillId: skill._id,
      date: { $gte: start, $lt: end }
    }).lean();
    
    const minutes = skillLogs.reduce((acc, log: any) => acc + (log.duration || 0), 0);
    
    return {
      _id: skill._id.toString(),
      name: skill.name,
      categoryId: skill.categoryId?.toString() || '',
      categoryName: (category as any)?.title || 'Unknown',
      categoryColor: (category as any)?.color || 'violet',
      sessions: skillLogs.length,
      minutes,
      avgSessionLength: skillLogs.length > 0 ? Math.round(minutes / skillLogs.length) : 0
    };
  }));
  
  // By category breakdown
  const byCategory = await Promise.all(allCategories.map(async (category: any) => {
    const skills = await LearningSkill.find({ categoryId: category._id }).lean();
    const skillIds = skills.map((s: any) => s._id);
    
    const categoryLogs = await SimpleLearningLog.find({
      skillId: { $in: skillIds },
      date: { $gte: start, $lt: end }
    }).lean();
    
    const minutes = categoryLogs.reduce((acc, log: any) => acc + (log.duration || 0), 0);
    
    return {
      _id: category._id.toString(),
      name: (category as any).title,
      color: (category as any).color || 'violet',
      sessions: categoryLogs.length,
      minutes,
      avgSessionLength: categoryLogs.length > 0 ? Math.round(minutes / categoryLogs.length) : 0
    };
  }));
  
  // SimpleLearningLog doesn't have difficulty or rating fields, so these are empty
  const difficultyDist: Record<string, number> = { easy: 0, moderate: 0, challenging: 0, hard: 0 };
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  // Top skills (most practiced)
  const topSkills = skillsWithData
    .filter(s => s.sessions > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10)
    .map(s => ({
      _id: s._id,
      name: s.name,
      categoryName: s.categoryName,
      sessions: s.sessions,
      minutes: s.minutes
    }));
  
  // Daily learning chart with breakdown
  const dailyLearning = [];
  for (let i = 0; i < Math.min(daysInPeriod, 31); i++) {
    const dayStart = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const dayLogs = await SimpleLearningLog.find({ 
      date: { $gte: dayStart, $lt: dayEnd },
      ...logFilter
    }).lean();
    const dayMinutes = dayLogs.reduce((acc, log: any) => acc + (log.duration || 0), 0);
    
    dailyLearning.push({
      date: dayStart.toISOString().split('T')[0],
      dayName: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
      sessions: dayLogs.length,
      minutes: dayMinutes
    });
  }
  
  // Weekly trend (for longer periods)
  const weeklyTrend = [];
  if (daysInPeriod > 14) {
    const weeks = Math.ceil(daysInPeriod / 7);
    for (let w = 0; w < Math.min(weeks, 12); w++) {
      const weekStart = new Date(start.getTime() + w * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const weekLogs = await SimpleLearningLog.find({
        date: { $gte: weekStart, $lt: weekEnd },
        ...logFilter
      }).lean();
      
      const weekMinutes = weekLogs.reduce((acc, log: any) => acc + (log.duration || 0), 0);
      
      weeklyTrend.push({
        week: `W${w + 1}`,
        startDate: weekStart.toISOString().split('T')[0],
        sessions: weekLogs.length,
        minutes: weekMinutes,
        hours: Math.round(weekMinutes / 60 * 10) / 10
      });
    }
  }
  
  // Recent sessions for activity log
  const recentSessions = await SimpleLearningLog.find({
    date: { $gte: start, $lt: end },
    ...logFilter
  })
    .sort({ date: -1 })
    .limit(20)
    .lean();
  
  const recentSessionsFormatted = await Promise.all(recentSessions.map(async (log: any) => {
    const skill = await LearningSkill.findById(log.skillId).lean();
    const category = log.categoryId ? await LearningCategory.findById(log.categoryId).lean() : null;
    
    return {
      _id: log._id.toString(),
      date: log.date,
      duration: log.duration,
      skillName: (skill as any)?.name || 'Unknown',
      categoryTitle: (category as any)?.title || 'Unknown',
      categoryColor: (category as any)?.color || 'violet'
    };
  }));
  
  return {
    period,
    filters: {
      areas: allCategories.map((c: any) => ({ _id: c._id.toString(), name: c.title, color: c.color })),
      skills: allSkills.map((s: any) => ({ 
        _id: s._id.toString(), 
        name: s.name, 
        areaId: s.categoryId?.toString() || '' 
      })),
      selectedArea: categoryId || null,
      selectedSkill: skillId || null
    },
    summary: {
      totalMinutes,
      prevTotalMinutes,
      minutesChange: totalMinutes - prevTotalMinutes,
      totalSessions,
      prevSessions: prevLogs.length,
      avgSessionLength: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10
    },
    byArea: byCategory.filter(c => c.sessions > 0),
    bySkill: skillsWithData.filter(s => s.sessions > 0),
    difficultyDist,
    ratingDist,
    topMediums: topSkills,
    dailyLearning,
    weeklyTrend,
    recentSessions: recentSessionsFormatted
  };
}

// ============ RECENT DASHBOARD STATS ============
export async function getDashboardStats() {
  await connectDB();
  const today = dayjs().tz(DEFAULT_TIMEZONE).startOf('day');
  
  // 1. Total Points (All Time) - INCLUDING BONUSES AND SPECIAL TASKS
  // Import the comprehensive points calculation
  const { getTotalPointsWithBonuses } = await import('./streak');
  const pointsData = await getTotalPointsWithBonuses();
  const totalPoints = pointsData.totalPoints;

  // 2. Improvement (Last 7 Days vs Previous 7 Days)
  const last7Start = today.subtract(6, 'day').toDate();
  const last7End = today.add(1, 'day').toDate();
  const prev7Start = today.subtract(13, 'day').toDate();
  const prev7End = last7Start;

  const last7PointsRes = await DailyLog.aggregate([
    { $match: { date: { $gte: last7Start, $lt: last7End }, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
  ]);
  const last7Points = last7PointsRes[0]?.total || 0;

  const prev7PointsRes = await DailyLog.aggregate([
    { $match: { date: { $gte: prev7Start, $lt: prev7End }, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
  ]);
  const prev7Points = prev7PointsRes[0]?.total || 0;

  let improvement = 0;
  if (prev7Points === 0) {
    improvement = last7Points > 0 ? 100 : 0;
  } else {
    improvement = Math.round(((last7Points - prev7Points) / prev7Points) * 100);
  }

  // 3. Weight History (Last 30 Days)
  const weightStart = today.subtract(30, 'day').toDate();
  const weightLogs = await WeightLog.find({
    date: { $gte: weightStart }
  }).sort({ date: 1 }).lean();

  const weightHistory = weightLogs.map((log: any) => ({
    date: log.date.toISOString(),
    weight: log.weight
  }));

  // 4. Exercise Heatmap (Last 365 Days)
  const heatmapStart = today.subtract(365, 'day').toDate();
  const exerciseActivity = await ExerciseLog.aggregate([
    { $match: { date: { $gte: heatmapStart } } },
    { $group: { 
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 }
      } 
    }
  ]);
  
  const heatmapData = exerciseActivity.map((item: any) => ({
    date: item._id,
    count: item.count
  }));

  return {
    totalPoints,
    improvement,
    weightHistory,
    heatmapData
  };
}
