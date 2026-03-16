/**
 * RxDB React Hooks - Reactive data access for components
 * 
 * These hooks subscribe to RxDB observables and automatically
 * re-render when data changes (local writes or sync from server).
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RxCollection, RxDocument, MangoQuery } from 'rxdb';
import { getDatabase, type LifeOsDatabase, COLLECTION_NAMES, type LifeOsCollections } from './database';
import type { CollectionName } from './schemas';
import { generateId, nowISO } from './utils';

/**
 * Hook to get the RxDB database instance
 */
export function useRxDB(): LifeOsDatabase | null {
  const [db, setDb] = useState<LifeOsDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDatabase().then((database) => {
      if (!cancelled) setDb(database);
    });
    return () => { cancelled = true; };
  }, []);

  return db;
}

/**
 * Hook to get a specific collection
 */
export function useRxCollection(name: CollectionName): RxCollection | null {
  const db = useRxDB();
  return db ? db[name] : null;
}

/**
 * Generic hook to query RxDB documents reactively.
 * Re-renders whenever the query results change.
 */
export function useRxQuery<T = any>(
  collectionName: CollectionName,
  queryObj?: MangoQuery<T> | null,
): { data: T[]; isLoading: boolean } {
  const db = useRxDB();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const queryKey = JSON.stringify(queryObj);

  useEffect(() => {
    if (!db) return;

    const collection = db[collectionName];
    if (!collection) {
      setIsLoading(false);
      return;
    }

    const query = queryObj
      ? collection.find(queryObj)
      : collection.find();

    const sub = query.$.subscribe((results: RxDocument[]) => {
      setData(results.map((doc) => doc.toJSON() as T));
      setIsLoading(false);
    });

    return () => sub.unsubscribe();
  }, [db, collectionName, queryKey]);

  return { data, isLoading };
}

/**
 * Hook to get a single document by ID, reactively
 */
export function useRxDocument<T = any>(
  collectionName: CollectionName,
  id: string | null | undefined,
): { data: T | null; isLoading: boolean } {
  const db = useRxDB();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !id) {
      setIsLoading(false);
      return;
    }

    const collection = db[collectionName];
    if (!collection) {
      setIsLoading(false);
      return;
    }

    const sub = collection.findOne(id).$.subscribe((doc: RxDocument | null) => {
      setData(doc ? (doc.toJSON() as T) : null);
      setIsLoading(false);
    });

    return () => sub.unsubscribe();
  }, [db, collectionName, id]);

  return { data, isLoading };
}

/**
 * Hook for CRUD operations on a collection.
 * Returns methods to insert, update, upsert, and remove documents.
 */
export function useRxMutation(collectionName: CollectionName) {
  const db = useRxDB();

  const insert = useCallback(async (data: any) => {
    if (!db) throw new Error('Database not ready');
    const collection = db[collectionName];
    const now = nowISO();
    const doc = {
      id: data.id || generateId(),
      ...data,
      createdAt: data.createdAt || now,
      updatedAt: now,
      _deleted: false,
    };
    return collection.insert(doc);
  }, [db, collectionName]);

  const upsert = useCallback(async (data: any) => {
    if (!db) throw new Error('Database not ready');
    const collection = db[collectionName];
    const now = nowISO();
    const doc = {
      ...data,
      id: data.id || generateId(),
      updatedAt: now,
      _deleted: false,
    };
    return collection.upsert(doc);
  }, [db, collectionName]);

  const update = useCallback(async (id: string, patch: Record<string, any>) => {
    if (!db) throw new Error('Database not ready');
    const collection = db[collectionName];
    const doc = await collection.findOne(id).exec();
    if (!doc) throw new Error(`Document ${id} not found in ${collectionName}`);
    return doc.patch({
      ...patch,
      updatedAt: nowISO(),
    });
  }, [db, collectionName]);

  const remove = useCallback(async (id: string) => {
    if (!db) throw new Error('Database not ready');
    const collection = db[collectionName];
    const doc = await collection.findOne(id).exec();
    if (!doc) return;
    return doc.remove();
  }, [db, collectionName]);

  const bulkInsert = useCallback(async (docs: any[]) => {
    if (!db) throw new Error('Database not ready');
    const collection = db[collectionName];
    const now = nowISO();
    const prepared = docs.map(d => ({
      id: d.id || generateId(),
      ...d,
      createdAt: d.createdAt || now,
      updatedAt: now,
      _deleted: false,
    }));
    return collection.bulkInsert(prepared);
  }, [db, collectionName]);

  const bulkUpsert = useCallback(async (docs: any[]) => {
    if (!db) throw new Error('Database not ready');
    const collection = db[collectionName];
    const now = nowISO();
    const prepared = docs.map(d => ({
      ...d,
      id: d.id || generateId(),
      updatedAt: now,
      _deleted: false,
    }));
    return collection.bulkUpsert(prepared);
  }, [db, collectionName]);

  return { insert, upsert, update, remove, bulkInsert, bulkUpsert };
}

/**
 * Convenience hook for home page data - aggregates multiple collections
 */
export function useHomeData() {
  const db = useRxDB();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) return;

    // Subscribe to tasks and daily logs
    const tasksCollection = db[COLLECTION_NAMES.TASKS];
    const logsCollection = db[COLLECTION_NAMES.DAILY_LOGS];
    const weightCollection = db[COLLECTION_NAMES.WEIGHT_LOGS];
    const streakCollection = db[COLLECTION_NAMES.DAILY_STREAK_RECORDS];

    if (!tasksCollection || !logsCollection) {
      setIsLoading(false);
      return;
    }

    // Combine multiple observables
    const tasksSub = tasksCollection
      .find({ selector: { isActive: true } })
      .$.subscribe(async () => {
        // When tasks or any dependent data changes, recompute home data
        await computeHomeData(db, setData);
        setIsLoading(false);
      });

    const logsSub = logsCollection.find().$.subscribe(async () => {
      await computeHomeData(db, setData);
    });

    const weightSub = weightCollection?.find().$.subscribe(async () => {
      await computeHomeData(db, setData);
    });

    const streakSub = streakCollection?.find().$.subscribe(async () => {
      await computeHomeData(db, setData);
    });

    return () => {
      tasksSub.unsubscribe();
      logsSub.unsubscribe();
      weightSub?.unsubscribe();
      streakSub?.unsubscribe();
    };
  }, [db]);

  return { data, isLoading };
}

/**
 * Compute aggregated home data from local RxDB collections.
 * This runs locally - no server call needed.
 */
async function computeHomeData(
  db: LifeOsDatabase,
  setData: (data: any) => void
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const todayDate = todayISO.split('T')[0]; // YYYY-MM-DD

  // Get active tasks
  const tasks = await db[COLLECTION_NAMES.TASKS]
    .find({ selector: { isActive: true } })
    .exec();

  // Get today's logs
  const logs = await db[COLLECTION_NAMES.DAILY_LOGS]
    .find({
      selector: {
        date: { $gte: todayISO, $lt: new Date(today.getTime() + 86400000).toISOString() },
      },
    })
    .exec();

  // Get today's weight
  const weightLogs = await db[COLLECTION_NAMES.WEIGHT_LOGS]
    .find({
      selector: { date: { $gte: todayISO } },
      sort: [{ date: 'desc' }],
      limit: 1,
    })
    .exec();

  // Build log map
  const logMap = new Map<string, any>();
  for (const log of logs) {
    const logData = log.toJSON();
    logMap.set(logData.taskId, logData);
  }

  // Build task list with logs
  const incompleteTasks = tasks.map((task) => {
    const taskData = task.toJSON();
    const log = logMap.get(taskData.id);
    return {
      _id: taskData.id,
      ...taskData,
      log: log || undefined,
      status: log?.status || 'pending',
      points: taskData.basePoints || 1,
    };
  });

  const todaysWeight = weightLogs.length > 0 ? weightLogs[0].toJSON() : null;

  setData({
    incompleteTasks,
    domains: [],
    todaysWeight: todaysWeight ? { weight: todaysWeight.weight, date: todaysWeight.date } : null,
    streakData: { currentStreak: 0, last7Days: [], todayValid: false, todayRoutineTasks: 0, todayCanBeRestDay: false, todayIsRestDay: false },
    specialTasks: [],
    totalPoints: 0,
    last7DaysCompletion: [],
  });
}
