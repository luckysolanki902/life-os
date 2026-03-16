/**
 * RxDB Database - Single instance, lazy initialization
 * Uses IndexedDB storage for browser persistence
 */

import { createRxDatabase, addRxPlugin, type RxDatabase, type RxCollection, type RxStorage } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { collectionSchemas, COLLECTION_NAMES, type CollectionName } from './schemas';

// Add leader election for multi-tab coordination
addRxPlugin(RxDBLeaderElectionPlugin);

let devModeAdded = false;

async function getStorage(): Promise<RxStorage<any, any>> {
  const baseStorage = getRxStorageDexie();
  if (process.env.NODE_ENV === 'development') {
    if (!devModeAdded) {
      const { RxDBDevModePlugin } = await import('rxdb/plugins/dev-mode');
      addRxPlugin(RxDBDevModePlugin);
      devModeAdded = true;
    }
    const { wrappedValidateAjvStorage } = await import('rxdb/plugins/validate-ajv');
    return wrappedValidateAjvStorage({ storage: baseStorage });
  }
  return baseStorage;
}

export type LifeOsCollections = {
  [K in CollectionName]: RxCollection;
};

export type LifeOsDatabase = RxDatabase<LifeOsCollections>;

let dbPromise: Promise<LifeOsDatabase> | null = null;

async function createDatabase(): Promise<LifeOsDatabase> {
  const storage = await getStorage();
  const db = await createRxDatabase<LifeOsCollections>({
    name: 'lifeos_db',
    storage,
    multiInstance: true, // Multi-tab support
    eventReduce: true, // Optimize event processing
    ignoreDuplicate: true,
  });

  // Create all collections
  const collectionConfigs: Record<string, { schema: any }> = {};
  for (const [name, schema] of Object.entries(collectionSchemas)) {
    collectionConfigs[name] = { schema };
  }

  await db.addCollections(collectionConfigs);

  return db;
}

/**
 * Get the singleton database instance.
 * Safe to call multiple times - returns the same promise.
 */
export function getDatabase(): Promise<LifeOsDatabase> {
  if (typeof window === 'undefined') {
    throw new Error('RxDB can only be used in the browser');
  }

  if (!dbPromise) {
    dbPromise = createDatabase();
  }
  return dbPromise;
}

/**
 * Get a specific collection by name
 */
export async function getCollection(name: CollectionName): Promise<RxCollection> {
  const db = await getDatabase();
  return db[name];
}

/**
 * Destroy the database (for logout/cleanup)
 */
export async function destroyDatabase(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.close();
    dbPromise = null;
  }
}

export { COLLECTION_NAMES };
