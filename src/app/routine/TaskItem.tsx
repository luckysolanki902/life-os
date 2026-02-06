'use client';

import { useState, useCallback } from 'react';
import { Check, Edit2, Trash2, X, CalendarDays, SkipForward, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { completeTask, uncompleteTask, updateTask, deleteTask, skipTask, unskipTask } from '@/app/actions/routine';
import { getLocalDateString } from '@/lib/date-utils';
import { hapticTaskComplete, hapticTaskSkip, hapticTaskUnskip, hapticTaskUncomplete } from '@/lib/haptics';
import SwipeableTask from '@/components/SwipeableTask';
import { withFullRefresh } from '@/lib/action-wrapper';
import { 
  markTaskCompleted, 
  markTaskSkipped, 
  markTaskPending,
  removeTaskFromIncomplete
} from '@/lib/reactive-cache';

const DAYS_OF_WEEK = [
  { value: 0, label: 'S', fullLabel: 'Sunday' },
  { value: 1, label: 'M', fullLabel: 'Monday' },
  { value: 2, label: 'T', fullLabel: 'Tuesday' },
  { value: 3, label: 'W', fullLabel: 'Wednesday' },
  { value: 4, label: 'T', fullLabel: 'Thursday' },
  { value: 5, label: 'F', fullLabel: 'Friday' },
  { value: 6, label: 'S', fullLabel: 'Saturday' },
];

function getRecurrenceLabel(task: any) {
  const type = task.recurrenceType || 'daily';
  if (type === 'daily') return 'Daily';
  if (type === 'weekdays') return 'Mon-Fri';
  if (type === 'weekends') return 'Sat-Sun';
  if (type === 'custom' && task.recurrenceDays?.length > 0) {
    return task.recurrenceDays.map((d: number) => DAYS_OF_WEEK[d].label).join('');
  }
  return 'Daily';
}

interface TaskItemProps {
  task: any;
  onOptimisticToggle?: (taskId: string, newStatus: boolean) => void;
  dateStr?: string; // Optional date override (for historical views)
  editMode?: boolean; // Show edit controls only when in edit mode
}

export default function TaskItem({ task, onOptimisticToggle, dateStr, editMode = false }: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  // Optimistic state for completion
  const [optimisticCompleted, setOptimisticCompleted] = useState<boolean | null>(null);
  const [optimisticSkipped, setOptimisticSkipped] = useState<boolean | null>(null);
  
  // Edit form state
  const [title, setTitle] = useState(task.title);
  const [domainId, setDomainId] = useState(task.domainId);
  const [timeOfDay, setTimeOfDay] = useState(task.timeOfDay || 'none');
  const [basePoints, setBasePoints] = useState(task.basePoints || 5);
  const [mustDo, setMustDo] = useState(task.mustDo || false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>(
    task.recurrenceType || 'daily'
  );
  const [customDays, setCustomDays] = useState<number[]>(task.recurrenceDays || []);

  // Get the target date for this task (from prop or current date)
  const targetDate = dateStr || getLocalDateString();

  // Use optimistic state if set, otherwise use server state
  const isCompleted = optimisticCompleted !== null 
    ? optimisticCompleted 
    : task.log?.status === 'completed';
  
  const isSkipped = optimisticSkipped !== null
    ? optimisticSkipped
    : task.log?.status === 'skipped';

  const handleToggle = useCallback(async () => {
    if (isToggling) {
      return;
    }
    
    const newStatus = !isCompleted;
    
    setIsToggling(true);
    
    // INSTANT haptic feedback - before anything else
    if (newStatus) {
      hapticTaskComplete();
    } else {
      hapticTaskUncomplete();
    }
    
    // Optimistic update - instant UI change
    setOptimisticCompleted(newStatus);
    setOptimisticSkipped(false); // Clear skipped state when completing
    
    // Update reactive cache immediately
    if (newStatus) {
      markTaskCompleted(task._id);
      removeTaskFromIncomplete(task._id);
    } else {
      markTaskPending(task._id);
    }
    
    // Notify parent for list-level optimistic update
    onOptimisticToggle?.(task._id, newStatus);
    
    try {
      // Use withFullRefresh to auto-sync
      if (!newStatus) {
        await withFullRefresh(() => uncompleteTask(task._id, targetDate));
      } else {
        await withFullRefresh(() => completeTask(task._id, targetDate));
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle task:', error);
      setOptimisticCompleted(!newStatus);
    } finally {
      setIsToggling(false);
    }
  }, [isToggling, isCompleted, task._id, targetDate, onOptimisticToggle]);

  const handleSkip = useCallback(async () => {
    if (isSkipping) {
      return;
    }
    
    const newSkipStatus = !isSkipped;
    
    setIsSkipping(true);
    
    // INSTANT haptic feedback - before anything else
    if (newSkipStatus) {
      hapticTaskSkip();
    } else {
      hapticTaskUnskip();
    }
    
    // Optimistic update - instant UI change
    setOptimisticSkipped(newSkipStatus);
    setOptimisticCompleted(false); // Clear completed state when skipping
    
    // Update reactive cache immediately
    if (newSkipStatus) {
      markTaskSkipped(task._id);
    } else {
      markTaskPending(task._id);
    }
    
    try {
      // Use withFullRefresh to auto-sync
      if (newSkipStatus) {
        await withFullRefresh(() => skipTask(task._id, targetDate));
      } else {
        await withFullRefresh(() => unskipTask(task._id, targetDate));
      }
    } catch (error) {
      // Revert on error
      console.error('Failed to skip task:', error);
      setOptimisticSkipped(!newSkipStatus);
    } finally {
      setIsSkipping(false);
    }
  }, [isSkipping, isSkipped, task._id, targetDate]);

  const toggleDay = (day: number) => {
    setCustomDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    setIsPending(true);
    await updateTask(task._id, {
      title,
      domainId,
      timeOfDay,
      basePoints,
      mustDo,
      recurrenceType,
      recurrenceDays: customDays,
    });
    setIsPending(false);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    setIsPending(true);
    await deleteTask(task._id);
    setIsPending(false);
  };

  const handleCancel = () => {
    // Reset to original values
    setTitle(task.title);
    setDomainId(task.domainId);
    setTimeOfDay(task.timeOfDay || 'none');
    setBasePoints(task.basePoints || 5);
    setMustDo(task.mustDo || false);
    setRecurrenceType(task.recurrenceType || 'daily');
    setCustomDays(task.recurrenceDays || []);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4 rounded-2xl bg-card border border-primary/30 shadow-lg space-y-4 animate-in zoom-in-95">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-sm">Edit Task</h3>
          <button type="button" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Domain */}
        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1">Domain</label>
          <select
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="health">Health</option>
            <option value="career">Career</option>
            <option value="learning">Learning</option>
            <option value="startups">Startups</option>
            <option value="social">Social</option>
            <option value="discipline">Discipline</option>
            <option value="personality">Personality</option>
          </select>
        </div>

        {/* Time of Day */}
        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1">Time of Day</label>
          <select
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">Any Time</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
            <option value="day">Day</option>
          </select>
        </div>

        {/* Points */}
        <div>
          <label className="text-xs font-medium text-muted-foreground ml-1">Points</label>
          <input
            type="number"
            value={basePoints}
            onChange={(e) => setBasePoints(Number(e.target.value))}
            min={1}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Must Do Toggle */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Target size={16} />
              </div>
              <div>
                <span className="text-sm font-medium">Must Do</span>
                <p className="text-xs text-muted-foreground">High priority task</p>
              </div>
            </div>
            <div className="relative inline-flex items-center">
              <input 
                type="checkbox" 
                checked={mustDo}
                onChange={(e) => setMustDo(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-muted-foreground after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-checked:after:bg-primary-foreground"></div>
            </div>
          </label>
        </div>

        {/* Recurrence */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Repeat</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {(['daily', 'weekdays', 'weekends', 'custom'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRecurrenceType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize border",
                  recurrenceType === type 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background text-muted-foreground border-border hover:border-primary/50"
                )}
              >
                {type === 'weekdays' ? 'Mon-Fri' : type === 'weekends' ? 'Sat-Sun' : type}
              </button>
            ))}
          </div>

          {recurrenceType === 'custom' && (
            <div className="flex gap-1 animate-in slide-in-from-top-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  title={day.fullLabel}
                  className={cn(
                    "w-8 h-8 rounded-full text-xs font-medium transition-colors border",
                    customDays.includes(day.value)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="px-4 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Main task card - wrap with swipeable when not in edit mode
  const taskCard = (
    <div className={cn(
      "group relative rounded-2xl border transition-all duration-300 overflow-hidden",
      isCompleted 
        ? "bg-secondary/30 border-transparent opacity-60" 
        : isSkipped
        ? "bg-card border-border/30"
        : task.mustDo
        ? "bg-gradient-to-br from-primary/5 to-transparent border-2 border-primary/30 hover:border-primary/50 shadow-sm hover:shadow-md"
        : "bg-card border-border/50"
    )}>
      {/* Must Do Accent Bar */}
      {task.mustDo && !isCompleted && !isSkipped && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/70 to-primary/40" />
      )}
      
      {/* Main Row */}
      <div className="p-4 flex items-center gap-4">
        {/* Checkbox / Status - show in non-edit mode only */}
        {!editMode && (
          <button
            onClick={isSkipped ? handleSkip : handleToggle}
            className={cn(
              "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 shrink-0",
              isCompleted
                ? "bg-primary border-primary text-primary-foreground"
                : isSkipped
                ? "border-muted-foreground/30 hover:border-primary"
                : task.mustDo
                ? "border-primary/50 bg-primary/10 hover:bg-primary/20"
                : "border-muted-foreground/30 hover:border-primary"
            )}
          >
            {isCompleted && <Check size={14} strokeWidth={3} />}
          </button>
        )}

        {/* Content - show longer text */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "font-medium transition-all",
            task.mustDo && !isCompleted && !isSkipped && "font-semibold",
            isCompleted && "line-through text-muted-foreground",
            isSkipped && "text-muted-foreground"
          )} style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {task.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className={cn(
              "px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wider text-[10px]",
               task.domainId === 'health' ? "text-rose-500 bg-rose-500/10" :
               task.domainId === 'career' ? "text-blue-500 bg-blue-500/10" :
               task.domainId === 'learning' ? "text-amber-500 bg-amber-500/10" :
               task.domainId === 'discipline' ? "text-purple-500 bg-purple-500/10" :
               "bg-secondary text-muted-foreground"
            )}>
              {task.domainId}
            </span>
            {task.timeOfDay && task.timeOfDay !== 'none' && (
              <span className="px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground capitalize text-[10px]">
                {task.timeOfDay}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded-md bg-secondary/50 text-muted-foreground/70 text-[10px]">
              {getRecurrenceLabel(task)}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span>{task.basePoints} pts</span>
          </div>
        </div>

        {/* Action Buttons */}
        {!editMode && (
          <>
            {/* Skip Button - only show when not completed */}
            {!isCompleted && (
              <button
                onClick={handleSkip}
                className={cn(
                  "p-2 rounded-lg transition-all active:scale-90 shrink-0",
                  isSkipped
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary"
                )}
                title={isSkipped ? "Undo skip" : "Skip task"}
              >
                <SkipForward size={16} />
              </button>
            )}
            
            {/* Edit Button - always visible */}
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary transition-all active:scale-90 shrink-0"
              title="Edit task"
            >
              <Edit2 size={16} />
            </button>
          </>
        )}

        {/* Edit Button - show in edit mode with drag handle styling */}
        {editMode && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all shrink-0"
            title="Edit task"
          >
            <Edit2 size={16} />
          </button>
        )}
      </div>
    </div>
  );

  // Only wrap with swipeable if not in edit mode and not completed/skipped already
  if (!editMode && !isCompleted && !isSkipped) {
    return (
      <SwipeableTask
        onSwipeLeft={() => handleToggle()}
        onSwipeRight={() => handleSkip()}
      >
        {taskCard}
      </SwipeableTask>
    );
  }

  return taskCard;
}
