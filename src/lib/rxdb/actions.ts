/**
 * RxDB Action Wrapper - Wraps server actions with local RxDB writes
 * 
 * Pattern:
 * 1. Write to local RxDB (instant UI update)
 * 2. Run server action in background
 * 3. RxDB replication syncs the change to server & other devices
 * 
 * No more polling, no more glitches. Pure reactive local-first.
 */

'use client';

import { getDatabase, COLLECTION_NAMES } from './database';
import type { CollectionName } from './schemas';
import { generateId, nowISO } from './utils';
import { forceSyncCollection } from './replication';

/**
 * Execute a server action with local-first RxDB support.
 * 
 * 1. Runs optimistic update on local RxDB (instant)
 * 2. Fires server action (background)
 * 3. Replication handles the rest
 */
export async function withRxDB<T>(
  action: () => Promise<T>,
  options?: {
    optimisticUpdate?: () => Promise<void>;
    onSuccess?: (result: T) => void;
    onError?: (error: any) => void;
    syncCollections?: CollectionName[];
  }
): Promise<T> {
  // Apply optimistic update to local RxDB immediately
  if (options?.optimisticUpdate) {
    try {
      await options.optimisticUpdate();
    } catch (e) {
      console.warn('[RxDB] Optimistic update failed:', e);
    }
  }

  try {
    // Execute the actual server action
    const result = await action();

    // Trigger sync for affected collections
    if (options?.syncCollections) {
      for (const col of options.syncCollections) {
        forceSyncCollection(col).catch(() => {});
      }
    }

    options?.onSuccess?.(result);
    return result;
  } catch (error) {
    console.error('[RxDB] Action failed:', error);
    options?.onError?.(error);
    throw error;
  }
}

/**
 * Upsert a document into a local RxDB collection.
 * The replication engine will push it to the server.
 */
export async function localUpsert(
  collectionName: CollectionName,
  data: any
): Promise<any> {
  const db = await getDatabase();
  const collection = db[collectionName];
  const now = nowISO();
  
  const doc = {
    ...data,
    id: data.id || generateId(),
    updatedAt: now,
    _deleted: false,
  };

  if (!doc.createdAt) {
    doc.createdAt = now;
  }

  return collection.upsert(doc);
}

/**
 * Insert a new document locally. Replication pushes to server.
 */
export async function localInsert(
  collectionName: CollectionName,
  data: any
): Promise<any> {
  const db = await getDatabase();
  const collection = db[collectionName];
  const now = nowISO();
  
  const doc = {
    id: generateId(),
    ...data,
    createdAt: now,
    updatedAt: now,
    _deleted: false,
  };

  return collection.insert(doc);
}

/**
 * Update a document locally by ID. Replication pushes to server.
 */
export async function localUpdate(
  collectionName: CollectionName,
  id: string,
  patch: Record<string, any>
): Promise<any> {
  const db = await getDatabase();
  const collection = db[collectionName];
  const doc = await collection.findOne(id).exec();
  
  if (!doc) {
    throw new Error(`Document ${id} not found in ${collectionName}`);
  }

  return doc.patch({
    ...patch,
    updatedAt: nowISO(),
  });
}

/**
 * Soft-delete a document locally. Replication pushes delete to server.
 */
export async function localRemove(
  collectionName: CollectionName,
  id: string
): Promise<void> {
  const db = await getDatabase();
  const collection = db[collectionName];
  const doc = await collection.findOne(id).exec();
  
  if (doc) {
    await doc.remove();
  }
}
