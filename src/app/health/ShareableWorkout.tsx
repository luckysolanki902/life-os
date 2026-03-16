'use client';

import { useState, useRef } from 'react';
import { Scale, X, Flame, Leaf, Share2, Dumbbell } from 'lucide-react';
import { getTodaysWorkoutSummary } from '@/app/actions/health';
import { cn } from '@/lib/utils';
import { shareImage } from '@/lib/share';
import { getBetterPercentage } from '@/lib/better';

// Rest day logic: Alternate day is fine - if yesterday had exercise, today can be rest

interface WorkoutSummary {
  date: string;
  userName: string;
  exercises: Array<{
    _id: string;
    title: string;
    type: string;
    targetMuscles: string[];
    pageName: string;
    sets: Array<{
      weight: number;
      reps: number;
      duration?: number;
    }>;
  }>;
  exercisesByPage: Record<string, Array<{
    _id: string;
    title: string;
    type: string;
    targetMuscles: string[];
    pageName: string;
    sets: Array<{
      weight: number;
      reps: number;
      duration?: number;
    }>;
  }>>;
  muscleCount: Record<string, number>;
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  weight: {
    current: number | null;
    deltaFromLast: number | null;
    deltaFromFirst: number | null;
    bmi: number | null;
    firstWeight: number | null;
  };
  mood: { mood: 'great' | 'good' | 'okay' | 'low' | 'bad'; note?: string } | null;
  meditationDone: boolean;
  streakData: {
    currentStreak: number;
    last7Days: { date: string; valid: boolean; isRestDay?: boolean }[];
    todayValid: boolean;
    todayRoutineTasks: number;
    todayIsRestDay?: boolean;
  };
  totalPoints: number;
  isRestDay?: boolean;
}

interface ShareableWorkoutProps {
  canShare: boolean;
  hasWeight: boolean;
  isRestDay?: boolean;
}

// Format exercise for display: "Pushups (3x12x4kg)" or "Headstand (120s)"
function formatExercise(ex: { title: string; type: string; sets: Array<{ weight: number; reps: number; duration?: number }> }): string {
  const sets = ex.sets.length;
  if (ex.type === 'duration') {
    const totalDuration = ex.sets.reduce((acc, s) => acc + (s.duration || s.reps || 0), 0);
    return `${ex.title} (${totalDuration}s)`;
  }
  const avgReps = Math.round(ex.sets.reduce((acc, s) => acc + s.reps, 0) / sets);
  const maxWeight = Math.max(...ex.sets.map(s => s.weight || 0));
  if (maxWeight > 0) {
    return `${ex.title} (${sets}x${avgReps}x${maxWeight}kg)`;
  }
  return `${ex.title} (${sets}x${avgReps})`;
}

// Get day abbreviation
function getDayAbbr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })[0];
}

// Mood configurations
const moodConfig = {
  great: { label: 'Feeling Great', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', emoji: '😁' },
  good: { label: 'Feeling Good', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', emoji: '😊' },
  okay: { label: 'Doing Okay', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', emoji: '🙂' },
  low: { label: 'Feeling Low', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', emoji: '😔' },
  bad: { label: 'Rough Day', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', emoji: '😞' }
};

export default function ShareableWorkout({ canShare, hasWeight, isRestDay = false }: ShareableWorkoutProps) {
  console.log('canShare:', canShare, 'hasWeight:', hasWeight, 'isRestDay:', isRestDay);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleOpen() {
    setIsOpen(true);
    setIsLoading(true);
    try {
      const data = await getTodaysWorkoutSummary();
      
      setSummary(data as WorkoutSummary);
      console.log(data.weight);
    } catch (error) {
      console.error('Failed to load workout summary:', error);
    }
    setIsLoading(false);
  }

  async function handleExport() {
    if (!cardRef.current) return;
    
    setIsExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      
      // Temporarily set fixed width on the original element
      const originalWidth = cardRef.current.style.width;
      const originalMaxWidth = cardRef.current.style.maxWidth;
      cardRef.current.style.width = '600px';
      cardRef.current.style.maxWidth = '600px';
      
      // Wait for layout to update
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Export with fixed dimensions
      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 3,
        width: 600
      });
      
      // Restore original styles
      cardRef.current.style.width = originalWidth;
      cardRef.current.style.maxWidth = originalMaxWidth;
      
      // Create canvas from blob for sharing
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      
      const filename = `lifeos-${new Date().toLocaleDateString('en-CA')}`;
      const result = await shareImage(canvas, filename);
      
      if (!result.success && result.error !== 'Share cancelled') {
        alert('Export failed. Please try again.');
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
    setIsExporting(false);
  }

  const formattedDate = summary ? new Date(summary.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : '';

  // Calculate improvement percentage using the proper function
  const improvementPercent = summary ? getBetterPercentage(summary.totalPoints) : 0;

  return (
    <>
      {/* Share Button - Minimal */}
      <button
        onClick={handleOpen}
        disabled={!canShare}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all",
          canShare 
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-secondary text-muted-foreground cursor-not-allowed opacity-50"
        )}
        title={!canShare ? `Need ${isRestDay ? 'last 2 days with 5+ exercises each' : 'at least 5 exercises logged'}${!hasWeight ? ' and weight logged' : ''}` : 'Share'}
      >
        <Share2 size={16} />
        Share
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto ">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-semibold">Share Summary</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="p-12 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            )}

            {/* Shareable Card Preview */}
            {!isLoading && summary && (
              <>
                <div className="p-4">
                  <div 
                    ref={cardRef}
                    style={{
                      width: '600px',
                      maxWidth: '100%',
                      margin: '0 auto',
                      background: 'linear-gradient(135deg, #fff1f2 0%, #fce7f3 50%, #fae8ff 100%)',
                      borderRadius: '24px',
                      padding: '24px',
                      color: '#1f2937',
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      border: '2px solid #fbcfe8',
                      boxSizing: 'border-box',
                      boxShadow: '0 8px 32px rgba(236, 72, 153, 0.15)'
                    }}
                  >
                    {/* Weight Card */}
                    {summary.weight.current && (
                      <div style={{ 
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'white', 
                        borderRadius: '20px', 
                        padding: '20px',
                        marginBottom: '16px',
                        border: '2px solid #fbcfe8',
                        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)'
                      }}>
                        <div style={{ marginBottom: '14px', display: 'table', width: '100%' }}>
                          <div style={{ display: 'table-cell', width: '54px', verticalAlign: 'middle' }}>
                            <div style={{ 
                              width: '42px', 
                              height: '42px', 
                              borderRadius: '12px', 
                              background: 'linear-gradient(135deg, #ec4899, #f43f5e)', 
                              position: 'relative'
                            }}>
                              <div style={{ position: 'absolute', top: '11px', left: '11px', width: '20px', height: '20px' }}>
                                <Scale size={20} style={{ color: 'white' }} />
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                            <span style={{ 
                              fontSize: '32px', 
                              fontWeight: '800', 
                              color: '#ec4899',
                              letterSpacing: '-0.5px'
                            }}>
                              {summary.weight.current}
                            </span>
                            <span style={{ 
                              fontSize: '16px', 
                              fontWeight: '500', 
                              color: '#9ca3af', 
                              marginLeft: '6px'
                            }}>kg</span>
                          </div>
                        </div>
                        
                        <div>
                          {summary.weight.deltaFromLast !== null && summary.weight.deltaFromLast !== 0 && (
                            <span style={{ 
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '12px',
                              marginRight: '8px',
                              marginBottom: '8px',
                              background: summary.weight.deltaFromLast < 0 ? '#d1fae5' : summary.weight.deltaFromLast > 0 ? '#fee2e2' : '#f3f4f6',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: summary.weight.deltaFromLast < 0 ? '#059669' : summary.weight.deltaFromLast > 0 ? '#dc2626' : '#6b7280'
                            }}>
                              {summary.weight.deltaFromLast > 0 ? '+' : ''}{summary.weight.deltaFromLast} from last
                            </span>
                          )}
                          {summary.weight.deltaFromFirst !== null && summary.weight.deltaFromFirst !== 0 && (
                            
                            <span style={{ 
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '12px',
                              marginRight: '8px',
                              marginBottom: '8px',
                              background: summary.weight.deltaFromFirst < 0 ? '#d1fae5' : summary.weight.deltaFromFirst > 0 ? '#fee2e2' : '#f3f4f6',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: summary.weight.deltaFromFirst < 0 ? '#059669' : summary.weight.deltaFromFirst > 0 ? '#dc2626' : '#6b7280'
                            }}>
                              {summary.weight.deltaFromFirst > 0 ? '+' : ''}{summary.weight.deltaFromFirst} total
                            </span>
                          )}
                          {summary.weight.bmi && (
                            <span style={{ 
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '12px',
                              marginBottom: '8px',
                              background: '#fae8ff',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#a855f7'
                            }}>
                              BMI {summary.weight.bmi}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Streak Card */}
                    <div style={{ 
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'white', 
                      borderRadius: '20px', 
                      padding: '20px',
                      marginBottom: '16px',
                      border: '2px solid #fbcfe8',
                      boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)'
                    }}>
                      {/* Streak Header */}
                      <div style={{ marginBottom: '16px', display: 'table', width: '100%' }}>
                        <div style={{ display: 'table-cell', width: '56px', verticalAlign: 'middle' }}>
                          <div style={{ 
                            width: '44px', 
                            height: '44px', 
                            borderRadius: '12px', 
                            background: summary.streakData.currentStreak > 0 ? 'linear-gradient(135deg, #f97316, #fb923c)' : '#f3f4f6',
                            position: 'relative'
                          }}>
                            <div style={{ position: 'absolute', top: '11px', left: '11px', width: '22px', height: '22px' }}>
                              <Flame size={22} style={{ color: summary.streakData.currentStreak > 0 ? 'white' : '#9ca3af' }} />
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '26px', fontWeight: '800', color: '#ec4899', lineHeight: '1' }}>
                            {summary.streakData.currentStreak}
                          </div>
                          <div style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '500', marginTop: '4px' }}>day streak</div>
                        </div>
                        {/* <div style={{ display: 'table-cell', width: '80px', verticalAlign: 'middle', textAlign: 'right' }}>
                          <span style={{ 
                            display: 'inline-block',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            background: summary.streakData.todayValid ? '#d1fae5' : '#fed7aa',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: summary.streakData.todayValid ? '#059669' : '#ea580c'
                          }}>
                            {summary.streakData.todayValid ? '✓ Done' : `${summary.streakData.todayRoutineTasks}/5`}
                          </span>
                        </div> */}
                      </div>
                      
                      {/* Last 7 Days */}
                      <div style={{ textAlign: 'center', overflow: 'hidden' }}>
                        {summary.streakData.last7Days.map((day, index) => (
                          <div key={day.date} style={{ 
                            display: 'inline-block', 
                            width: 'calc(100% / 7)', 
                            textAlign: 'center',
                            float: 'left',
                            boxSizing: 'border-box'
                          }}>
                            <div style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%',
                              background: day.valid 
                                ? (day.isRestDay ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #f97316, #fb923c)')
                                : index === 6 ? 'transparent' : '#f3f4f6',
                              border: index === 6 && !day.valid ? '2px dashed #fbcfe8' : 'none',
                              boxSizing: 'border-box'
                            }}>
                              {day.valid && !day.isRestDay && <Flame size={14} style={{ color: 'white' }} />}
                              {day.valid && day.isRestDay && <Leaf size={14} style={{ color: 'white' }} />}
                            </div>
                            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '6px', fontWeight: '500' }}>{getDayAbbr(day.date)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* X% Better Card */}
                    <div style={{ 
                      width: '100%',
                      boxSizing: 'border-box',
                      background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', 
                      borderRadius: '20px', 
                      padding: '24px',
                      marginBottom: '16px',
                      border: '2px solid #fbcfe8',
                      textAlign: 'center',
                      boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)'
                    }}>
                      <div style={{ fontSize: '26px', fontWeight: '800', color: '#ec4899', lineHeight: '1.3', letterSpacing: '-0.5px' }}>
                        {summary.userName?.split(' ')[0] || 'Lucky'} is {improvementPercent}% better
                      </div>
                      <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '6px', fontWeight: '500' }}>version of themselves</div>
                    </div>

                    {/* Mood Card */}
                    {summary.mood && summary.mood.mood && moodConfig[summary.mood.mood] && (
                      <div style={{ 
                        background: 'white',
                        borderRadius: '20px', 
                        padding: '20px',
                        marginBottom: '16px',
                        border: '2px solid #fbcfe8',
                        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)',
                        display: 'table',
                        width: '100%',
                        boxSizing: 'border-box'
                      }}>
                        <div style={{ display: 'table-cell', width: '64px', verticalAlign: 'middle' }}>
                          <div style={{ 
                            width: '50px', 
                            height: '50px', 
                            borderRadius: '14px', 
                            background: moodConfig[summary.mood.mood].bgColor,
                            textAlign: 'center',
                            lineHeight: '50px',
                            fontSize: '28px'
                          }}>
                            {moodConfig[summary.mood.mood].emoji}
                          </div>
                        </div>
                        <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '17px', fontWeight: '700', color: moodConfig[summary.mood.mood].color }}>
                            {moodConfig[summary.mood.mood].label}
                          </div>
                          {summary.mood.note && (
                            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                              &quot;{summary.mood.note}&quot;
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Today's Workout by Page OR Rest Day */}
                    {summary.isRestDay && summary.exercises.length === 0 ? (
                      // Rest Day Card
                      <div style={{ 
                        width: '100%',
                        boxSizing: 'border-box',
                        background: 'white', 
                        borderRadius: '20px', 
                        padding: '32px 24px',
                        marginBottom: '12px',
                        border: '2px solid #fbcfe8',
                        textAlign: 'center',
                        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)'
                      }}>
                        <div style={{ 
                          width: '56px', 
                          height: '56px', 
                          borderRadius: '16px', 
                          background: 'linear-gradient(135deg, #10b981, #34d399)',
                          margin: '0 auto 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Leaf size={32} style={{ color: 'white' }} />
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#10b981', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                          Rest Day
                        </div>
                        <div style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                          Recovery is part of progress
                        </div>
                      </div>
                    ) : (
                      // Exercise Cards
                      Object.entries(summary.exercisesByPage).map(([pageName, exercises], pageIndex) => {
                      const pageColors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
                      const color = pageColors[pageIndex % pageColors.length];
                      const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0);
                      const totalReps = exercises.reduce((a, e) => a + e.sets.reduce((acc, s) => acc + s.reps, 0), 0);
                      
                      return (
                        <div key={pageName} style={{ 
                          width: '100%',
                          boxSizing: 'border-box',
                          background: 'white', 
                          borderRadius: '18px', 
                          padding: '16px 18px',
                          marginBottom: '12px',
                          border: '2px solid #fbcfe8',
                          borderLeft: `4px solid ${color}`,
                          boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)'
                        }}>
                          {/* Page Header */}
                          <div style={{ marginBottom: '12px', display: 'table', width: '100%' }}>
                            <div style={{ display: 'table-cell', width: '44px', verticalAlign: 'middle' }}>
                              <div style={{ 
                                width: '32px', 
                                height: '32px', 
                                borderRadius: '10px', 
                                background: `${color}25`,
                                position: 'relative'
                              }}>
                                <div style={{ position: 'absolute', top: '8px', left: '8px', width: '16px', height: '16px' }}>
                                  <Dumbbell size={16} style={{ color }} />
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                              <div style={{ 
                                fontSize: '14px', 
                                fontWeight: '700', 
                                color: '#1f2937', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.5px'
                              }}>
                                {pageName}
                              </div>
                              <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500', marginTop: '2px' }}>
                                {exercises.length} exercises • {totalSets} sets • {totalReps} reps
                              </div>
                            </div>
                          </div>
                          
                          {/* Exercise List */}
                          <div>
                            {exercises.map((ex, i) => (
                              <span key={i} style={{ 
                                display: 'inline-block',
                                fontSize: '12px', 
                                color: '#4b5563',
                                background: '#fdf2f8',
                                padding: '6px 10px',
                                borderRadius: '10px',
                                border: '1px solid #fbcfe8',
                                marginRight: '6px',
                                marginBottom: '8px',
                                fontWeight: '500'
                              }}>
                                {formatExercise(ex)}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }))}

                    {/* Meditation */}
                    <div style={{ 
                      background: 'white', 
                      borderRadius: '16px', 
                      padding: '16px 18px',
                      marginBottom: '20px',
                      border: '2px solid #fbcfe8',
                      boxShadow: '0 4px 12px rgba(236, 72, 153, 0.08)',
                      display: 'table',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ display: 'table-cell', width: '44px', verticalAlign: 'middle' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '10px', 
                          background: summary.meditationDone ? '#d1fae5' : '#f3f4f6',
                          position: 'relative'
                        }}>
                          <div style={{ position: 'absolute', top: '8px', left: '8px', width: '16px', height: '16px' }}>
                            <Leaf size={16} style={{ color: summary.meditationDone ? '#059669' : '#9ca3af' }} />
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'table-cell', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>Meditation</div>
                        <div style={{ fontSize: '12px', color: summary.meditationDone ? '#059669' : '#9ca3af', fontWeight: '500', marginTop: '2px' }}>
                          {summary.meditationDone ? '✓ Completed today' : 'Not done today'}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div style={{ borderTop: '2px solid #fbcfe8', paddingTop: '16px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '12px', color: '#ec4899', fontWeight: '700', float: 'left' }}>LifeOS ✨</span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', float: 'right', fontWeight: '500' }}>{formattedDate}</span>
                    </div>
                  </div>
                </div>

                {/* Export Button */}
                <div className="p-4 border-t border-border">
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-70"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Share2 size={18} />
                        Share
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
