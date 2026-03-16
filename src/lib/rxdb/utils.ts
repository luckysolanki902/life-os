/**
 * RxDB Utilities - Helpers for converting between MongoDB and RxDB formats
 */

/**
 * Convert a MongoDB document to RxDB format.
 * Maps _id -> id, converts Dates to ISO strings.
 */
export function mongoToRxdb(doc: any): any {
  if (!doc) return null;

  const result: any = {};

  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id') {
      result.id = String(value);
    } else if (key === '__v') {
      // Skip mongoose version key
      continue;
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Check if it's a Date-like object (from JSON)
      if (value && typeof (value as any).toISOString === 'function') {
        result[key] = (value as any).toISOString();
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }

  // Ensure _deleted field exists
  if (!('_deleted' in result)) {
    result._deleted = false;
  }

  return result;
}

/**
 * Convert an RxDB document back to MongoDB format.
 * Maps id -> _id for server actions.
 */
export function rxdbToMongo(doc: any): any {
  if (!doc) return null;

  const result: any = {};

  for (const [key, value] of Object.entries(doc)) {
    if (key === 'id') {
      result._id = value;
    } else if (key === '_deleted' || key === '_rev' || key === '_attachments' || key === '_meta') {
      // Skip RxDB internal fields
      continue;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Batch convert MongoDB docs to RxDB format
 */
export function mongoDocsToRxdb(docs: any[]): any[] {
  return docs.map(mongoToRxdb);
}

/**
 * Generate a unique ID (compatible with MongoDB ObjectId format)
 */
export function generateId(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  return (timestamp + random).slice(0, 24);
}

/**
 * Get current ISO date string (for createdAt/updatedAt)
 */
export function nowISO(): string {
  return new Date().toISOString();
}
