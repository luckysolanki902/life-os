/**
 * RxDB Schemas - Define all collection schemas matching MongoDB models
 * Each schema uses the MongoDB _id as primary key for seamless sync
 */

import type { RxJsonSchema } from 'rxdb';

// ============================================
// Routine Domain
// ============================================

export const taskSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    domainId: { type: 'string', maxLength: 50 },
    order: { type: 'number' },
    isScheduled: { type: 'boolean' },
    startTime: { type: ['string', 'null'] },
    endTime: { type: ['string', 'null'] },
    notificationsEnabled: { type: 'boolean' },
    timeOfDay: { type: ['string', 'null'] },
    basePoints: { type: 'number' },
    isActive: { type: 'boolean' },
    mustDo: { type: 'boolean' },
    recurrenceType: { type: 'string' },
    recurrenceDays: { type: 'array', items: { type: 'number' } },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'title', 'domainId'],
  indexes: ['domainId', 'isActive', 'updatedAt'],
};

export const dailyLogSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    taskId: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    completedAt: { type: ['string', 'null'] },
    skippedAt: { type: ['string', 'null'] },
    status: { type: 'string', maxLength: 50 },
    pointsEarned: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'taskId', 'date'],
  indexes: ['taskId', 'date', 'status', 'updatedAt', ['taskId', 'date']],
};

export const dailyStreakRecordSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    routineTasksCompleted: { type: 'number' },
    hasExerciseLog: { type: 'boolean' },
    streakValid: { type: 'boolean' },
    bonusPointsAwarded: { type: 'number' },
    milestonesReached: { type: 'array', items: { type: 'number' } },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'date'],
  indexes: ['date', 'streakValid', 'updatedAt'],
};

// ============================================
// Health Domain
// ============================================

export const weightLogSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    weight: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'date', 'weight'],
  indexes: ['date', 'updatedAt'],
};

export const healthPageSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    description: { type: ['string', 'null'] },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'title'],
  indexes: ['updatedAt'],
};

export const exerciseDefinitionSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    pageId: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    type: { type: 'string' },
    targetMuscles: { type: 'array', items: { type: 'string' } },
    order: { type: 'number' },
    initialSets: { type: ['number', 'null'] },
    initialReps: { type: ['number', 'null'] },
    recommendedWeight: { type: ['number', 'null'] },
    tutorials: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'pageId', 'title'],
  indexes: ['pageId', 'updatedAt'],
};

export const exerciseLogSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    exerciseId: { type: 'string', maxLength: 100 },
    sets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          reps: { type: 'number' },
          weight: { type: 'number' },
          duration: { type: 'number' },
        },
      },
    },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'date', 'exerciseId'],
  indexes: ['date', 'exerciseId', 'updatedAt', ['date', 'exerciseId']],
};

export const moodLogSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    mood: { type: 'string' },
    note: { type: ['string', 'null'] },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'date', 'mood'],
  indexes: ['date', 'updatedAt'],
};

// ============================================
// Books Domain
// ============================================

export const bookSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    domainId: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    author: { type: ['string', 'null'] },
    category: { type: 'string' },
    subcategory: { type: ['string', 'null'] },
    status: { type: 'string', maxLength: 50 },
    startedOn: { type: ['string', 'null'] },
    finishedOn: { type: ['string', 'null'] },
    startDate: { type: ['string', 'null'] },
    completedDate: { type: ['string', 'null'] },
    lastReadDate: { type: ['string', 'null'], maxLength: 50 },
    totalPages: { type: ['number', 'null'] },
    currentPage: { type: 'number' },
    notes: { type: ['string', 'null'] },
    rating: { type: ['number', 'null'] },
    order: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'title', 'domainId', 'category', 'status'],
  indexes: ['status', 'domainId', 'lastReadDate', 'updatedAt'],
};

export const bookDomainSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    color: { type: ['string', 'null'] },
    icon: { type: ['string', 'null'] },
    order: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'name'],
  indexes: ['order', 'updatedAt'],
};

export const bookLogSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    bookId: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    currentPage: { type: 'number' },
    pagesRead: { type: 'number' },
    notes: { type: ['string', 'null'] },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'bookId', 'date'],
  indexes: ['bookId', 'date', 'updatedAt'],
};

// ============================================
// Learning Domain
// ============================================

export const learningCategorySchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string' },
    icon: { type: ['string', 'null'] },
    color: { type: ['string', 'null'] },
    order: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'title'],
  indexes: ['order', 'updatedAt'],
};

export const learningSkillSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    categoryId: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    order: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'categoryId', 'name'],
  indexes: ['categoryId', 'updatedAt'],
};

export const simpleLearningLogSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    categoryId: { type: 'string', maxLength: 100 },
    skillId: { type: 'string', maxLength: 100 },
    date: { type: 'string', maxLength: 50 },
    duration: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id', 'categoryId', 'skillId', 'date', 'duration'],
  indexes: ['categoryId', 'skillId', 'date', 'updatedAt'],
};

// ============================================
// User
// ============================================

export const userSchema: RxJsonSchema<any> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    username: { type: 'string' },
    email: { type: 'string' },
    pushToken: { type: ['string', 'null'] },
    notificationsEnabled: { type: 'boolean' },
    profile: {
      type: 'object',
      properties: {
        height: { type: 'number' },
        dob: { type: 'string' },
        startWeight: { type: 'number' },
        goalWeight: { type: 'number' },
      },
    },
    totalPoints: { type: 'number' },
    pointsBreakdown: {
      type: 'object',
      properties: {
        health: { type: 'number' },
        career: { type: 'number' },
        learning: { type: 'number' },
        startups: { type: 'number' },
        social: { type: 'number' },
      },
    },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
    _deleted: { type: 'boolean' },
  },
  required: ['id'],
  indexes: ['updatedAt'],
};

// ============================================
// Collection config map
// ============================================

export const COLLECTION_NAMES = {
  TASKS: 'tasks',
  DAILY_LOGS: 'daily_logs',
  DAILY_STREAK_RECORDS: 'daily_streak_records',
  WEIGHT_LOGS: 'weight_logs',
  HEALTH_PAGES: 'health_pages',
  EXERCISE_DEFINITIONS: 'exercise_definitions',
  EXERCISE_LOGS: 'exercise_logs',
  MOOD_LOGS: 'mood_logs',
  BOOKS: 'books',
  BOOK_DOMAINS: 'book_domains',
  BOOK_LOGS: 'book_logs',
  LEARNING_CATEGORIES: 'learning_categories',
  LEARNING_SKILLS: 'learning_skills',
  SIMPLE_LEARNING_LOGS: 'simple_learning_logs',
  USERS: 'users',
} as const;

export type CollectionName = typeof COLLECTION_NAMES[keyof typeof COLLECTION_NAMES];

export const collectionSchemas: Record<string, RxJsonSchema<any>> = {
  [COLLECTION_NAMES.TASKS]: taskSchema,
  [COLLECTION_NAMES.DAILY_LOGS]: dailyLogSchema,
  [COLLECTION_NAMES.DAILY_STREAK_RECORDS]: dailyStreakRecordSchema,
  [COLLECTION_NAMES.WEIGHT_LOGS]: weightLogSchema,
  [COLLECTION_NAMES.HEALTH_PAGES]: healthPageSchema,
  [COLLECTION_NAMES.EXERCISE_DEFINITIONS]: exerciseDefinitionSchema,
  [COLLECTION_NAMES.EXERCISE_LOGS]: exerciseLogSchema,
  [COLLECTION_NAMES.MOOD_LOGS]: moodLogSchema,
  [COLLECTION_NAMES.BOOKS]: bookSchema,
  [COLLECTION_NAMES.BOOK_DOMAINS]: bookDomainSchema,
  [COLLECTION_NAMES.BOOK_LOGS]: bookLogSchema,
  [COLLECTION_NAMES.LEARNING_CATEGORIES]: learningCategorySchema,
  [COLLECTION_NAMES.LEARNING_SKILLS]: learningSkillSchema,
  [COLLECTION_NAMES.SIMPLE_LEARNING_LOGS]: simpleLearningLogSchema,
  [COLLECTION_NAMES.USERS]: userSchema,
};

// Map collection names to their MongoDB model names (for the server)
export const COLLECTION_TO_MODEL: Record<string, string> = {
  [COLLECTION_NAMES.TASKS]: 'RoutineTask',
  [COLLECTION_NAMES.DAILY_LOGS]: 'DailyLog',
  [COLLECTION_NAMES.DAILY_STREAK_RECORDS]: 'DailyStreakRecord',
  [COLLECTION_NAMES.WEIGHT_LOGS]: 'WeightLog',
  [COLLECTION_NAMES.HEALTH_PAGES]: 'HealthPage',
  [COLLECTION_NAMES.EXERCISE_DEFINITIONS]: 'ExerciseDefinition',
  [COLLECTION_NAMES.EXERCISE_LOGS]: 'ExerciseLog',
  [COLLECTION_NAMES.MOOD_LOGS]: 'MoodLog',
  [COLLECTION_NAMES.BOOKS]: 'Book',
  [COLLECTION_NAMES.BOOK_DOMAINS]: 'BookDomain',
  [COLLECTION_NAMES.BOOK_LOGS]: 'BookLog',
  [COLLECTION_NAMES.LEARNING_CATEGORIES]: 'LearningCategory',
  [COLLECTION_NAMES.LEARNING_SKILLS]: 'LearningSkill',
  [COLLECTION_NAMES.SIMPLE_LEARNING_LOGS]: 'SimpleLearningLog',
  [COLLECTION_NAMES.USERS]: 'User',
};
