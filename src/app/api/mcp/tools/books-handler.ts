/**
 * Book Tools Handler
 * Implements the actual book operations for MCP tools
 */

import connectDB from '@/lib/db';
import Book from '@/models/Book';
import BookDomain from '@/models/BookDomain';

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

function textResult(data: unknown, isError = false): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError
  };
}

// ============ LIST BOOKS ============
export async function listBooks(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();
  
  const { status, domainId, search, limit = 50, page = 1 } = args;
  
  // Build query
  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (domainId) query.domainId = domainId;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { author: { $regex: search, $options: 'i' } },
    ];
  }
  
  const totalBooks = await Book.countDocuments(query);
  const totalPages = Math.ceil(totalBooks / (limit as number));
  
  const books = await Book.find(query)
    .sort({ lastReadDate: -1, createdAt: -1 })
    .skip(((page as number) - 1) * (limit as number))
    .limit(limit as number)
    .lean();
  
  // Enrich with domain info
  const enrichedBooks = await Promise.all(books.map(async (book: Record<string, unknown>) => {
    const domain = await BookDomain.findById(book.domainId).lean();
    return {
      id: (book._id as { toString(): string }).toString(),
      title: book.title,
      author: book.author || null,
      subcategory: book.subcategory || null,
      status: book.status,
      totalPages: book.totalPages || null,
      currentPage: book.currentPage || 0,
      progress: book.totalPages ? Math.round(((book.currentPage as number || 0) / (book.totalPages as number)) * 100) : null,
      startDate: book.startDate || null,
      completedDate: book.completedDate || null,
      lastReadDate: book.lastReadDate || null,
      notes: book.notes || null,
      rating: book.rating || null,
      domain: domain ? {
        id: ((domain as Record<string, unknown>)._id as { toString(): string }).toString(),
        name: (domain as Record<string, unknown>).name,
        color: (domain as Record<string, unknown>).color,
        icon: (domain as Record<string, unknown>).icon,
      } : null,
    };
  }));
  
  return textResult({
    books: enrichedBooks,
    pagination: { page, limit, totalBooks, totalPages }
  });
}

// ============ LIST DOMAINS ============
export async function listDomains(): Promise<ToolResult> {
  await connectDB();
  
  const domains = await BookDomain.find().sort({ order: 1, createdAt: 1 }).lean();
  
  const domainsWithStats = await Promise.all(domains.map(async (domain: Record<string, unknown>) => {
    const bookCount = await Book.countDocuments({ domainId: domain._id });
    const readingCount = await Book.countDocuments({ domainId: domain._id, status: 'reading' });
    const completedCount = await Book.countDocuments({ domainId: domain._id, status: 'completed' });
    
    return {
      id: (domain._id as { toString(): string }).toString(),
      name: domain.name,
      description: domain.description || null,
      color: domain.color,
      icon: domain.icon,
      stats: {
        total: bookCount,
        reading: readingCount,
        completed: completedCount,
      },
    };
  }));
  
  return textResult({ domains: domainsWithStats });
}

// ============ ADD BOOK ============
export async function addBook(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();
  
  const { domainId, title, author, subcategory, totalPages, status, notes } = args;
  
  if (!domainId || !title) {
    return textResult({ error: 'domainId and title are required' }, true);
  }
  
  // Validate domain exists
  const domain = await BookDomain.findById(domainId);
  if (!domain) {
    return textResult({ error: 'Domain not found', domainId }, true);
  }
  
  // Get max order for this domain
  const maxOrderBook = await Book.findOne({ domainId }).sort({ order: -1 }).lean();
  const order = ((maxOrderBook as Record<string, unknown> | null)?.order as number || 0) + 1;
  
  const book = await Book.create({
    domainId,
    title,
    author: author || '',
    subcategory: subcategory || 'General',
    totalPages: totalPages || 0,
    status: status || 'to-read',
    notes: notes || '',
    order,
    currentPage: 0,
  });
  
  return textResult({
    success: true,
    message: `Book "${title}" added successfully`,
    book: {
      id: book._id.toString(),
      title: book.title,
      author: book.author,
      status: book.status,
      domain: {
        id: domain._id.toString(),
        name: domain.name,
      },
    },
  });
}

// ============ ADD MULTIPLE BOOKS ============
export async function addBooks(books: Array<Record<string, unknown>>): Promise<ToolResult> {
  await connectDB();
  
  if (!books || !Array.isArray(books)) {
    return textResult({ error: 'books array is required' }, true);
  }
  
  const results = {
    success: [] as Array<{ id: string; title: string }>,
    failed: [] as Array<{ title: string; error: string }>,
  };
  
  for (const bookData of books) {
    try {
      const { domainId, title, author, subcategory, totalPages, status, notes } = bookData;
      
      if (!domainId || !title) {
        results.failed.push({ title: (title as string) || 'Unknown', error: 'Missing domainId or title' });
        continue;
      }
      
      const domain = await BookDomain.findById(domainId);
      if (!domain) {
        results.failed.push({ title: title as string, error: 'Domain not found' });
        continue;
      }
      
      const maxOrderBook = await Book.findOne({ domainId }).sort({ order: -1 }).lean();
      const order = ((maxOrderBook as Record<string, unknown> | null)?.order as number || 0) + 1;
      
      const book = await Book.create({
        domainId,
        title,
        author: author || '',
        subcategory: subcategory || 'General',
        totalPages: totalPages || 0,
        status: status || 'to-read',
        notes: notes || '',
        order,
        currentPage: 0,
      });
      
      results.success.push({ id: book._id.toString(), title: book.title });
    } catch (error) {
      results.failed.push({
        title: (bookData.title as string) || 'Unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return textResult({
    message: `Added ${results.success.length} books, ${results.failed.length} failed`,
    results,
  });
}

// ============ UPDATE BOOK ============
export async function updateBook(args: Record<string, unknown>): Promise<ToolResult> {
  await connectDB();
  
  const { id, ...updateData } = args;
  
  if (!id) {
    return textResult({ error: 'id is required' }, true);
  }
  
  // Remove undefined values and id from update
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }
  
  // If updating to completed status, set completedDate
  if (cleanData.status === 'completed') {
    cleanData.completedDate = new Date();
  }
  
  // If updating domainId, validate it exists
  if (cleanData.domainId) {
    const domain = await BookDomain.findById(cleanData.domainId);
    if (!domain) {
      return textResult({ error: 'Domain not found' }, true);
    }
  }
  
  const book = await Book.findByIdAndUpdate(id, cleanData, { new: true }).lean();
  
  if (!book) {
    return textResult({ error: 'Book not found', id }, true);
  }
  
  return textResult({
    success: true,
    message: `Book "${(book as Record<string, unknown>).title}" updated successfully`,
    book: {
      id: ((book as Record<string, unknown>)._id as { toString(): string }).toString(),
      title: (book as Record<string, unknown>).title,
      author: (book as Record<string, unknown>).author,
      status: (book as Record<string, unknown>).status,
      currentPage: (book as Record<string, unknown>).currentPage,
      totalPages: (book as Record<string, unknown>).totalPages,
    },
  });
}

// ============ UPDATE MULTIPLE BOOKS ============
export async function updateBooks(updates: Array<Record<string, unknown>>): Promise<ToolResult> {
  await connectDB();
  
  if (!updates || !Array.isArray(updates)) {
    return textResult({ error: 'updates array is required' }, true);
  }
  
  const results = {
    success: [] as Array<{ id: string; title: string }>,
    failed: [] as Array<{ id: string; error: string }>,
  };
  
  for (const update of updates) {
    try {
      const { id, ...updateData } = update;
      
      if (!id) {
        results.failed.push({ id: 'unknown', error: 'id is required' });
        continue;
      }
      
      // Remove undefined values
      const cleanData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          cleanData[key] = value;
        }
      }
      
      if (cleanData.status === 'completed') {
        cleanData.completedDate = new Date();
      }
      
      if (cleanData.domainId) {
        const domain = await BookDomain.findById(cleanData.domainId);
        if (!domain) {
          results.failed.push({ id: id as string, error: 'Domain not found' });
          continue;
        }
      }
      
      const book = await Book.findByIdAndUpdate(id, cleanData, { new: true }).lean();
      
      if (!book) {
        results.failed.push({ id: id as string, error: 'Book not found' });
      } else {
        results.success.push({ id: id as string, title: (book as Record<string, unknown>).title as string });
      }
    } catch (error) {
      results.failed.push({
        id: (update.id as string) || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  return textResult({
    message: `Updated ${results.success.length} books, ${results.failed.length} failed`,
    results,
  });
}

// ============ DELETE BOOK ============
export async function deleteBook(id: string): Promise<ToolResult> {
  await connectDB();
  
  if (!id) {
    return textResult({ error: 'id is required' }, true);
  }
  
  const book = await Book.findById(id).lean();
  
  if (!book) {
    return textResult({ error: 'Book not found', id }, true);
  }
  
  await Book.findByIdAndDelete(id);
  
  return textResult({
    success: true,
    message: `Book "${(book as Record<string, unknown>).title}" deleted successfully`,
    deletedBook: {
      id,
      title: (book as Record<string, unknown>).title,
    },
  });
}

// ============ DELETE MULTIPLE BOOKS ============
export async function deleteBooks(ids: string[]): Promise<ToolResult> {
  await connectDB();
  
  if (!ids || !Array.isArray(ids)) {
    return textResult({ error: 'ids array is required' }, true);
  }
  
  const results = {
    deleted: [] as Array<{ id: string; title: string }>,
    notFound: [] as string[],
  };
  
  for (const id of ids) {
    const book = await Book.findById(id).lean();
    
    if (!book) {
      results.notFound.push(id);
    } else {
      await Book.findByIdAndDelete(id);
      results.deleted.push({ id, title: (book as Record<string, unknown>).title as string });
    }
  }
  
  return textResult({
    message: `Deleted ${results.deleted.length} books, ${results.notFound.length} not found`,
    results,
  });
}

// ============ GET BOOK STATS ============
export async function getBookStats(): Promise<ToolResult> {
  await connectDB();
  
  const [totalBooks, toRead, reading, paused, completed, dropped] = await Promise.all([
    Book.countDocuments(),
    Book.countDocuments({ status: 'to-read' }),
    Book.countDocuments({ status: 'reading' }),
    Book.countDocuments({ status: 'paused' }),
    Book.countDocuments({ status: 'completed' }),
    Book.countDocuments({ status: 'dropped' }),
  ]);
  
  // Get currently reading books
  const currentlyReading = await Book.find({ status: 'reading' })
    .sort({ lastReadDate: -1 })
    .limit(5)
    .lean();
  
  const readingProgress = currentlyReading.map((book: Record<string, unknown>) => ({
    id: (book._id as { toString(): string }).toString(),
    title: book.title,
    currentPage: book.currentPage || 0,
    totalPages: book.totalPages || 0,
    progress: book.totalPages ? Math.round(((book.currentPage as number || 0) / (book.totalPages as number)) * 100) : null,
    lastReadDate: book.lastReadDate,
  }));
  
  return textResult({
    stats: {
      total: totalBooks,
      byStatus: {
        toRead,
        reading,
        paused,
        completed,
        dropped,
      },
    },
    currentlyReading: readingProgress,
  });
}
