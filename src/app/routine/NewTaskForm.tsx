'use client';

import { useState } from 'react';
import { Plus, X, Upload, CalendarDays, Target } from 'lucide-react';
import { createTask, bulkCreateTasks } from '@/app/actions/routine';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = [
  { value: 0, label: 'S', fullLabel: 'Sunday' },
  { value: 1, label: 'M', fullLabel: 'Monday' },
  { value: 2, label: 'T', fullLabel: 'Tuesday' },
  { value: 3, label: 'W', fullLabel: 'Wednesday' },
  { value: 4, label: 'T', fullLabel: 'Thursday' },
  { value: 5, label: 'F', fullLabel: 'Friday' },
  { value: 6, label: 'S', fullLabel: 'Saturday' },
];

export default function NewTaskForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [mustDo, setMustDo] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [csvInput, setCsvInput] = useState(
    'Morning Run, health, morning, 5, 07:00, daily\nRead Book, learning, evening, 3, , weekdays\nFamily Call, social, night, 2, , sun|sat'
  );
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);

  const toggleDay = (day: number) => {
    setCustomDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    
    // Append boolean flags
    formData.append('mustDo', mustDo.toString());
    formData.append('recurrenceType', recurrenceType);
    formData.append('recurrenceDays', JSON.stringify(customDays));
    // Pass client timezone
    formData.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);

    await createTask(formData);
    
    // Reset form
    setIsPending(false);
    setIsOpen(false);
    setMustDo(false);
    setRecurrenceType('daily');
    setCustomDays([]);
  }

  async function handleBulkImport() {
    setIsPending(true);
    const lines = csvInput.split('\n').filter(l => l.trim());
    const tasks = lines.map((line, index) => {
      const [title, domainId, timeOfDay, basePoints, startTime, recurrence, order] = line.split(',').map(s => s.trim());
      
      // Parse recurrence: daily, weekdays, weekends, or custom days like "0,1,3,5"
      let recurrenceType = 'daily';
      let recurrenceDays: number[] = [];
      
      if (recurrence) {
        const lowerRecurrence = recurrence.toLowerCase();
        if (lowerRecurrence === 'daily') {
          recurrenceType = 'daily';
        } else if (lowerRecurrence === 'weekdays' || lowerRecurrence === 'mon-fri') {
          recurrenceType = 'weekdays';
        } else if (lowerRecurrence === 'weekends' || lowerRecurrence === 'sat-sun') {
          recurrenceType = 'weekends';
        } else {
          // Assume custom days like "0|1|3" or "mon|wed|fri"
          recurrenceType = 'custom';
          const dayMap: Record<string, number> = {
            'sun': 0, 'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4, 'fri': 5, 'sat': 6,
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
          };
          recurrenceDays = recurrence.split('|').map(d => dayMap[d.toLowerCase().trim()]).filter(d => d !== undefined);
        }
      }
      
      return {
        title,
        domainId: domainId || 'health',
        timeOfDay: timeOfDay || 'none',
        basePoints: basePoints || 1,
        startTime: startTime || null,
        recurrenceType,
        recurrenceDays,
        order: order ? Number(order) : index
      };
    });

    await bulkCreateTasks(tasks);
    setIsPending(false);
    setIsOpen(false);
    setShowBulkImport(false);
    setRecurrenceType('daily');
    setCustomDays([]);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 font-medium"
      >
        <Plus size={20} />
        Add New Habit
      </button>
    );
  }

  return (
    <form action={handleSubmit} className="p-6 rounded-3xl bg-card border border-border shadow-lg space-y-6 animate-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">New Routine Item</h3>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => setShowBulkImport(!showBulkImport)}
            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-primary"
          >
            <Upload size={14} /> Bulk Import
          </button>
          <button type="button" onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>
      </div>

      {showBulkImport ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
          <div className="p-4 bg-secondary/30 rounded-xl space-y-3 border border-border/50">
            <label className="text-xs font-medium text-muted-foreground">
              Format: Title, Domain, TimeOfDay, Points, StartTime, Recurrence
            </label>
            <p className="text-[10px] text-muted-foreground/70">
              Recurrence: daily, weekdays, weekends, or custom days (sun|mon|tue|wed|thu|fri|sat)
            </p>
            <textarea
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              className="w-full h-32 rounded-xl border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <button
              type="button"
              onClick={handleBulkImport}
              disabled={isPending}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
            >
              {isPending ? 'Importing...' : 'Parse & Create Tasks'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground ml-1">Title</label>
            <input
              name="title"
              required
              placeholder="e.g. Morning Workout"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground ml-1">Domain</label>
            <select
              name="domainId"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
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

          <div>
            <label className="text-xs font-medium text-muted-foreground ml-1">Time of Day</label>
            <select
              name="timeOfDay"
              className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="none">Any Time</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
              <option value="night">Night</option>
              <option value="day">Day</option>
            </select>
          </div>
        </div>

        {/* Must Do Toggle */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <label className="flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Target size={18} />
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

        {/* Recurrence Settings */}
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
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
                    "w-9 h-9 rounded-full text-xs font-medium transition-colors border",
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

        {/* Fixed Points Input */}
        <div className="animate-in fade-in slide-in-from-top-2">
          <label className="text-xs font-medium text-muted-foreground ml-1">Points on Completion</label>
          <input
            name="basePoints"
            type="number"
            defaultValue={5}
            min={1}
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
        >
          {isPending ? 'Creating...' : 'Create Routine Item'}
        </button>
      </div>
      )}
    </form>
  );
}
