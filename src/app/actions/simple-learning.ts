'use server';

import connectDB from '@/lib/db';
import LearningCategory from '@/models/LearningCategory';
import LearningSkill from '@/models/LearningSkill';
import SimpleLearningLog from '@/models/SimpleLearningLog';
import { revalidatePath } from 'next/cache';
import {
  parseToISTMidnight,
  getTodayISTMidnight,
  getTodayDateString,
  getDateRange,
  dayjs
} from '@/lib/server-date-utils';

interface CategoryDoc {
  _id: { toString(): string };
  title: string;
  icon?: string;
  color?: string;
  order?: number;
}

interface SkillDoc {
  _id: { toString(): string };
  categoryId: { toString(): string };
  name: string;
  order?: number;
}

interface LogDoc {
  _id: { toString(): string };
  categoryId: { toString(): string };
  skillId: { toString(): string };
  date: Date;
  duration: number;
}

// ============ DASHBOARD DATA ============
export async function getSimpleLearningData() {
  await connectDB();

  // Get all categories
  const categories = await LearningCategory.find().sort({ order: 1, createdAt: 1 }).lean();

  const categoriesData = categories.map((cat: CategoryDoc) => ({
    _id: cat._id.toString(),
    title: cat.title,
    icon: cat.icon || '📚',
    color: cat.color || 'violet',
  }));

  // Get all skills with category info
  const skills = await LearningSkill.find().sort({ order: 1, createdAt: 1 }).lean();
  const skillsWithCategory = (await Promise.all(skills.map(async (skill: SkillDoc) => {
    if (!skill.categoryId) return null;
    const category = await LearningCategory.findById(skill.categoryId).lean();
    return {
      _id: skill._id.toString(),
      name: skill.name,
      categoryId: skill.categoryId.toString(),
      categoryTitle: (category as CategoryDoc)?.title || 'Unknown',
      categoryIcon: (category as CategoryDoc)?.icon || '📚',
      categoryColor: (category as CategoryDoc)?.color || 'violet',
    };
  })).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null)));

  // Get today's logs
  const { startOfDay, endOfDay } = getDateRange(getTodayDateString());
  const todaysLogs = await SimpleLearningLog.find({
    date: { $gte: startOfDay, $lt: endOfDay }
  }).sort({ createdAt: -1 }).lean();

  const todaysLogsData = (await Promise.all(todaysLogs.map(async (log: LogDoc) => {
    if (!log.categoryId || !log.skillId) return null;
    const category = await LearningCategory.findById(log.categoryId).lean();
    const skill = await LearningSkill.findById(log.skillId).lean();
    return {
      _id: log._id.toString(),
      categoryId: log.categoryId.toString(),
      skillId: log.skillId.toString(),
      categoryTitle: (category as CategoryDoc)?.title || 'Unknown',
      categoryIcon: (category as CategoryDoc)?.icon || '📚',
      categoryColor: (category as CategoryDoc)?.color || 'violet',
      skillName: (skill as SkillDoc)?.name || 'Unknown',
      duration: log.duration,
      date: log.date,
    };
  })).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null)));

  // Get recent logs (last 7 days)
  const weekAgo = dayjs().tz('Asia/Kolkata').subtract(7, 'day').startOf('day').toDate();
  const recentLogs = await SimpleLearningLog.find({
    date: { $gte: weekAgo }
  }).sort({ date: -1 }).lean();

  const recentLogsData = (await Promise.all(recentLogs.map(async (log: LogDoc) => {
    if (!log.categoryId || !log.skillId) return null;
    const category = await LearningCategory.findById(log.categoryId).lean();
    const skill = await LearningSkill.findById(log.skillId).lean();
    return {
      _id: log._id.toString(),
      categoryId: log.categoryId.toString(),
      skillId: log.skillId.toString(),
      categoryTitle: (category as CategoryDoc)?.title || 'Unknown',
      categoryIcon: (category as CategoryDoc)?.icon || '📚',
      categoryColor: (category as CategoryDoc)?.color || 'violet',
      skillName: (skill as SkillDoc)?.name || 'Unknown',
      duration: log.duration,
      date: log.date,
    };
  })).then(results => results.filter((r): r is NonNullable<typeof r> => r !== null)));

  // Get skill stats with their total time
  const skillStats = await SimpleLearningLog.aggregate([
    {
      $group: {
        _id: { skillId: '$skillId', categoryId: '$categoryId' },
        totalMinutes: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
        lastPracticed: { $max: '$date' }
      }
    },
    { $sort: { lastPracticed: -1 } }
  ]);

  const skillStatsData = await Promise.all(skillStats.map(async (stat: { _id: { skillId: string; categoryId: string }; totalMinutes: number; sessionCount: number; lastPracticed: Date }) => {
    const category = await LearningCategory.findById(stat._id.categoryId).lean();
    const skill = await LearningSkill.findById(stat._id.skillId).lean();
    return {
      skillId: stat._id.skillId.toString(),
      skillName: (skill as SkillDoc)?.name || 'Unknown',
      categoryId: stat._id.categoryId.toString(),
      categoryTitle: (category as CategoryDoc)?.title || 'Unknown',
      categoryIcon: (category as CategoryDoc)?.icon || '📚',
      categoryColor: (category as CategoryDoc)?.color || 'violet',
      totalMinutes: stat.totalMinutes,
      sessionCount: stat.sessionCount,
      lastPracticed: stat.lastPracticed,
    };
  }));

  // Today's total minutes
  const todaysTotalMinutes = todaysLogsData.reduce((acc, log) => acc + log.duration, 0);

  // This week's total minutes
  const weeklyTotalMinutes = recentLogsData.reduce((acc, log) => acc + log.duration, 0);

  return {
    categories: categoriesData,
    skills: skillsWithCategory,
    skillStats: skillStatsData,
    todaysLogs: todaysLogsData,
    recentLogs: recentLogsData,
    todaysTotalMinutes,
    weeklyTotalMinutes,
  };
}

// ============ CATEGORY CRUD ============
export async function createCategory(data: { title: string; icon?: string; color?: string }) {
  await connectDB();
  const maxOrder = await LearningCategory.findOne().sort({ order: -1 }).lean();
  await LearningCategory.create({ 
    ...data, 
    order: ((maxOrder as CategoryDoc | null)?.order || 0) + 1 
  });
  revalidatePath('/learning');
  revalidatePath('/');
  return { success: true };
}

export async function updateCategory(categoryId: string, data: { title?: string; icon?: string; color?: string }) {
  await connectDB();
  await LearningCategory.findByIdAndUpdate(categoryId, data);
  revalidatePath('/learning');
  return { success: true };
}

export async function deleteCategory(categoryId: string) {
  await connectDB();
  // Delete all logs for this category
  await SimpleLearningLog.deleteMany({ categoryId });
  await LearningCategory.findByIdAndDelete(categoryId);
  revalidatePath('/learning');
  revalidatePath('/');
  return { success: true };
}

// ============ SKILL CRUD ============
export async function createSkill(data: {
  categoryId: string;
  name: string;
}) {
  await connectDB();
  
  const maxOrder = await LearningSkill.findOne({ categoryId: data.categoryId })
    .sort({ order: -1 })
    .select('order')
    .lean();
  
  const skill = await LearningSkill.create({
    categoryId: data.categoryId,
    name: data.name.trim(),
    order: maxOrder ? (maxOrder as { order?: number }).order! + 1 : 0,
  });
  
  revalidatePath('/learning');
  revalidatePath('/');
  return { success: true, skillId: skill._id.toString() };
}

export async function updateSkill(skillId: string, data: {
  name?: string;
  categoryId?: string;
}) {
  await connectDB();
  await LearningSkill.findByIdAndUpdate(skillId, data);
  revalidatePath('/learning');
  revalidatePath('/');
  return { success: true };
}

export async function deleteSkill(skillId: string) {
  await connectDB();
  // Delete all logs for this skill
  await SimpleLearningLog.deleteMany({ skillId });
  await LearningSkill.findByIdAndDelete(skillId);
  revalidatePath('/learning');
  revalidatePath('/');
  return { success: true };
}

// ============ LOG CRUD ============
export async function addLearningLog(data: {
  skillId: string;
  duration: number;
  date?: string;
}) {
  await connectDB();
  
  // Get skill to find categoryId
  const skill = await LearningSkill.findById(data.skillId).lean();
  if (!skill) {
    return { success: false, error: 'Skill not found' };
  }
  
  const logDate = data.date ? parseToISTMidnight(data.date) : getTodayISTMidnight();
  
  await SimpleLearningLog.create({
    categoryId: (skill as SkillDoc).categoryId,
    skillId: data.skillId,
    date: logDate,
    duration: data.duration,
  });
  
  revalidatePath('/learning');
  revalidatePath('/');
  revalidatePath('/routine');
  return { success: true };
}

export async function updateLearningLog(logId: string, data: { duration?: number; skillId?: string }) {
  await connectDB();
  
  const updateData: { duration?: number; skillId?: string; categoryId?: string } = {};
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.skillId) {
    updateData.skillId = data.skillId;
    // Also update categoryId based on skill
    const skill = await LearningSkill.findById(data.skillId).lean();
    if (skill) {
      updateData.categoryId = (skill as SkillDoc).categoryId.toString();
    }
  }
  
  await SimpleLearningLog.findByIdAndUpdate(logId, updateData);
  revalidatePath('/learning');
  revalidatePath('/');
  return { success: true };
}

export async function deleteLearningLog(logId: string) {
  await connectDB();
  await SimpleLearningLog.findByIdAndDelete(logId);
  revalidatePath('/learning');
  revalidatePath('/');
  revalidatePath('/routine');
  return { success: true };
}

// ============ QUICK LOG (for fast +1 minute logging) ============
export async function quickLearningLog(skillId: string, duration: number = 1) {
  await connectDB();
  
  // Get skill to find categoryId
  const skill = await LearningSkill.findById(skillId).lean();
  if (!skill) {
    return { success: false, error: 'Skill not found' };
  }
  
  const today = getTodayISTMidnight();
  const { startOfDay, endOfDay } = getDateRange(getTodayDateString());
  
  // Check if there's already a log for this skill today
  const existingLog = await SimpleLearningLog.findOne({
    skillId,
    date: { $gte: startOfDay, $lt: endOfDay }
  });
  
  if (existingLog) {
    // Add to existing log
    await SimpleLearningLog.findByIdAndUpdate(existingLog._id, {
      $inc: { duration }
    });
  } else {
    // Create new log
    await SimpleLearningLog.create({
      categoryId: (skill as SkillDoc).categoryId,
      skillId,
      date: today,
      duration,
    });
  }
  
  revalidatePath('/learning');
  revalidatePath('/');
  revalidatePath('/routine');
  return { success: true };
}

// ============ STATS ============
export async function getLearningStats(days: number = 30) {
  await connectDB();
  
  const startDate = dayjs().tz('Asia/Kolkata').subtract(days, 'day').startOf('day').toDate();
  
  // Daily totals
  const dailyStats = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'Asia/Kolkata' } },
        totalMinutes: { $sum: '$duration' },
        sessionCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Skill breakdown
  const skillBreakdown = await SimpleLearningLog.aggregate([
    { $match: { date: { $gte: startDate } } },
    {
      $group: {
        _id: '$skillId',
        totalMinutes: { $sum: '$duration' },
        sessionCount: { $sum: 1 }
      }
    },
    { $sort: { totalMinutes: -1 } }
  ]);

  // Enrich skill breakdown with skill names and category icons
  const enrichedSkillBreakdown = await Promise.all(skillBreakdown.map(async (item: { _id: string; totalMinutes: number; sessionCount: number }) => {
    const skill = await LearningSkill.findById(item._id).lean() as SkillDoc | null;
    let categoryIcon = '📚';
    if (skill?.categoryId) {
      const category = await LearningCategory.findById(skill.categoryId).lean() as CategoryDoc | null;
      categoryIcon = category?.icon || '📚';
    }
    return {
      skillId: item._id.toString(),
      skillName: skill?.name || 'Unknown',
      categoryIcon,
      totalMinutes: item.totalMinutes,
      sessionCount: item.sessionCount,
    };
  }));
  
  return {
    dailyStats,
    skillBreakdown: enrichedSkillBreakdown,
  };
}

// ============ GET ALL SKILLS ============
export async function getAllSkills() {
  await connectDB();
  
  const skills = await LearningSkill.find().sort({ order: 1 }).lean();
  const skillsWithCategory = await Promise.all(skills.map(async (skill: SkillDoc) => {
    const category = await LearningCategory.findById(skill.categoryId).lean();
    return {
      _id: skill._id.toString(),
      name: skill.name,
      categoryId: skill.categoryId.toString(),
      categoryTitle: (category as CategoryDoc)?.title || 'Unknown',
      categoryIcon: (category as CategoryDoc)?.icon || '📚',
      categoryColor: (category as CategoryDoc)?.color || 'violet',
    };
  }));
  
  return skillsWithCategory;
}

// Get today's learning logs
export async function getTodaysLearningLogs() {
  await connectDB();
  
  const { startOfDay, endOfDay } = getDateRange(getTodayDateString());
  const logs = await SimpleLearningLog.find({
    date: { $gte: startOfDay, $lt: endOfDay }
  }).lean();
  
  // Group by skill
  const skillMap = new Map<string, number>();
  for (const log of logs) {
    const skillId = (log as LogDoc).skillId.toString();
    const current = skillMap.get(skillId) || 0;
    skillMap.set(skillId, current + (log as LogDoc).duration);
  }
  
  // Get skill names
  const result = await Promise.all(Array.from(skillMap.entries()).map(async ([skillId, duration]) => {
    const skill = await LearningSkill.findById(skillId).lean() as SkillDoc | null;
    return {
      skillId,
      skillName: skill?.name || 'Unknown',
      duration,
    };
  }));
  
  return result;
}
