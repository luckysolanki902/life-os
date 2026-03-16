/**
 * RxDB Replication Engine
 * 
 * Implements pull/push replication between local RxDB and MongoDB server.
 * Uses RxDB's built-in replication protocol with custom HTTP handlers.
 * 
 * Architecture:
 * - Pull: Server sends documents updated since last checkpoint
 * - Push: Client sends locally changed documents to server
 * - Conflict resolution: Server wins (last-write-wins based on updatedAt)
 * - Live: Uses polling for real-time sync (configurable interval)
 */

import { replicateRxCollection, type RxReplicationState } from 'rxdb/plugins/replication';
import type { RxCollection } from 'rxdb';
import { getDatabase, COLLECTION_NAMES, type LifeOsDatabase } from './database';
import { COLLECTION_TO_MODEL, type CollectionName } from './schemas';

interface ReplicationCheckpoint {
  updatedAt: string;
  id: string;
}

// Store all active replications
const activeReplications = new Map<string, RxReplicationState<any, ReplicationCheckpoint>>();

// Sync state
let isSyncing = false;
let lastSyncTime: number = 0;
const SYNC_DEBOUNCE_MS = 500;

/**
 * Get the base URL for sync API calls
 */
function getSyncUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

/**
 * Start replication for a single collection
 */
function startCollectionReplication(
  collection: RxCollection,
  collectionName: string,
  liveInterval: number = 10000 // 10 seconds default
): RxReplicationState<any, ReplicationCheckpoint> {
  const modelName = COLLECTION_TO_MODEL[collectionName];
  if (!modelName) {
    throw new Error(`No model mapping for collection: ${collectionName}`);
  }

  const baseUrl = getSyncUrl();

  const replicationState = replicateRxCollection({
    collection,
    replicationIdentifier: `lifeos-sync-${collectionName}`,
    deletedField: '_deleted',
    live: true,
    retryTime: 5000, // Retry failed syncs after 5s
    waitForLeadership: true, // Only one tab syncs at a time
    autoStart: true,

    push: {
      batchSize: 50,
      async handler(changeRows) {
        const docs = changeRows.map(row => {
          const doc = { ...row.newDocumentState };
          // Convert id back to _id for server
          doc._id = doc.id;
          delete doc.id;
          return doc;
        });

        const response = await fetch(`${baseUrl}/api/rxdb/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection: collectionName,
            modelName,
            docs,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Push failed for ${collectionName}: ${error}`);
        }

        const result = await response.json();

        // Handle conflicts - server returns conflicting docs
        if (result.conflicts && result.conflicts.length > 0) {
          // Convert server docs back to RxDB format
          return result.conflicts.map((doc: any) => {
            const rxDoc = { ...doc };
            rxDoc.id = String(rxDoc._id);
            delete rxDoc._id;
            delete rxDoc.__v;
            if (!('_deleted' in rxDoc)) rxDoc._deleted = false;
            return rxDoc;
          });
        }

        return [];
      },
    },

    pull: {
      batchSize: 200,
      async handler(checkpoint: ReplicationCheckpoint | undefined, batchSize: number) {
        const params = new URLSearchParams({
          collection: collectionName,
          modelName,
          batchSize: String(batchSize),
        });

        if (checkpoint) {
          params.set('updatedAt', checkpoint.updatedAt);
          params.set('id', checkpoint.id);
        }

        const response = await fetch(`${baseUrl}/api/rxdb/pull?${params}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Pull failed for ${collectionName}: ${error}`);
        }

        const result = await response.json();

        // Convert MongoDB docs to RxDB format
        const documents = (result.documents || []).map((doc: any) => {
          const rxDoc = { ...doc };
          rxDoc.id = String(rxDoc._id);
          delete rxDoc._id;
          delete rxDoc.__v;
          if (!('_deleted' in rxDoc)) rxDoc._deleted = false;
          // Ensure date fields are strings
          for (const [key, value] of Object.entries(rxDoc)) {
            if (value && typeof value === 'object' && 'toISOString' in (value as any)) {
              rxDoc[key] = (value as any).toISOString();
            }
          }
          return rxDoc;
        });

        return {
          documents,
          checkpoint: result.checkpoint || checkpoint || null,
        };
      },
    },
  });

  // Log replication events in development
  if (process.env.NODE_ENV === 'development') {
    replicationState.error$.subscribe((err) => {
      console.error(`[RxDB Sync] Error in ${collectionName}:`, err);
    });
    replicationState.active$.subscribe((active) => {
      if (active) {
        console.log(`[RxDB Sync] ${collectionName} syncing...`);
      }
    });
  }

  return replicationState;
}

/**
 * Start replication for all collections.
 * Call this once when the app initializes.
 */
export async function startReplication(liveInterval: number = 10000): Promise<void> {
  if (activeReplications.size > 0) {
    return; // Already running
  }

  const db = await getDatabase();
  const collectionNames = Object.values(COLLECTION_NAMES);

  for (const name of collectionNames) {
    const collection = db[name];
    if (collection) {
      const repl = startCollectionReplication(collection, name, liveInterval);
      activeReplications.set(name, repl);
    }
  }

  console.log('[RxDB Sync] Replication started for all collections');
}

/**
 * Stop all replications (for logout/cleanup)
 */
export async function stopReplication(): Promise<void> {
  for (const [name, repl] of activeReplications) {
    await repl.cancel();
  }
  activeReplications.clear();
  console.log('[RxDB Sync] All replications stopped');
}

/**
 * Force an immediate sync cycle for all collections.
 * Debounced to prevent excessive syncing.
 */
export async function forceSync(): Promise<void> {
  const now = Date.now();
  if (isSyncing || now - lastSyncTime < SYNC_DEBOUNCE_MS) {
    return;
  }

  isSyncing = true;
  lastSyncTime = now;

  try {
    for (const [, repl] of activeReplications) {
      repl.reSync();
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Force sync for a specific collection
 */
export async function forceSyncCollection(collectionName: CollectionName): Promise<void> {
  const repl = activeReplications.get(collectionName);
  if (repl) {
    await repl.reSync();
  }
}

/**
 * Get the sync status of all collections
 */
export function getSyncStatus(): Map<string, boolean> {
  const status = new Map<string, boolean>();
  for (const [name, repl] of activeReplications) {
    // Check if replication has pending operations
    status.set(name, !repl.isStopped());
  }
  return status;
}

/**
 * Wait for the initial replication to complete (first pull)
 */
export async function awaitInitialSync(): Promise<void> {
  const promises: Promise<any>[] = [];
  for (const [, repl] of activeReplications) {
    promises.push(repl.awaitInitialReplication());
  }
  await Promise.all(promises);
  console.log('[RxDB Sync] Initial sync complete');
}
