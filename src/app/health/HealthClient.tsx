"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Scale,
  Dumbbell,
  Plus,
  Activity,
  ChevronRight,
  Sparkles,
  Smile,
  Meh,
  Frown,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  Eye,
  EyeOff,
  Pencil,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { logWeight, createHealthPage, saveMood, updateWeight } from "@/app/actions/health";
import { withRxDB } from '@/lib/rxdb/actions';
import { COLLECTION_NAMES } from '@/lib/rxdb';
import TaskItem from "@/app/routine/TaskItem";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { getLocalDateString, parseServerDate, formatDateForDisplay } from "@/lib/date-utils";
import ShareableWorkout from "./ShareableWorkout";

interface Task {
  _id: string;
  title: string;
  domainId: string;
  log?: {
    status?: 'completed' | 'skipped';
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface MoodLog {
  mood: string;
  date?: Date;
  note?: string;
}

interface HealthPage {
  _id: string;
  title: string;
  description?: string;
  cycleStatus?: "current" | "done" | string;
}

interface WeightStats {
  current: number;
  bmi: string | null;
  delta: number | null;
  deltaLabel?: string | null;
  lastLogged?: Date;
  todaysWeight?: {
    _id: string;
    weight: number;
    date: Date;
  } | null;
}

interface HealthClientProps {
  initialData: {
    routine: Task[];
    weightStats: WeightStats;
    pages: HealthPage[];
    mood: MoodLog | null;
    date: string;
    todaysExerciseCount?: number;
    canBeRestDay?: boolean;
    yesterdayExerciseCount?: number;
  };
}

const MOOD_OPTIONS = [
  {
    value: "great",
    label: "Great",
    icon: Sparkles,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/50",
  },
  {
    value: "good",
    label: "Good",
    icon: ThumbsUp,
    color: "text-green-400",
    bg: "bg-green-500/20",
    border: "border-green-500/50",
  },
  {
    value: "okay",
    label: "Okay",
    icon: Meh,
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50",
  },
  {
    value: "low",
    label: "Low",
    icon: Frown,
    color: "text-orange-400",
    bg: "bg-orange-500/20",
    border: "border-orange-500/50",
  },
  {
    value: "bad",
    label: "Bad",
    icon: ThumbsDown,
    color: "text-rose-400",
    bg: "bg-rose-500/20",
    border: "border-rose-500/50",
  },
] as const;

export default function HealthClient({ initialData }: HealthClientProps) {
  const router = useRouter();
  const { routine, weightStats, pages, mood, date, todaysExerciseCount = 0, canBeRestDay = false } = initialData;
  
  // Parse server date and get YYYY-MM-DD in local timezone (IST)
  const currentDate = parseServerDate(date);

  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isPageModalOpen, setIsPageModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [weightDate, setWeightDate] = useState(currentDate);
  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("");
  const [selectedMood, setSelectedMood] = useState<string | null>(
    mood?.mood || null
  );
  const [isSavingMood, setIsSavingMood] = useState(false);
  const [showDoneTasks, setShowDoneTasks] = useState(false);
  const [showSkippedTasks, setShowSkippedTasks] = useState(false);

  // Update selected mood when mood prop changes (e.g., when date changes)
  useEffect(() => {
    setSelectedMood(mood?.mood || null);
  }, [mood]);

  // Filter tasks into categories
  const { activeTasks, doneTasks, skippedTasks } = useMemo(() => {
    const active: Task[] = [];
    const done: Task[] = [];
    const skipped: Task[] = [];
    
    routine.forEach((task) => {
      const status = task.log?.status;
      if (status === 'skipped') {
        skipped.push(task);
      } else if (status === 'completed') {
        done.push(task);
      } else {
        active.push(task);
      }
    });
    
    return { activeTasks: active, doneTasks: done, skippedTasks: skipped };
  }, [routine]);

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    router.push(`/health?date=${e.target.value}`);
  }

  async function handleLogWeight(e: React.FormEvent) {
    e.preventDefault();
    if (!weightInput) return;
    
    const weightValue = Number(weightInput);
    
    try {
      if (editingWeightId) {
        await withRxDB(
          () => updateWeight(editingWeightId, weightValue),
          { syncCollections: [COLLECTION_NAMES.WEIGHT_LOGS] }
        );
      } else {
        await withRxDB(
          () => logWeight(weightValue, weightDate),
          { syncCollections: [COLLECTION_NAMES.WEIGHT_LOGS] }
        );
      }
      
      setIsWeightModalOpen(false);
      setWeightInput("");
      setEditingWeightId(null);
      router.refresh();
    } catch (error) {
      console.error('Failed to log weight:', error);
    }
  }

  function openWeightModal(existingWeight?: { _id: string; weight: number }) {
    if (existingWeight) {
      setEditingWeightId(existingWeight._id);
      setWeightInput(existingWeight.weight.toString());
    } else {
      setEditingWeightId(null);
      setWeightInput("");
    }
    setWeightDate(currentDate);
    setIsWeightModalOpen(true);
  }

  async function handleCreatePage(e: React.FormEvent) {
    e.preventDefault();
    if (!pageTitle) return;
    await withRxDB(() => createHealthPage(pageTitle), { syncCollections: [COLLECTION_NAMES.HEALTH_PAGES] });
    setIsPageModalOpen(false);
    setPageTitle("");
    router.refresh();
  }

  async function handleMoodSelect(moodValue: string) {
    setSelectedMood(moodValue);
    setIsSavingMood(true);
    // Send currentDate (YYYY-MM-DD) which represents the user's local date
    await withRxDB(() => 
      saveMood(
        currentDate,
        moodValue as "great" | "good" | "okay" | "low" | "bad"
      ),
      { syncCollections: [COLLECTION_NAMES.MOOD_LOGS] }
    );
    setIsSavingMood(false);
    router.refresh();
  }

  // Format date for display using dayjs-based utility
  const displayDate = formatDateForDisplay(currentDate, { showTodayYesterday: false, format: 'long' });

  // Check if current date is today using dayjs-based utility
  const todayStr = getLocalDateString();
  const isToday = currentDate === todayStr;

  return (
    <div className="space-y-8 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                    Health & Fitness
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">{displayDate}</p>
            </div>
            {/* Share Button - Only show for today */}
            {isToday && (
                <ShareableWorkout 
                canShare={(todaysExerciseCount >= 5 || canBeRestDay) && !!weightStats.todaysWeight}
                hasWeight={!!weightStats.todaysWeight}
                isRestDay={canBeRestDay && todaysExerciseCount < 5}
                />
            )}
        </div>
        
        <div className="relative">
            <input
                type="date"
                value={currentDate}
                onChange={handleDateChange}
                className="w-full bg-card border border-border/40 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 scheme-dark"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                <Calendar size={16} />
            </div>
        </div>
      </div>

      {/* Mood Tracker */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {isToday ? "Daily Mood" : "Mood Log"}
        </h2>

        <div className="grid grid-cols-5 gap-2">
            {MOOD_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMood === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => handleMoodSelect(option.value)}
                  disabled={isSavingMood}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all border",
                    isSelected
                      ? `${option.bg} ${option.border} ${option.color} ring-1 ring-inset`
                      : "bg-card border-border/40 text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:border-border/80"
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(
                      "transition-all",
                      isSelected ? option.color : "opacity-70"
                    )}
                  />
                  <span className="text-[10px] font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
      </section>

      {/* Today's Routine Tasks */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
          Daily Habits
        </h2>
        <div className="bg-card border border-border/40 rounded-xl overflow-hidden divide-y divide-border/40">
          {activeTasks.length > 0 ? (
            activeTasks.map((task) => (
                <div key={task._id} className="p-1">
                    <TaskItem task={task} dateStr={currentDate} />
                </div>
            ))
          ) : routine.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No health habits scheduled.
            </div>
          ) : (
            <div className="p-6 text-center text-emerald-500 bg-emerald-500/5">
              <span className="text-sm font-medium">All habits completed! 🎉</span>
            </div>
          )}
        </div>
        
        {/* Toggle buttons for done/skipped tasks */}
        <div className="flex flex-wrap gap-2 px-1">
          {doneTasks.length > 0 && (
            <button
              onClick={() => setShowDoneTasks(!showDoneTasks)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border/40"
            >
              {showDoneTasks ? <EyeOff size={12} /> : <Eye size={12} />}
              {showDoneTasks ? "Hide" : "Show"} done ({doneTasks.length})
            </button>
          )}
          {skippedTasks.length > 0 && (
            <button
              onClick={() => setShowSkippedTasks(!showSkippedTasks)}
              className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary border border-transparent hover:border-border/40"
            >
              {showSkippedTasks ? <EyeOff size={12} /> : <Eye size={12} />}
              {showSkippedTasks ? "Hide" : "Show"} skipped ({skippedTasks.length})
            </button>
          )}
        </div>
        
        {/* Done/Skipped tasks lists */}
        {(showDoneTasks || showSkippedTasks) && (
            <div className="space-y-2 opacity-60">
                 {showDoneTasks && doneTasks.map((task) => <TaskItem key={task._id} task={task} dateStr={currentDate} />)}
                 {showSkippedTasks && skippedTasks.map((task) => <TaskItem key={task._id} task={task} dateStr={currentDate} />)}
            </div>
        )}
      </section>

      {/* Weight Stats */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Body Metrics
          </h2>
          {weightStats.todaysWeight && isToday && (
            <button 
              onClick={() => openWeightModal(weightStats.todaysWeight!)} 
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
        </div>

        {/* Main Weight Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6 shadow-sm">
          {/* Background decoration */}
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
          <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full blur-xl" />
          
          <div className="relative z-10">
            {isToday && !weightStats.todaysWeight ? (
              // No weight logged today - CTA
              <button
                onClick={() => openWeightModal()}
                className="w-full flex flex-col items-center justify-center py-8 group"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors flex items-center justify-center mb-3">
                  <Scale size={28} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Log Today&apos;s Weight</h3>
                <p className="text-xs text-muted-foreground">Track your progress</p>
              </button>
            ) : (
              // Weight data display
              <div className="space-y-4">
                {/* Current Weight - Hero */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Scale size={16} className="text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Weight
                    </span>
                    {weightStats.todaysWeight && isToday && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold tracking-tight">
                      {weightStats.todaysWeight 
                        ? weightStats.todaysWeight.weight.toFixed(1) 
                        : (weightStats.current ? Number(weightStats.current).toFixed(1) : "-")
                      }
                    </span>
                    <span className="text-xl text-muted-foreground font-medium">kg</span>
                  </div>
                  {weightStats.lastLogged && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Last updated {new Date(weightStats.lastLogged).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                  )}
                </div>

                {/* BMI & Trend Grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {/* BMI Card */}
                  <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={14} className="text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        BMI
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-2xl font-bold tracking-tight",
                          !weightStats.bmi
                            ? "text-muted-foreground"
                            : Number(weightStats.bmi) < 18.5
                            ? "text-blue-400"
                            : Number(weightStats.bmi) < 25
                            ? "text-emerald-500"
                            : Number(weightStats.bmi) < 30
                            ? "text-amber-500"
                            : "text-rose-500"
                        )}
                      >
                        {weightStats.bmi || "-"}
                      </span>
                      {weightStats.bmi && (
                        <span className={cn(
                          "text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded",
                          Number(weightStats.bmi) < 18.5
                            ? "bg-blue-400/10 text-blue-400"
                            : Number(weightStats.bmi) < 25
                            ? "bg-emerald-500/10 text-emerald-500"
                            : Number(weightStats.bmi) < 30
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-rose-500/10 text-rose-500"
                        )}>
                          {Number(weightStats.bmi) < 18.5 ? "Low" : Number(weightStats.bmi) < 25 ? "Normal" : Number(weightStats.bmi) < 30 ? "High" : "Very High"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trend Card */}
                  <div className="bg-card/50 backdrop-blur-sm rounded-xl p-4 border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp size={14} className="text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        30-Day Change
                      </p>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span
                        className={cn(
                          "text-2xl font-bold tracking-tight",
                          weightStats.delta === null
                            ? "text-muted-foreground"
                            : weightStats.delta > 0
                            ? "text-amber-500"
                            : weightStats.delta < 0
                            ? "text-emerald-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {weightStats.delta !== null
                          ? (weightStats.delta > 0 ? "+" : "") + weightStats.delta.toFixed(1)
                          : "-"}
                      </span>
                      {weightStats.delta !== null && weightStats.delta !== 0 && (
                        <span className="text-xs text-muted-foreground">kg</span>
                      )}
                    </div>
                    {weightStats.deltaLabel && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        vs {weightStats.deltaLabel}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Log for different date button */}
        {!isToday && !weightStats.todaysWeight && (
          <button
            onClick={() => openWeightModal()}
            className="w-full py-3 rounded-xl border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-muted-foreground hover:text-primary text-sm font-medium"
          >
            <Plus size={16} />
            <span>Log weight for {displayDate.split(',')[0]}</span>
          </button>
        )}
      </section>

      {/* Workout Pages */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            Workouts
          </h2>
          <button
            onClick={() => setIsPageModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {pages.map((page, index) => {
            // Determine the styling based on cycle status:
            // - 'today': Yellow highlight (current workout for today, until done)
            // - 'done': Green checkmark (completed in this cycle)
            // - 'upcoming': The NEXT one after 'today' should be white/bright, rest are duller
            const todayIndex = pages.findIndex(p => p.cycleStatus === 'today');
            const isNextWorkout = page.cycleStatus === 'upcoming' && 
              (todayIndex === -1 ? index === 0 : index === todayIndex + 1 || (todayIndex === pages.length - 1 && index === 0));
            
            return (
            <Link
              key={page._id}
              href={`/health/${page._id}`}
              className={cn(
                "group p-4 rounded-xl transition-all flex items-center justify-between",
                page.cycleStatus === "today"
                  ? " border-l-4 border-l-amber-500 border-y border-r border-amber-500/30 shadow-sm"
                  : page.cycleStatus === "done"
                  ? " border border-emerald-500/30"
                  : isNextWorkout
                  ? "bg-card border border-border/60 shadow-sm"
                  : "bg-card/50 border border-border/20 opacity-60 hover:opacity-100"
              )}
            >
              <div className="flex items-center gap-3">
                {page.cycleStatus === "done" ? (
                   <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 size={16} />
                   </div>
                ) : page.cycleStatus === "today" ? (
                   <div className="p-2 rounded-full bg-amber-500/20 text-amber-500">
                      <Dumbbell size={16} />
                   </div>
                ) : isNextWorkout ? (
                   <div className="p-2 rounded-full bg-secondary text-foreground">
                      <Dumbbell size={16} />
                   </div>
                ) : (
                   <div className="p-2 rounded-full bg-secondary/50 text-muted-foreground">
                      <Dumbbell size={16} />
                   </div>
                )}
                
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      className={cn(
                        "font-medium text-sm",
                        page.cycleStatus === "today" ? "text-amber-500" :
                        page.cycleStatus === "done" ? "text-white/50" :
                        isNextWorkout ? "text-foreground/70 font-semibold" :
                        "text-muted-foreground"
                      )}
                    >
                      {page.title}
                    </h3>
                    {page.cycleStatus === "today" && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-amber-500 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        Today
                      </span>
                    )}
                    {/* {isNextWorkout && page.cycleStatus !== "today" && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-foreground bg-secondary px-1.5 py-0.5 rounded">
                        Next
                      </span>
                    )} */}
                  </div>
                  {page.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {page.description}
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight
                size={16}
                className="text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all"
              />
            </Link>
          )})}

          {pages.length === 0 && (
            <button
              onClick={() => setIsPageModalOpen(true)}
              className="py-12 rounded-xl border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary col-span-full"
            >
              <div className="p-3 rounded-full bg-secondary">
                  <Plus size={20} />
              </div>
              <span className="text-sm font-medium">Create Workout Plan</span>
            </button>
          )}
        </div>
      </section>

      {/* Weight Modal */}
      {isWeightModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border/50 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-6 border-b border-border/40">
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Scale size={24} className="text-primary" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-center">
                {editingWeightId ? "Update Weight" : "Log Weight"}
              </h3>
              <p className="text-xs text-center text-muted-foreground mt-1">
                {editingWeightId ? "Edit your weight entry" : "Track your body metrics"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogWeight} className="p-6 space-y-6">
              {!editingWeightId && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="date"
                      value={weightDate}
                      onChange={(e) => setWeightDate(e.target.value)}
                      className="w-full bg-secondary/50 hover:bg-secondary/70 transition-colors rounded-xl pl-9 pr-3 py-3 text-sm outline-none border border-border/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Weight
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="0.0"
                    autoFocus
                    className="w-full bg-secondary/50 hover:bg-secondary/70 transition-colors rounded-xl px-4 py-6 text-center text-4xl font-bold outline-none border border-border/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-semibold pointer-events-none">
                    kg
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsWeightModalOpen(false);
                    setEditingWeightId(null);
                    setWeightInput("");
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!weightInput || Number(weightInput) <= 0}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                >
                  {editingWeightId ? "Update" : "Save Weight"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Page Modal */}
      {isPageModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-xs p-6 rounded-2xl border border-border shadow-2xl animate-in zoom-in-95">
            <h3 className="text-md font-semibold mb-4 text-center">New Workout Plan</h3>
            <form onSubmit={handleCreatePage} className="space-y-4">
              <div>
                <input
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="Plan Name (e.g. Chest Day)"
                  autoFocus
                  className="w-full bg-secondary/50 rounded-lg px-4 py-3 text-sm outline-none border border-transparent focus:border-primary/50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPageModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-medium hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!pageTitle}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
