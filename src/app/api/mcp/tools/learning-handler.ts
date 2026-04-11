/**
 * Learning Tools Handler
 * MCP tools for learning categories, skills, and logs
 */

import connectDB from '@/lib/db';
import LearningCategory from '@/models/LearningCategory';
import LearningSkill from '@/models/LearningSkill';
import SimpleLearningLog from '@/models/SimpleLearningLog';
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

// ============ GET LEARNING DATA ============
export async function getLearningData(): Promise<ToolResult> {
  await connectDB();

  const categories = await LearningCategory.find().sort({ order: 1 }).lean();
  const skills = await LearningSkill.find().sort({ order: 1 }).lean();

  // Recent logs (last 30 days)
  const thirtyDaysAgo = dayjs().subtract(30, 'day').startOf('day').toDate();
  const recentLogs = await SimpleLearningLog.find({ date: { $gte: thirtyDaysAgo } })
    .sort({ date: -1 })
    .lean();

  const skillMap = new Map(
    (skills as Record<string, unknown>[]).map((s) => [
      (s._id as { toString(): string }).toString(),
      s,
    ])
  );

  const result = (categories as Record<string, unknown>[]).map((cat) => {
    const catId = (cat._id as { toString(): string }).toString();
    const catSkills = (skills as Record<string, unknown>[]).filter(
      (s) => (s.categoryId as { toString(): string }).toString() === catId
    );
    const catLogs = (recentLogs as Record<string, unknown>[]).filter(
      (l) => (l.categoryId as { toString(): string }).toString() === catId
    );
    const totalMinutes = catLogs.reduce((s, l) => s + ((l.duration as number) || 0), 0);

    return {
      id: catId,
      title: cat.title,
      icon: cat.icon || '📚',
      color: cat.color || 'violet',
      order: cat.order,
      skills: catSkills.map((s) => ({
        id: (s._id as { toString(): string }).toString(),
        name: s.name,
        order: s.order,
        totalMinutesLast30Days: catLogs
          .filter((l) => (l.skillId as { toString(): string }).toString() === (s._id as { toString(): string }).toString())
          .reduce((sum, l) => sum + ((l.duration as number) || 0), 0),
      })),
      totalMinutesLast30Days: totalMinutes,
    };
  });

  return textResult({
    categories: result,
    recentLogs: (recentLogs as Record<string, unknown>[]).slice(0, 20).map((l) => {
      const skill = skillMap.get((l.skillId as { toString(): string }).toString());
      return {
        id: (l._id as { toString(): string }).toString(),
        date: dayjs(l.date as Date).format('YYYY-MM-DD'),
        categoryId: (l.categoryId as { toString(): string }).toString(),
        skillId: (l.skillId as { toString(): string }).toString(),
        skillName: skill ? (skill as Record<string, unknown>).name : 'Unknown',
        duration: l.duration,
      };
    }),
  });
}

// ============ LIST CATEGORIES ============
export async function listCategories(): Promise<ToolResult> {
  await connectDB();

  const categories = await LearningCategory.find().sort({ order: 1 }).lean();

  return textResult({
    categories: (categories as Record<string, unknown>[]).map((c) => ({
      id: (c._id as { toString(): string }).toString(),
      title: c.title,
      icon: c.icon || '📚',
      color: c.color || 'violet',
      order: c.order,
    })),
  });
}

// ============ CREATE CATEGORY ============
export async function createCategory(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { title, icon, color } = args;
  if (!title) return textResult({ error: 'title is required' }, true);

  const maxOrder = await LearningCategory.findOne().sort({ order: -1 }).lean();
  const order = ((maxOrder as Record<string, unknown> | null)?.order as number || 0) + 1;

  const cat = await LearningCategory.create({
    title,
    icon: (icon as string) || '📚',
    color: (color as string) || 'violet',
    order,
  });

  return textResult({
    success: true,
    message: `Category "${title}" created`,
    category: { id: cat._id.toString(), title: cat.title, icon: cat.icon, color: cat.color },
  });
}

// ============ UPDATE CATEGORY ============
export async function updateCategory(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, ...data } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v;
  }

  const cat = await LearningCategory.findByIdAndUpdate(id, clean, { new: true }).lean();
  if (!cat) return textResult({ error: 'Category not found' }, true);

  return textResult({
    success: true,
    message: `Category "${(cat as Record<string, unknown>).title}" updated`,
  });
}

// ============ DELETE CATEGORY ============
export async function deleteCategory(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const cat = await LearningCategory.findById(id).lean();
  if (!cat) return textResult({ error: 'Category not found' }, true);

  // Delete associated skills and logs
  const skillIds = (await LearningSkill.find({ categoryId: id }).lean()).map(
    (s: Record<string, unknown>) => s._id
  );
  await SimpleLearningLog.deleteMany({ categoryId: id });
  await LearningSkill.deleteMany({ categoryId: id });
  await LearningCategory.findByIdAndDelete(id);

  return textResult({
    success: true,
    message: `Category "${(cat as Record<string, unknown>).title}" deleted with ${skillIds.length} skills and their logs`,
  });
}

// ============ CREATE SKILL ============
export async function createSkill(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { categoryId, name, categoryName } = args;

  let resolvedCategoryId = categoryId as string;

  // Allow finding category by name
  if (!resolvedCategoryId && categoryName) {
    const cat = await LearningCategory.findOne({
      title: { $regex: new RegExp(`^${categoryName}$`, 'i') },
    }).lean();
    if (!cat) return textResult({ error: `Category "${categoryName}" not found` }, true);
    resolvedCategoryId = ((cat as Record<string, unknown>)._id as { toString(): string }).toString();
  }

  if (!resolvedCategoryId || !name) {
    return textResult({ error: 'categoryId (or categoryName) and name are required' }, true);
  }

  const maxOrder = await LearningSkill.findOne({ categoryId: resolvedCategoryId }).sort({ order: -1 }).lean();
  const order = ((maxOrder as Record<string, unknown> | null)?.order as number || 0) + 1;

  const skill = await LearningSkill.create({
    categoryId: resolvedCategoryId,
    name,
    order,
  });

  return textResult({
    success: true,
    message: `Skill "${name}" created`,
    skill: { id: skill._id.toString(), name: skill.name, categoryId: resolvedCategoryId },
  });
}

// ============ UPDATE SKILL ============
export async function updateSkill(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, ...data } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v;
  }

  const skill = await LearningSkill.findByIdAndUpdate(id, clean, { new: true }).lean();
  if (!skill) return textResult({ error: 'Skill not found' }, true);

  return textResult({
    success: true,
    message: `Skill "${(skill as Record<string, unknown>).name}" updated`,
  });
}

// ============ DELETE SKILL ============
export async function deleteSkill(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const skill = await LearningSkill.findById(id).lean();
  if (!skill) return textResult({ error: 'Skill not found' }, true);

  await SimpleLearningLog.deleteMany({ skillId: id });
  await LearningSkill.findByIdAndDelete(id);

  return textResult({
    success: true,
    message: `Skill "${(skill as Record<string, unknown>).name}" deleted with all its logs`,
  });
}

// ============ LOG LEARNING ============
export async function logLearning(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { skillId, skillName, categoryName, duration, date } = args;

  let resolvedSkillId = skillId as string;
  let resolvedCategoryId: string | undefined;

  // Allow finding skill by name (optionally scoped by category)
  if (!resolvedSkillId && skillName) {
    const query: Record<string, unknown> = { name: { $regex: new RegExp(`^${skillName}$`, 'i') } };
    if (categoryName) {
      const cat = await LearningCategory.findOne({
        title: { $regex: new RegExp(`^${categoryName}$`, 'i') },
      }).lean();
      if (cat) query.categoryId = (cat as Record<string, unknown>)._id;
    }
    const skill = await LearningSkill.findOne(query).lean();
    if (!skill) return textResult({ error: `Skill "${skillName}" not found` }, true);
    resolvedSkillId = ((skill as Record<string, unknown>)._id as { toString(): string }).toString();
    resolvedCategoryId = ((skill as Record<string, unknown>).categoryId as { toString(): string }).toString();
  }

  if (!resolvedSkillId || !duration) {
    return textResult({ error: 'skillId (or skillName) and duration (in minutes) are required' }, true);
  }

  // Look up category from skill if not resolved
  if (!resolvedCategoryId) {
    const skill = await LearningSkill.findById(resolvedSkillId).lean();
    if (!skill) return textResult({ error: 'Skill not found' }, true);
    resolvedCategoryId = ((skill as Record<string, unknown>).categoryId as { toString(): string }).toString();
  }

  const dateStr = (date as string) || getTodayDateString();
  const targetDate = parseToISTMidnight(dateStr);

  const log = await SimpleLearningLog.create({
    categoryId: resolvedCategoryId,
    skillId: resolvedSkillId,
    date: targetDate,
    duration: duration as number,
  });

  return textResult({
    success: true,
    message: `Logged ${duration} minutes of learning on ${dateStr}`,
    log: { id: log._id.toString(), duration: log.duration, date: dateStr },
  });
}

// ============ UPDATE LEARNING LOG ============
export async function updateLearningLog(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id, duration } = args;
  if (!id) return textResult({ error: 'id is required' }, true);
  if (duration === undefined) return textResult({ error: 'duration is required' }, true);

  const log = await SimpleLearningLog.findByIdAndUpdate(id, { duration }, { new: true }).lean();
  if (!log) return textResult({ error: 'Log not found' }, true);

  return textResult({
    success: true,
    message: `Learning log updated to ${duration} minutes`,
  });
}

// ============ DELETE LEARNING LOG ============
export async function deleteLearningLog(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const { id } = args;
  if (!id) return textResult({ error: 'id is required' }, true);

  const log = await SimpleLearningLog.findById(id).lean();
  if (!log) return textResult({ error: 'Log not found' }, true);

  await SimpleLearningLog.findByIdAndDelete(id);

  return textResult({
    success: true,
    message: `Learning log deleted (${(log as Record<string, unknown>).duration} minutes)`,
  });
}

// ============ GET LEARNING STATS ============
export async function getLearningStats(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();

  const days = (args.days as number) || 30;
  const since = dayjs().subtract(days, 'day').startOf('day').toDate();

  const logs = await SimpleLearningLog.find({ date: { $gte: since } }).lean();
  const categories = await LearningCategory.find().lean();
  const skills = await LearningSkill.find().lean();

  const catMap = new Map(
    (categories as Record<string, unknown>[]).map((c) => [
      (c._id as { toString(): string }).toString(),
      (c as Record<string, unknown>).title as string,
    ])
  );
  const skillMap = new Map(
    (skills as Record<string, unknown>[]).map((s) => [
      (s._id as { toString(): string }).toString(),
      (s as Record<string, unknown>).name as string,
    ])
  );

  const totalMinutes = (logs as Record<string, unknown>[]).reduce(
    (s, l) => s + ((l.duration as number) || 0),
    0
  );
  const uniqueDays = new Set(
    (logs as Record<string, unknown>[]).map((l) => dayjs(l.date as Date).format('YYYY-MM-DD'))
  ).size;

  // Per-category breakdown
  const byCat: Record<string, number> = {};
  const bySkill: Record<string, number> = {};
  for (const l of logs as Record<string, unknown>[]) {
    const catId = (l.categoryId as { toString(): string }).toString();
    const skillId = (l.skillId as { toString(): string }).toString();
    byCat[catId] = (byCat[catId] || 0) + ((l.duration as number) || 0);
    bySkill[skillId] = (bySkill[skillId] || 0) + ((l.duration as number) || 0);
  }

  return textResult({
    period: `Last ${days} days`,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    activeDays: uniqueDays,
    averageMinutesPerDay: uniqueDays > 0 ? Number((totalMinutes / uniqueDays).toFixed(1)) : 0,
    byCategory: Object.entries(byCat)
      .map(([id, mins]) => ({
        category: catMap.get(id) || 'Unknown',
        minutes: mins,
        hours: Number((mins / 60).toFixed(1)),
      }))
      .sort((a, b) => b.minutes - a.minutes),
    topSkills: Object.entries(bySkill)
      .map(([id, mins]) => ({
        skill: skillMap.get(id) || 'Unknown',
        minutes: mins,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10),
  });
}
