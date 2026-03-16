import { getRoutine } from '@/app/actions/routine';
import { getTodaysWeightData } from '@/app/actions/health';
import { getStreakData, getSpecialTasks, getTotalPointsWithBonuses } from '@/app/actions/streak';
import { getLast7DaysCompletion } from '@/app/actions/stats';
import HomePageClient from './HomePageClient';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [
    routineData,
    todaysWeight,
    streakData,
    specialTasks,
    pointsData,
    last7DaysCompletion,
  ] = await Promise.all([
    getRoutine(),
    getTodaysWeightData(),
    getStreakData(),
    getSpecialTasks(),
    getTotalPointsWithBonuses(),
    getLast7DaysCompletion(),
  ]);

  const incompleteTasks = routineData.routine
    .filter((t: any) => t.log?.status !== 'completed')
    .map((t: any) => ({
      _id: t._id?.toString() || t._id,
      title: t.title,
      domainId: t.domainId,
      timeOfDay: t.timeOfDay,
      points: t.basePoints || t.points,
      status: t.log?.status || 'pending',
      mustDo: t.mustDo || false,
    }));

  const domains = [
    { id: 'health', name: 'Health', icon: 'Heart', color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    { id: 'books', name: 'Books', icon: 'BookMarked', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { id: 'learning', name: 'Learning', icon: 'Brain', color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  ];

  return (
    <HomePageClient
      initialData={{
        incompleteTasks,
        domains,
        todaysWeight: todaysWeight ? JSON.parse(JSON.stringify(todaysWeight)) : null,
        streakData: JSON.parse(JSON.stringify(streakData)),
        specialTasks: JSON.parse(JSON.stringify(specialTasks)),
        totalPoints: pointsData.totalPoints,
        last7DaysCompletion,
      }}
    />
  );
}
