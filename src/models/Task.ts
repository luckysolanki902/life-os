import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  domainId: { 
    type: String, 
    enum: ['health', 'career', 'learning', 'social', 'discipline', 'personality', 'startups'],
    required: true 
  },
  order: { type: Number, default: 0 },
  isScheduled: { type: Boolean, default: false },
  startTime: { type: String }, // HH:mm
  endTime: { type: String }, // HH:mm
  notificationsEnabled: { type: Boolean, default: true },
  timeOfDay: { 
    type: String, 
    enum: ['none', 'morning', 'afternoon', 'evening', 'night', 'day'],
    default: 'none' 
  },
  basePoints: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }, // Soft delete
  mustDo: { type: Boolean, default: false }, // Priority tasks that must be done
  // Recurrence fields
  recurrenceType: { 
    type: String, 
    enum: ['daily', 'weekdays', 'weekends', 'custom'],
    default: 'daily' 
  },
  // Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday
  // Only used when recurrenceType is 'custom'
  recurrenceDays: { 
    type: [Number], 
    default: [] 
  },
}, { timestamps: true });

// Indexes for performance
TaskSchema.index({ domainId: 1, isActive: 1 });
TaskSchema.index({ isActive: 1, order: 1 });
TaskSchema.index({ timeOfDay: 1, isActive: 1 });
TaskSchema.index({ recurrenceType: 1 });

// Use 'RoutineTask' to avoid caching collisions with previous 'Task' models
export default mongoose.models.RoutineTask || mongoose.model('RoutineTask', TaskSchema);
