import { NextResponse } from 'next/server';
import { getIdentityMetric, getLast7DaysCompletion } from "@/app/actions/stats";
import { getRoutine } from "@/app/actions/routine";
import { getTodaysWeightData } from "@/app/actions/health";
import { getStreakData, getSpecialTasks, getTotalPointsWithBonuses } from "@/app/actions/streak";

// No caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Parallel independent fetching for ultra-fast performance
    const [
      routineData,
      todaysWeight,
      streakData,
      specialTasks,
      pointsData,
      last7DaysCompletion
    ] = await Promise.all([
      getRoutine(),
      getTodaysWeightData(),
      getStreakData(),
      getSpecialTasks(),
      getTotalPointsWithBonuses(),
      getLast7DaysCompletion()
    ]);

    const routine = routineData.routine;

    const incompleteTasks = routine
      .filter((t) => t.log?.status !== 'completed')
      .map((t) => ({
        _id: t._id?.toString() || t._id,
        title: t.title,
        domainId: t.domainId,
        timeOfDay: t.timeOfDay,
        points: t.basePoints || t.points,
        status: t.log?.status || 'pending',
        mustDo: t.mustDo || false
      }));

    const domains = [
      {
        id: "health",
        name: "Health",
        icon: "Heart",
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
      },
      {
        id: "books",
        name: "Books",
        icon: "BookMarked",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
      },
      {
        id: "learning",
        name: "Learning",
        icon: "Brain",
        color: "text-violet-500",
        bg: "bg-violet-500/10",
        border: "border-violet-500/20",
      },
    ];

    return NextResponse.json({
      incompleteTasks,
      domains,
      todaysWeight,
      streakData,
      specialTasks,
      totalPoints: pointsData.totalPoints,
      last7DaysCompletion
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      }
    });
  } catch (error) {
    console.error('Home API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
