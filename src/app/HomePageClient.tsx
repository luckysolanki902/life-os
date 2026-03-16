'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import NewHomeClient from './NewHomeClient';

interface HomeData {
  incompleteTasks: any[];
  domains: any[];
  todaysWeight: any;
  streakData: any;
  specialTasks: any[];
  totalPoints: number;
  last7DaysCompletion: any[];
}

export default function HomePageClient({ initialData }: { initialData: HomeData }) {
  const [data, setData] = useState<HomeData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger RxDB sync in background
      import('@/lib/rxdb/replication').then(m => m.forceSync()).catch(() => {});
      const res = await fetch('/api/home');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('[Home] Refresh error:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

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
