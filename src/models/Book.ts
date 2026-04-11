import mongoose from 'mongoose';

const BookSchema = new mongoose.Schema({
  domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookDomain', required: true },
  title: { type: String, required: true },
  author: { type: String },
  category: { type: String, required: true, default: 'General' },
  subcategory: { type: String }, // Backward compatibility for older data
  
  // Status managed by logic
  status: { 
    type: String, 
    enum: ['not-started', 'reading', 'finished'],
    default: 'not-started' 
  },
  
  // Dates
  startedOn: { type: Date },
  finishedOn: { type: Date },
  startDate: { type: Date }, // Backward compatibility alias
  completedDate: { type: Date }, // Backward compatibility alias
  lastReadDate: { type: Date }, // Updated when checked in
  
  // Progress tracking
  totalPages: { type: Number },
  currentPage: { type: Number, default: 0 },
  
  // Notes
  notes: { type: String },
  rating: { type: Number, min: 1, max: 5 },
  
  order: { type: Number, default: 0 },
}, { timestamps: true });

// Indexes for efficient queries
BookSchema.index({ status: 1 });
BookSchema.index({ lastReadDate: -1 });
BookSchema.index({ domainId: 1, status: 1 });

BookSchema.pre('validate', function () {
  const doc = this as any;

  if (!doc.category && doc.subcategory) {
    doc.category = doc.subcategory;
  }
  if (!doc.subcategory && doc.category) {
    doc.subcategory = doc.category;
  }

  if (!doc.startedOn && doc.startDate) {
    doc.startedOn = doc.startDate;
  }
  if (!doc.startDate && doc.startedOn) {
    doc.startDate = doc.startedOn;
  }

  if (!doc.finishedOn && doc.completedDate) {
    doc.finishedOn = doc.completedDate;
  }
  if (!doc.completedDate && doc.finishedOn) {
    doc.completedDate = doc.finishedOn;
  }

});

export default mongoose.models.Book || mongoose.model('Book', BookSchema);
