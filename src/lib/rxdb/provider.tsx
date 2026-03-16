/**
 * RxDB Provider - Initializes database and replication at app level
 * Wrap your app with this to ensure RxDB is ready before rendering.
 */

'use client';

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { type LifeOsDatabase } from './database';

interface RxDBContextValue {
  db: LifeOsDatabase | null;
  isReady: boolean;
  isSyncing: boolean;
  forceSync: () => Promise<void>;
}

const RxDBContext = createContext<RxDBContextValue>({
  db: null,
  isReady: false,
  isSyncing: false,
  forceSync: async () => {},
});

export function useRxDBContext() {
  return useContext(RxDBContext);
}

interface RxDBProviderProps {
  children: ReactNode;
}

export function RxDBProvider({ children }: RxDBProviderProps) {
  const [db, setDb] = useState<LifeOsDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    async function init() {
      try {
        // Dynamic imports to avoid SSR issues
        const { getDatabase } = await import('./database');
        const { startReplication, awaitInitialSync } = await import('./replication');

        const database = await getDatabase();
        if (cancelled) return;

        setDb(database);

        // Start replication with 10s polling
        await startReplication(10000);

        // Wait for initial data pull (with timeout)
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
        await Promise.race([awaitInitialSync(), timeout]);

        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        console.error('[RxDB] Initialization error:', error);
        // Still mark as ready so app isn't blocked
        if (!cancelled) {
          setIsReady(true);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleForceSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const { forceSync } = await import('./replication');
      await forceSync();
    } catch (error) {
      console.error('[RxDB] Force sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <RxDBContext.Provider value={{ db, isReady, isSyncing, forceSync: handleForceSync }}>
      {children}
    </RxDBContext.Provider>
  );
}
