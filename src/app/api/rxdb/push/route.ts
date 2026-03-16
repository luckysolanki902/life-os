/**
 * RxDB Push Endpoint
 * 
 * Receives locally changed documents and upserts them to MongoDB.
 * Returns conflicts if server has newer versions.
 */

import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

// Import all models to ensure they're registered
import '@/models/Task';
import '@/models/DailyLog';
import '@/models/DailyStreakRecord';
import '@/models/WeightLog';
import '@/models/HealthPage';
import '@/models/ExerciseDefinition';
import '@/models/ExerciseLog';
import '@/models/MoodLog';
import '@/models/Book';
import '@/models/BookDomain';
import '@/models/BookLog';
import '@/models/LearningCategory';
import '@/models/LearningSkill';
import '@/models/SimpleLearningLog';
import '@/models/User';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collection, modelName, docs } = body;

    if (!collection || !modelName || !Array.isArray(docs)) {
      return NextResponse.json(
        { error: 'collection, modelName, and docs array are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const Model = mongoose.models[modelName];
    if (!Model) {
      return NextResponse.json(
        { error: `Model ${modelName} not found` },
        { status: 400 }
      );
    }

    const conflicts: any[] = [];

    for (const doc of docs) {
      const docId = doc._id;
      if (!docId) continue;

      try {
        // Check for conflicts
        const existing = await Model.findById(docId).lean();

        if (existing) {
          // Conflict check: if server doc is newer, report conflict
          const serverUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          const clientUpdatedAt = doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0;

          if (serverUpdatedAt > clientUpdatedAt) {
            // Server has newer version - report conflict
            conflicts.push(existing);
            continue;
          }
        }

        // Handle soft-delete
        if (doc._deleted) {
          if (existing) {
            await Model.findByIdAndDelete(docId);
          }
          continue;
        }

        // Prepare doc for upsert - remove RxDB-specific fields
        const mongoDoc = { ...doc };
        delete mongoDoc._deleted;
        delete mongoDoc._rev;
        delete mongoDoc._attachments;
        delete mongoDoc._meta;

        // Convert ISO date strings back to Date objects for date fields
        for (const [key, value] of Object.entries(mongoDoc)) {
          if (
            typeof value === 'string' &&
            key !== '_id' &&
            key !== 'title' &&
            key !== 'domainId' &&
            key !== 'status' &&
            key !== 'mood' &&
            key !== 'note' &&
            key !== 'notes' &&
            key !== 'type' &&
            key !== 'name' &&
            key !== 'description' &&
            key !== 'author' &&
            key !== 'subcategory' &&
            key !== 'color' &&
            key !== 'icon' &&
            key !== 'timeOfDay' &&
            key !== 'recurrenceType' &&
            key !== 'startTime' &&
            key !== 'endTime' &&
            key !== 'activities' &&
            key !== 'difficulty' &&
            key !== 'username' &&
            key !== 'email' &&
            key !== 'pushToken' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
          ) {
            mongoDoc[key] = new Date(value);
          }
        }

        // Upsert the document
        await Model.findByIdAndUpdate(
          docId,
          { $set: mongoDoc },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (docError) {
        console.error(`[RxDB Push] Error processing doc ${docId}:`, docError);
        // Don't fail the whole batch for one doc error
      }
    }

    return NextResponse.json({
      ok: true,
      conflicts: conflicts.map((doc: any) => {
        const result: any = {};
        for (const [key, value] of Object.entries(doc)) {
          if (key === '_id') {
            result._id = String(value);
          } else if (key === '__v') {
            continue;
          } else if (value instanceof Date) {
            result[key] = value.toISOString();
          } else {
            result[key] = value;
          }
        }
        return result;
      }),
    });
  } catch (error) {
    console.error('[RxDB Push] Error:', error);
    return NextResponse.json(
      { error: 'Push failed' },
      { status: 500 }
    );
  }
}
