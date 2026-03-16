'use client';

import { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, CalendarDays, ChevronLeft, ChevronRight, XCircle, RotateCcw } from 'lucide-react';
import TaskItem from './TaskItem';
import { updateTaskOrder, getRoutine, getRoutineForDate } from '@/app/actions/routine';
import { cn } from '@/lib/utils';
import { getLocalDateString, addDays, formatDateForDisplay, getDayOfWeek } from '@/lib/date-utils';
import { withRxDB } from '@/lib/rxdb/actions';
import { COLLECTION_NAMES } from '@/lib/rxdb';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

// Helper to check if task should show on a day
function shouldShowTaskOnDay(task: any, dayOfWeek: number): boolean {
  const recurrenceType = task.recurrenceType || 'daily';
  
  switch (recurrenceType) {
    case 'daily':
      return true;
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'custom':
      return (task.recurrenceDays || []).includes(dayOfWeek);
    default:
      return true;
  }
}

// Sortable Wrapper for TaskItem
function SortableTaskItem({ task, dateStr, editMode }: { task: any; dateStr?: string; editMode?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  // In edit mode, pass drag handle props to TaskItem so only the drag handle captures drag events
  const dragHandleProps = editMode ? { ...attributes, ...listeners } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn(isDragging ? 'opacity-50' : '')}
    >
      <TaskItem task={task} dateStr={dateStr} editMode={editMode} dragHandleProps={dragHandleProps} />
    </div>
  );
}

interface RoutineListProps {
  initialTasks: any[];
  allTasks?: any[];
  initialSpecialTasks?: any[];
}

export default function RoutineList({ initialTasks, allTasks = [], initialSpecialTasks = [] }: RoutineListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [specialTasks, setSpecialTasks] = useState(initialSpecialTasks);
  const [viewMode, setViewMode] = useState<'today' | 'custom'>('today');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  
  // Custom date picker state
  const [customDate, setCustomDate] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isLoadingCustom, setIsLoadingCustom] = useState(false);
  
  // Get today's date in user's local timezone as YYYY-MM-DD using dayjs
  const todayIST = getLocalDateString();
  
  // Get current day of week in client timezone using dayjs
  const todayDayOfWeek = getDayOfWeek(todayIST);

  // Format date for display using dayjs-based utility
  const formatDateDisplay = (dateStr: string) => {
    return formatDateForDisplay(dateStr, { showTodayYesterday: true, format: 'short' });
  };

  // Navigate to previous/next day using dayjs-based utility
  const navigateDay = (direction: 'prev' | 'next') => {
    const currentDateStr = customDate || todayIST;
    const newDateStr = addDays(currentDateStr, direction === 'next' ? 1 : -1);
    
    // Don't allow future dates
    if (newDateStr > todayIST) return;
    
    setCustomDate(newDateStr);
    fetchCustomDate(newDateStr);
  };

  // Fetch tasks for custom date
  const fetchCustomDate = async (dateStr: string) => {
    setIsLoadingCustom(true);
    try {
      console.log('[RoutineList] Fetching custom date:', dateStr);
      const { routine: customTasks, specialTasks: customSpecial } = await getRoutineForDate(dateStr);
      console.log('[RoutineList] Custom date result:', { tasksCount: customTasks.length, specialTasksCount: customSpecial.length });
      console.log('[RoutineList] Special tasks received:', customSpecial);
      setTasks(customTasks);
      setSpecialTasks(customSpecial);
    } finally {
      setIsLoadingCustom(false);
    }
  };

  // Handle date picker change
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value;
    if (selectedDate > todayIST) return; // Don't allow future dates
    
    setCustomDate(selectedDate);
    setIsDatePickerOpen(false);
    fetchCustomDate(selectedDate);
  };

  // Switch to custom mode
  const switchToCustom = () => {
    setViewMode('custom');
    if (!customDate) {
      // Default to yesterday using dayjs-based utility
      const yesterdayStr = addDays(todayIST, -1);
      setCustomDate(yesterdayStr);
      fetchCustomDate(yesterdayStr);
    }
  };

  // Switch to today mode
  const switchToToday = async () => {
    setViewMode('today');
    console.log('[RoutineList] Switching to today view');
    // Refetch today's tasks
    const fetchToday = async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('[RoutineList] Fetching today with timezone:', timezone);
      const { routine: todaysTasks, specialTasks: todaysSpecial } = await getRoutine(timezone);
      console.log('[RoutineList] Today result:', { tasksCount: todaysTasks.length, specialTasksCount: todaysSpecial.length });
      console.log('[RoutineList] Today special tasks:', todaysSpecial);
      setTasks(todaysTasks);
      setSpecialTasks(todaysSpecial);
    };
    fetchToday();
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (viewMode === 'today') {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const { routine: todaysTasks, specialTasks: todaysSpecial } = await getRoutine(timezone);
        setTasks(todaysTasks);
        setSpecialTasks(todaysSpecial);
      } else if (customDate) {
        await fetchCustomDate(customDate);
      }
    } catch (error) {
      console.error('Failed to refresh routine:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Re-fetch tasks with correct timezone on mount
  useEffect(() => {
    const fetchWithTimezone = async () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const { routine: todaysTasks, specialTasks: todaysSpecial } = await getRoutine(timezone);
      setTasks(todaysTasks);
      setSpecialTasks(todaysSpecial);
    };
    fetchWithTimezone();
  }, []);

  // Sync with server data if it changes (e.g. new task added)
  useEffect(() => {
    console.log('[RoutineList] Initial tasks updated:', { tasksCount: initialTasks.length, specialTasksCount: initialSpecialTasks.length });
    console.log('[RoutineList] Initial special tasks:', initialSpecialTasks);
    setTasks(initialTasks);
    setSpecialTasks(initialSpecialTasks);
  }, [initialTasks, initialSpecialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Hold 200ms before drag activates
        tolerance: 5, // Allow 5px movement during delay (for scroll)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const currentList = viewMode === 'today' ? tasks : allTasks;
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item._id === active.id);
        const newIndex = items.findIndex((item) => item._id === over.id);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Trigger server update with sync
        const orderUpdates = newItems.map((item, index) => ({
          id: item._id,
          order: index
        }));
        withRxDB(() => updateTaskOrder(orderUpdates), { syncCollections: [COLLECTION_NAMES.TASKS] });

        return newItems;
      });
    }
  }

  // Use allTasks when in 'all' view mode
  const displayTasks = tasks;

  const filteredTasks = displayTasks.filter(task => {
    const taskTime = task.timeOfDay || 'none';
    const matchesTime = timeFilter === 'all' || taskTime === timeFilter;
    
    return matchesTime;
  });

  // Sort tasks: pending first, then skipped, then completed
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const statusOrder = { pending: 0, undefined: 0, skipped: 1, completed: 2 };
    const aStatus = a.log?.status || 'pending';
    const bStatus = b.log?.status || 'pending';
    return (statusOrder[aStatus as keyof typeof statusOrder] || 0) - (statusOrder[bStatus as keyof typeof statusOrder] || 0);
  });

  // Separate skipped tasks for display
  const pendingAndCompletedTasks = sortedTasks.filter(t => t.log?.status !== 'skipped');
  const skippedTasks = sortedTasks.filter(t => t.log?.status === 'skipped');

  return (
    <div className="space-y-6 pb-20">      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Routine</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(
              "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all",
              isRefreshing && "animate-spin"
            )}
            title="Refresh data"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>      {/* Minimal Header with View Toggle */}
      <div className="flex items-center justify-between gap-3">
        {/* View Mode Toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/30 flex-1 sm:flex-initial">
          <button
            onClick={switchToToday}
            className={cn(
              "flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-medium transition-all",
              viewMode === 'today' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Today
          </button>
          <button
            onClick={switchToCustom}
            className={cn(
              "flex-1 sm:flex-initial px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5",
              viewMode === 'custom' 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays size={12} />
            Custom
          </button>
        </div>

        {/* Edit Mode Toggle */}
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
            editMode
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background text-muted-foreground border-border hover:border-primary/50"
          )}
        >
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Always Visible Time Filter - Minimal & Pretty */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {['all', 'morning', 'afternoon', 'evening', 'night'].map((time) => (
          <button
            key={time}
            onClick={() => setTimeFilter(time)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize whitespace-nowrap",
              timeFilter === time 
                ? "bg-primary/20 text-primary ring-1 ring-primary/30" 
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}
          >
            {time}
          </button>
        ))}
      </div>

      {/* Custom Date Navigator */}
      {viewMode === 'custom' && (
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-secondary/30 border border-border/50">
          <button
            onClick={() => navigateDay('prev')}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex-1 text-center relative">
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="px-4 py-1.5 rounded-lg hover:bg-secondary transition-colors font-medium flex items-center gap-2 mx-auto"
            >
              <CalendarDays size={14} className="text-primary" />
              {customDate ? formatDateDisplay(customDate) : 'Select date'}
            </button>
            
            {isDatePickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsDatePickerOpen(false)} />
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-20 bg-card border border-border rounded-xl shadow-xl p-3 animate-in zoom-in-95">
                  <input
                    type="date"
                    value={customDate}
                    onChange={handleDateChange}
                    max={todayIST}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 scheme-dark"
                  />
                </div>
              </>
            )}
          </div>
          
          <button
            onClick={() => navigateDay('next')}
            disabled={customDate >= todayIST}
            className={cn(
              "p-2 rounded-lg transition-colors",
              customDate >= todayIST
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Loading indicator for custom date */}
      {isLoadingCustom && (
        <div className="text-center py-2">
          <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
        </div>
      )}

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={pendingAndCompletedTasks.map(t => t._id)} 
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {pendingAndCompletedTasks.map((task) => (
              <SortableTaskItem key={task._id} task={task} dateStr={customDate || todayIST} editMode={editMode} />
            ))}
            {pendingAndCompletedTasks.length === 0 && skippedTasks.length === 0 && (
                <div className="text-center py-10 text-muted-foreground text-sm">
                    {viewMode === 'today' 
                      ? "No tasks scheduled for today. Add a new habit!"
                      : `No tasks scheduled for ${customDate ? formatDateDisplay(customDate) : 'this day'}.`
                    }
                </div>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Special Tasks Section (Auto-completed from logs) */}
      {specialTasks.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-medium text-muted-foreground mb-3 px-1 flex items-center gap-2 uppercase tracking-widest">
            <span>Completed Elsewhere</span>
            <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[10px]">
              {specialTasks.length}
            </span>
          </p>
          <div className="space-y-2 opacity-80">
            {specialTasks.map((task) => (
              <div
                key={task._id}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40"
              >
                <div className="p-2 rounded-lg bg-secondary/50">
                  <span className="text-lg">
                    {task.type === 'health' ? '💪' : task.type === 'books' ? '📚' : '🧠'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold">
                      +{task.points} pts
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.source}</p>
                </div>
                <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                   <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped Tasks Section - Cleaned up */}
      {skippedTasks.length > 0 && (
        <div className="mt-6 pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-3 px-1 flex items-center gap-2 uppercase tracking-widest">
            <span>Skipped</span>
            <span className="px-1.5 py-0.5 rounded-full bg-secondary text-[10px]">
              {skippedTasks.length}
            </span>
          </p>
          <div className="space-y-2">
            {skippedTasks.map((task) => (
              <div key={task._id} className="opacity-60">
                 <TaskItem task={task} dateStr={customDate || todayIST} editMode={editMode} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
