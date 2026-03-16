'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BookOpen,
  Brain,
  Trophy,
  Scale,
  Smile,
  Calendar,
  ArrowRight,
  Target,
  Flame,
  FileText,
  RotateCw,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOverallReport, getDashboardStats } from '../actions/reports';

const PERIODS = [
  { value: 'last7Days', label: '7D' },
  { value: 'last30Days', label: '30D' },
  { value: 'thisMonth', label: 'Month' },
  { value: 'last3Months', label: '3M' },
  { value: 'thisYear', label: 'Year' },
  { value: 'allTime', label: 'All' },
];

interface ReportData {
  summary: {
    routineCompletionRate: number;
    routineChange: number;
    totalPoints: number;
    pointsChange: number;
    exerciseDays: number;
    exerciseChange: number;
    currentWeight: number | null;
    weightChange: number;
    avgMood: number;
    booksCompleted: number;
    booksChange: number;
    pagesRead: number;
    pagesReadChange: number;
    learningMinutes: number;
    learningChange: number;
  };
  domainBreakdown: Array<{
    domain: string;
    completionRate: number;
    points: number;
  }>;
  dailyBreakdown: Array<{
    date: string;
    dayName?: string;
    completed: number;
    total: number;
    rate: number;
    learningMinutes?: number;
    pagesRead?: number;
    weight?: number | null;
  }>;
}

interface DashboardStats {
  heatmapData: Array<{ date: string; count: number }>;
  weightHistory: Array<{ date: string; weight: number }>;
}

function Heatmap({ data }: { data: Array<{ date: string; count: number }> }) {
  // Generate last 365 days
  const today = new Date();
  const days: Date[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  // Create map for easy lookup
  const dataMap = new Map(data.map(d => [d.date, d.count]));
  
  // Group by week
  const weeks = [];
  let currentWeek = [];
  
  // Align start to Sunday
  // Note: This is a simplified calendar approach
  
  return (
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex gap-1 min-w-fit">
           {Array.from({ length: 53 }).map((_, wIndex) => (
             <div key={wIndex} className="flex flex-col gap-1">
               {Array.from({ length: 7 }).map((_, dIndex) => {
                  const dayOffset = (wIndex * 7) + dIndex;
                  const dayDate = days[dayOffset]; // This mapping is rough, better to align days properly
                  if (!dayDate) return <div key={dIndex} className="w-2.5 h-2.5" />;
                  
                  const dateStr = dayDate.toISOString().split('T')[0];
                  const count = dataMap.get(dateStr) || 0;
                  
                  // Use activity level colors
                  let bg = "bg-secondary/40";
                  if (count > 0) bg = "bg-emerald-500/30";
                  if (count > 1) bg = "bg-emerald-500/60";
                  if (count > 2) bg = "bg-emerald-500";
                  
                  return (
                    <div 
                      key={dIndex} 
                      className={cn("w-2.5 h-2.5 rounded-[2px]", bg)} 
                      title={`${dateStr}: ${count} exercises`}
                    />
                  );
               })}
             </div>
           ))}
        </div>
      </div>
  );
}

// Better Heatmap Logic
function ActivityHeatmap({ data }: { data: Array<{ date: string; count: number }> }) {
    const containerRef = useRef<HTMLDivElement>(null);
    
    // We want approx 52 weeks.
    // Start date should be Sunday ~365 days ago.
    const today = new Date();
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 365);
    
    // Adjust start date to previous Sunday
    while (startDate.getDay() !== 0) {
        startDate.setDate(startDate.getDate() - 1);
    }

    const allDays = [];
    const current = new Date(startDate);
    while (current <= endDate) {
        allDays.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }

    const groupedByWeek = [];
    let currentWeek = [];
    for (const day of allDays) {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
            groupedByWeek.push(currentWeek);
            currentWeek = [];
        }
    }
    if (currentWeek.length > 0) groupedByWeek.push(currentWeek);

    const dataMap = new Map(data.map(d => [d.date, d.count]));

    // Auto-scroll to latest (rightmost) on mount for mobile
    useEffect(() => {
        if (containerRef.current) {
            const container = containerRef.current;
            // Scroll to the end (latest dates on right)
            container.scrollLeft = container.scrollWidth;
        }
    }, []);

    return (
        <div className="bg-card border border-border/40 rounded-xl p-5 shadow-sm overflow-hidden">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Exercise Activity</h3>
            <div ref={containerRef} className="w-full overflow-x-auto">
                <div className="flex gap-[3px] min-w-max pb-2">
                    {groupedByWeek.map((week, wIndex) => (
                        <div key={wIndex} className="flex flex-col gap-[3px]">
                            {week.map((day, dIndex) => {
                                const dateStr = day.toISOString().split('T')[0];
                                const count = dataMap.get(dateStr) || 0;
                                let color = "bg-secondary/50"; // Empty
                                if (count >= 1) color = "bg-emerald-500/40";
                                if (count >= 2) color = "bg-emerald-500/70";
                                if (count >= 3) color = "bg-emerald-500";
                                
                                // Rest day logic could be here if we had that data
                                
                                return (
                                    <div 
                                        key={dIndex}
                                        className={cn("w-2.5 h-2.5 rounded-[1px] transition-colors", color)}
                                        title={`${dateStr}: ${count} activities`}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


function TrendBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) return null;
  
  const isPositive = value > 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium',
      isPositive ? 'text-emerald-500' : 'text-rose-500'
    )}>
      {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {isPositive ? '+' : ''}{value}{suffix}
    </span>
  );
}

// Loading Skeleton Components
function StatCardSkeleton() {
  return (
    <div className="bg-card border border-border/40 rounded-xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 bg-muted rounded-lg" />
        <div className="w-12 h-4 bg-muted rounded" />
      </div>
      <div className="w-16 h-8 bg-muted rounded mb-1" />
      <div className="w-20 h-3 bg-muted rounded" />
    </div>
  );
}

function ChartSkeleton({ height = "h-24" }: { height?: string }) {
  return (
    <div className={cn("bg-muted/20 rounded-xl animate-pulse", height)} />
  );
}

// Minimal stat card
function StatCard({
  label,
  value,
  change,
  icon: Icon,
  suffix = '',
  changeSuffix = '',
  color,
}: {
  label: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  suffix?: string;
  changeSuffix?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary',
    rose: 'text-rose-500',
    amber: 'text-amber-500',
    purple: 'text-purple-500',
    cyan: 'text-cyan-500',
    emerald: 'text-emerald-500',
  };
  
  const textColor = colorMap[color] || 'text-foreground';

  return (
    <div className="bg-card border border-border/40 rounded-xl p-5 hover:border-border/80 transition-all shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Icon size={16} className={cn("opacity-80", textColor)} />
        {change !== undefined && change !== 0 && (
          <TrendBadge value={change} suffix={changeSuffix} />
        )}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}{suffix}</p>
      <p className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// Custom minimal tooltip
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>;
  label?: string;
}

function MinimalTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-popover border border-border/50 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[10px] font-semibold text-foreground mb-1 border-b border-border/30 pb-1">{label}</p>
      {payload.map((entry, i: number) => (
        <p key={i} className="text-[10px] text-muted-foreground flex items-center justify-between gap-3">
          <span className="flex items-center gap-1">
             <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
             {entry.name === 'rate' ? 'Rate' : entry.name}
          </span>
          <span className="font-mono font-medium text-foreground">
            {entry.value}{entry.name.includes('Rate') || entry.dataKey === 'rate' ? '%' : ''}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function ReportsClient() {
  const router = useRouter();
  const [period, setPeriod] = useState('last7Days');
  const [data, setData] = useState<ReportData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingBg, setIsSyncingBg] = useState(false);

  // Fetch data on mount and when period changes
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function checkForUpdates() {
      try {
        const result = await getOverallReport(period);
        
        // Compare with current data
        if (data && JSON.stringify(result) !== JSON.stringify(data)) {
          setIsSyncingBg(true);
          console.log('[Reports] Data difference detected, syncing...');
          
          // Smoothly update data in background
          setTimeout(() => {
            setData(result);
            setIsSyncingBg(false);
          }, 300);
        } else if (!data) {
          setData(result);
        }
      } catch (error) {
        console.error('Background sync failed:', error);
        setIsSyncingBg(false);
      }
    }

    // Initial fetch
    if (!data) setIsLoading(true);
    checkForUpdates().finally(() => setIsLoading(false));

    // Check every 30 seconds (RxDB handles real-time sync)
    intervalId = setInterval(checkForUpdates, 30000);

    return () => clearInterval(intervalId);
  }, [period]);

  // Fetch stats separately
  useEffect(() => {
    getDashboardStats().then((result) => {
      setStats(result);
    }).catch(console.error);
  }, []);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [result, dashboardStats] = await Promise.all([
        getOverallReport(period),
        getDashboardStats()
      ]);
      setData(result);
      setStats(dashboardStats);
      
      router.refresh();
    } catch (error) {
      console.error('Failed to refresh report data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="space-y-8 animate-pulse p-1">
        <div className="flex flex-col gap-4">
          <div className="w-32 h-8 bg-muted rounded-lg" />
          <div className="flex gap-2">
             {[1,2,3,4,5,6].map(i => <div key={i} className="w-12 h-8 bg-muted rounded-lg" />)}
          </div>
        </div>
        <div className="h-48 bg-muted rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
           {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  const { summary, dailyBreakdown } = data;

  // Process chart data
  const chartData = dailyBreakdown?.map((day) => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    shortDate: day.dayName || new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
    rate: day.rate,
    completed: day.completed,
    total: day.total,
    learningMinutes: day.learningMinutes || 0,
    pagesRead: day.pagesRead || 0,
    weight: day.weight
  })) || [];

  const moodLabels: Record<number, string> = {
    5: 'Great', 4: 'Good', 3: 'Okay', 2: 'Low', 1: 'Bad'
  };

  return (
    <div className="space-y-6 pb-24 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isSyncingBg}
              className={cn(
                "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all",
                (isRefreshing || isSyncingBg) && "animate-spin"
              )}
              title={isSyncingBg ? "Syncing in background..." : "Refresh data"}
            >
              <RotateCw size={16} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Overview
          </p>
        </div>
        
        {/* Period Pills */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit border border-border/40">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-[10px] font-medium transition-all uppercase tracking-wide',
                period === p.value
                  ? 'bg-background text-foreground shadow-sm border border-border/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Domain Report Shortcuts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link 
          href="/reports/health"
          className="group bg-card border border-border/40 rounded-xl p-4 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <Heart size={20} className="text-rose-500" />
            <ArrowRight size={14} className="text-muted-foreground group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold">Health Reports</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Exercise & Weight</p>
        </Link>

        <Link 
          href="/reports/routine"
          className="group bg-card border border-border/40 rounded-xl p-4 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <Target size={20} className="text-primary" />
            <ArrowRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold">Routine Reports</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Tasks & Streaks</p>
        </Link>

        <Link 
          href="/reports/books"
          className="group bg-card border border-border/40 rounded-xl p-4 hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <BookOpen size={20} className="text-cyan-500" />
            <ArrowRight size={14} className="text-muted-foreground group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold">Books Reports</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Reading Progress</p>
        </Link>

        <Link 
          href="/reports/learning"
          className="group bg-card border border-border/40 rounded-xl p-4 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <Brain size={20} className="text-purple-500" />
            <ArrowRight size={14} className="text-muted-foreground group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h3 className="text-sm font-semibold">Learning Reports</h3>
          <p className="text-[10px] text-muted-foreground mt-1">Skills & Time</p>
        </Link>
      </div>

      {/* Main Completion Rate Card with Chart */}
      <div className="bg-card border border-border/40 rounded-xl p-6 shadow-sm relative overflow-hidden group">
       
        <div className="flex items-start justify-between mb-8 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Routine Completion</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tracking-tight">{summary.routineCompletionRate}%</span>
              <TrendBadge value={summary.routineChange} suffix="%" />
            </div>
          </div>
        </div>
        
        {chartData.length > 1 && (
          <div className="h-32 -mx-2 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="shortDate" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <Tooltip content={<MinimalTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#completionGradient)"
                  activeDot={{ r: 4, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Stats Grid - 4 Columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Points"
          value={stats?.totalPoints >= 1000 ? `${(stats.totalPoints/1000).toFixed(1)}k` : (stats?.totalPoints || 0)}
          change={summary.pointsChange}
          icon={Trophy}
          color="amber"
        />
        <StatCard
          label="Active Days"
          value={summary.exerciseDays}
          change={summary.exerciseChange}
          icon={Activity}
          color="rose"
        />
        <StatCard
          label="Learning"
          value={`${Math.round(summary.learningMinutes / 60 * 10) / 10}h`}
          change={Math.round(summary.learningChange / 60 * 10) / 10}
          changeSuffix="h"
          icon={Brain}
          color="purple"
        />
        <StatCard
          label="Read"
          value={summary.pagesRead || 0}
          change={summary.pagesReadChange}
          icon={BookOpen}
          color="cyan"
        />
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border/40 rounded-xl p-4 flex items-center justify-between hover:border-border/80 transition-colors">
          <div>
            <p className="text-lg font-bold">
              {summary.currentWeight ? `${summary.currentWeight}` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Weight (kg)</p>
          </div>
          {summary.weightChange !== 0 && summary.currentWeight && (
             <span className={cn(
                  'text-[10px] font-medium ml-1',
                  summary.weightChange > 0 ? 'text-amber-500' : 'text-emerald-500'
                )}>
                  {summary.weightChange > 0 ? '+' : ''}{summary.weightChange}
             </span>
          )}
        </div>
        <div className="bg-card border border-border/40 rounded-xl p-4 flex items-center justify-between hover:border-border/80 transition-colors">
           <div>
            <p className="text-lg font-bold">
              {summary.avgMood > 0 ? moodLabels[Math.round(summary.avgMood)] : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Avg Mood</p>
          </div>
          <Smile size={16} className="text-emerald-500/80" />
        </div>
        <div className="bg-card border border-border/40 rounded-xl p-4 flex items-center justify-between hover:border-border/80 transition-colors">
           <div>
            <p className="text-lg font-bold">{summary.booksCompleted}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Books Done</p>
          </div>
          <BookOpen size={16} className="text-blue-500/80" />
        </div>
      </div>
      
      {/* Exercise Heatmap */}
      {stats?.heatmapData && <ActivityHeatmap data={stats.heatmapData} />}

      {/* Charts Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        
        {/* Pages Read Chart */}
        {chartData.length > 1 && (
            <div className="bg-card border border-border/40 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pages Read
                </h3>
            </div>
            <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                    <linearGradient id="readGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    </defs>
                    <XAxis 
                    dataKey="shortDate" 
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                    />
                    <Tooltip content={<MinimalTooltip />} />
                    <Area
                    type="monotone"
                    dataKey="pagesRead"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#readGradient)"
                    name="Pages"
                    />
                </AreaChart>
                </ResponsiveContainer>
            </div>
            </div>
        )}

        {/* Learning Duration Chart */}
        {chartData.length > 1 && (
            <div className="bg-card border border-border/40 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Learning Minutes
                </h3>
            </div>
            <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                    <defs>
                    <linearGradient id="learningGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgb(245, 158, 11)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="rgb(245, 158, 11)" stopOpacity={0} />
                    </linearGradient>
                    </defs>
                    <XAxis 
                    dataKey="shortDate" 
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                    />
                    <Tooltip content={<MinimalTooltip />} />
                    <Area
                    type="monotone"
                    dataKey="learningMinutes"
                    stroke="rgb(245, 158, 11)"
                    strokeWidth={2}
                    fill="url(#learningGradient)"
                    name="Minutes"
                    />
                </AreaChart>
                </ResponsiveContainer>
            </div>
            </div>
        )}

        {/* Weight Chart (Zoomed) */}
        {chartData.some(d => d.weight) && (
             <div className="md:col-span-2 bg-card border border-border/40 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                    Weight Trend (kg)
                </h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.filter(d => d.weight !== null)}>
                        <defs>
                            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis 
                            dataKey="shortDate" 
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            dy={5}
                        />
                        <YAxis 
                            domain={['dataMin - 1', 'dataMax + 1']} 
                            hide={false}
                            width={30}
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<MinimalTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="weight"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            fill="url(#weightGradient)"
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                    </ResponsiveContainer>
                </div>
             </div>
        )}
      </div>
    </div>
  );
}
