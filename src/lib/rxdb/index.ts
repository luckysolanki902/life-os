/**
 * RxDB Module - Public API
 * 
 * Local-first database with automatic online sync.
 * Import everything you need from '@/lib/rxdb'.
 */

// Database
export { getDatabase, getCollection, destroyDatabase, COLLECTION_NAMES } from './database';
export type { LifeOsDatabase, LifeOsCollections } from './database';

// Schemas
export { collectionSchemas, COLLECTION_TO_MODEL } from './schemas';
export type { CollectionName } from './schemas';

// Replication
export { startReplication, stopReplication, forceSync, forceSyncCollection, awaitInitialSync } from './replication';

// React Hooks
export { useRxDB, useRxCollection, useRxQuery, useRxDocument, useRxMutation, useHomeData } from './hooks';

// Provider
export { RxDBProvider, useRxDBContext } from './provider';

// Actions (local-first writes)
export { withRxDB, localUpsert, localInsert, localUpdate, localRemove } from './actions';

// Utilities
export { mongoToRxdb, rxdbToMongo, mongoDocsToRxdb, generateId, nowISO } from './utils';
