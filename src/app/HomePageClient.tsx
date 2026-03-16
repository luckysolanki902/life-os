'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';
import NewHomeClient from './NewHomeClient';
import { useHomeData, useRxDBContext } from '@/lib/rxdb';

export default function HomePageClient() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isReady, forceSync } = useRxDBContext();
  
  // Use RxDB reactive home data - auto-updates when local DB changes
  const { data, isLoading } = useHomeData();

  // Manual refresh - triggers a sync cycle
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await forceSync();
    } finally {
      // Small delay to let subscriptions propagate
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  // Show minimal loading only on truly first load (no local data yet)
  if ((isLoading || !isReady) && !data) {
    return (
      <div className="space-y-4 pt-4 px-1">
        <div className="flex justify-between items-center mb-6">
           <div className="space-y-2">
              <div className="h-6 w-32 bg-secondary/50 rounded-lg animate-pulse" />
              <div className="h-4 w-24 bg-secondary/30 rounded-lg animate-pulse" />
           </div>
           <div className="h-8 w-16 bg-secondary/50 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-4">
           <div className="h-32 bg-card border border-border/50 rounded-2xl animate-pulse" />
           <div className="h-32 bg-card border border-border/50 rounded-2xl animate-pulse" />
        </div>
        <div className="space-y-2 pt-4">
          <div className="h-6 w-24 bg-secondary/30 rounded-lg mb-2 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-card border border-border/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground flex-col gap-2">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="fixed bottom-20 right-4 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all disabled:opacity-50 hover:scale-105"
        title="Refresh"
      >
        <RotateCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
      </button>
      <NewHomeClient
        incompleteTasks={data.incompleteTasks}
        domains={data.domains}
        todaysWeight={data.todaysWeight}
        streakData={data.streakData}
        specialTasks={data.specialTasks}
        totalPoints={data.totalPoints}
        last7DaysCompletion={data.last7DaysCompletion}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
