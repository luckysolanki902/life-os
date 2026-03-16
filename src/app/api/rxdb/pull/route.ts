/**
 * RxDB Pull Endpoint
 * 
 * Returns documents updated since the given checkpoint.
 * Used by RxDB replication to pull server changes.
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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const collection = searchParams.get('collection');
    const modelName = searchParams.get('modelName');
    const batchSize = parseInt(searchParams.get('batchSize') || '200', 10);
    const checkpointUpdatedAt = searchParams.get('updatedAt');
    const checkpointId = searchParams.get('id');

    if (!collection || !modelName) {
      return NextResponse.json(
        { error: 'collection and modelName are required' },
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

    // Build query: get documents updated after the checkpoint
    const query: any = {};

    if (checkpointUpdatedAt && checkpointId) {
      query.$or = [
        { updatedAt: { $gt: new Date(checkpointUpdatedAt) } },
        {
          updatedAt: new Date(checkpointUpdatedAt),
          _id: { $gt: checkpointId },
        },
      ];
    }

    const documents = await Model.find(query)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(batchSize)
      .lean();

    // Build checkpoint from last document
    let checkpoint = null;
    if (documents.length > 0) {
      const lastDoc = documents[documents.length - 1];
      checkpoint = {
        updatedAt: lastDoc.updatedAt
          ? new Date(lastDoc.updatedAt).toISOString()
          : new Date().toISOString(),
        id: String(lastDoc._id),
      };
    }

    // Serialize documents (convert _id to string, dates to ISO)
    const serialized = documents.map((doc: any) => {
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
    });

    return NextResponse.json({
      documents: serialized,
      checkpoint,
    });
  } catch (error) {
    console.error('[RxDB Pull] Error:', error);
    return NextResponse.json(
      { error: 'Pull failed' },
      { status: 500 }
    );
  }
}
