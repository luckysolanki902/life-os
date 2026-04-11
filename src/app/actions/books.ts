'use server';

import connectDB from '@/lib/db';
import BookDomain from '@/models/BookDomain';
import Book from '@/models/Book';
import BookLog from '@/models/BookLog';
import Task from '@/models/Task';
import DailyLog from '@/models/DailyLog';
import { revalidatePath } from 'next/cache';
import {
  parseToISTMidnight,
  getTodayISTMidnight,
  getTodayDateString,
  getDateRange,
  getDayOfWeek,
  getTodayDayOfWeek
} from '@/lib/server-date-utils';

const ALLOWED_BOOK_STATUSES = ['not-started', 'reading', 'finished'] as const;

function normalizeBookStatus(status?: string | null): 'not-started' | 'reading' | 'finished' {
  if (status === 'reading' || status === 'finished' || status === 'not-started') {
    return status;
  }

  if (status === 'completed') return 'finished';
  if (status === 'to-read' || status === 'paused' || status === 'dropped') return 'not-started';

  return 'not-started';
}

// Helper function to check if a task should appear on a given day
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

// ============ DASHBOARD DATA ============
export async function getBooksDashboardData(page: number = 1, limit: number = 20, search?: string) {
  await connectDB();

  // Get all domains with book counts
  const domains = await BookDomain.find().sort({ order: 1, createdAt: 1 }).lean();
  
  const domainsWithStats = await Promise.all(domains.map(async (domain: any) => {
    const bookCount = await Book.countDocuments({ domainId: domain._id });
    const readingCount = await Book.countDocuments({ domainId: domain._id, status: 'reading' });
    const completedCount = await Book.countDocuments({ domainId: domain._id, status: 'finished' });
    
    return {
      ...domain,
      _id: domain._id.toString(),
      bookCount,
      readingCount,
      completedCount
    };
  }));


  // Get all books with pagination and search
  let query: any = {};
  if (search) {
    query = {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { subcategory: { $regex: search, $options: 'i' } }
      ]
    };
  }
  
  const totalBooks = await Book.countDocuments(query);
  const totalPages = Math.ceil(totalBooks / limit);
  
  const books = await Book.find(query)
    .sort({ order: 1, updatedAt: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  // Enrich books with domain info
  const enrichedBooks = await Promise.all(books.map(async (book: any) => {
    const domain = await BookDomain.findById(book.domainId).lean();
    return {
      ...book,
      _id: book._id.toString(),
      domainId: book.domainId.toString(),
      category: book.category || book.subcategory || 'General',
      status: normalizeBookStatus(book.status),
      startedOn: (book as any).startedOn || (book as any).startDate || null,
      finishedOn: (book as any).finishedOn || (book as any).completedDate || null,
      domain: domain ? { 
        name: (domain as any).name, 
        color: (domain as any).color,
        icon: (domain as any).icon
      } : null
    };
  }));


  // Recently logged reading sessions (last 10)
  const recentLogs = await BookLog.find()
    .sort({ date: -1 })
    .limit(10)
    .lean();
  
  const enrichedRecentLogs = await Promise.all(recentLogs.map(async (log: any) => {
    const book = await Book.findById(log.bookId).lean();
    if (!book) return null;
    
    const domain = await BookDomain.findById((book as any).domainId).lean();
    return {
      ...log,
      _id: log._id.toString(),
      bookId: log.bookId.toString(),
      book: {
        _id: (book as any)._id.toString(),
        title: (book as any).title,
        author: (book as any).author,
        category: (book as any).category || (book as any).subcategory || 'General',
        status: normalizeBookStatus((book as any).status)
      },
      domain: domain ? { 
        name: (domain as any).name, 
        color: (domain as any).color,
        icon: (domain as any).icon
      } : null
    };
  }));
  
  const enrichedRecent = enrichedRecentLogs.filter(log => log !== null);

  // Get today's learning tasks (since books is part of learning)
  const today = getTodayISTMidnight();
  const dayOfWeek = getTodayDayOfWeek();
  
  const learningTasks = await Task.find({
    domainId: 'learning',
    isActive: true
  }).lean();

  // Filter by recurrence
  const todaysTasks = learningTasks.filter((task: any) => shouldShowTaskOnDay(task, dayOfWeek));

  const taskIds = todaysTasks.map((t: any) => t._id);
  const { startOfDay, endOfDay } = getDateRange(getTodayDateString());
  const taskLogs = await DailyLog.find({
    taskId: { $in: taskIds },
    date: { $gte: startOfDay, $lt: endOfDay }
  }).lean();

  const routine = todaysTasks.map((task: any) => {
    const log = taskLogs.find((l: any) => l.taskId.toString() === task._id.toString());
    return {
      ...task,
      _id: task._id.toString(),
      log: log ? {
        ...log,
        _id: log._id.toString(),
        taskId: log.taskId.toString(),
      } : null
    };
  });

  // Stats
  const stats = {
    totalBooks: await Book.countDocuments(),
    notStarted: await Book.countDocuments({ status: 'not-started' }),
    reading: await Book.countDocuments({ status: 'reading' }),
    finished: await Book.countDocuments({ status: 'finished' })
  };

  return {
    domains: domainsWithStats,
    books: enrichedBooks,
    recentLogs: enrichedRecent,
    stats,
    pagination: {
      page,
      limit,
      totalBooks,
      totalPages
    }
  };
}

// ============ DOMAIN CRUD ============
export async function createBookDomain(data: { name: string; description?: string; color?: string; icon?: string }) {
  await connectDB();
  const maxOrder = await BookDomain.findOne().sort({ order: -1 }).lean();
  await BookDomain.create({ ...data, order: ((maxOrder as any)?.order || 0) + 1 });
  revalidatePath('/books');
  return { success: true };
}

export async function updateBookDomain(domainId: string, data: { name?: string; description?: string; color?: string; icon?: string }) {
  await connectDB();
  await BookDomain.findByIdAndUpdate(domainId, data);
  revalidatePath('/books');
  return { success: true };
}

export async function deleteBookDomain(domainId: string) {
  await connectDB();
  // Also delete all books in this domain
  await Book.deleteMany({ domainId });
  await BookDomain.findByIdAndDelete(domainId);
  revalidatePath('/books');
  return { success: true };
}

// ============ BOOK CRUD ============
export async function createBook(data: { 
  domainId?: string; 
  title: string; 
  author?: string;
  category?: string;
  subcategory?: string;
  totalPages?: number;
  startedOn?: string;
  finishedOn?: string;
  startDate?: string;
  completedDate?: string;
  notes?: string;
  status?: string;
  order?: number;
}) {
  await connectDB();
  let domainId = data.domainId;
  if (!domainId) {
    const existingDomain = await BookDomain.findOne().sort({ order: 1, createdAt: 1 }).lean();
    if (existingDomain) {
      domainId = (existingDomain as any)._id.toString();
    } else {
      const created = await BookDomain.create({ name: 'General', color: '#4A90D9', icon: '📚', order: 1 });
      domainId = created._id.toString();
    }
  }

  const maxOrder = await Book.findOne({ domainId }).sort({ order: -1 }).lean();
  
  // Don't auto-set lastReadDate or status - let user control when they start
  const bookData: any = { 
    ...data, 
    domainId,
    order: data.order ?? (((maxOrder as any)?.order || 0) + 1),
    status: normalizeBookStatus(data.status),
    category: data.category || data.subcategory || 'General'
  };

  const startedOnInput = data.startedOn || data.startDate;
  const finishedOnInput = data.finishedOn || data.completedDate;

  if (startedOnInput) {
    const started = parseToISTMidnight(startedOnInput);
    bookData.startedOn = started;
    bookData.startDate = started;
  }

  if (finishedOnInput) {
    const finished = parseToISTMidnight(finishedOnInput);
    bookData.finishedOn = finished;
    bookData.completedDate = finished;
  }

  if (bookData.status === 'reading' && !bookData.startedOn) {
    const today = getTodayISTMidnight();
    bookData.startedOn = today;
    bookData.startDate = today;
  }

  if (bookData.status === 'finished' && !bookData.finishedOn) {
    const today = getTodayISTMidnight();
    bookData.finishedOn = today;
    bookData.completedDate = today;
  }

  bookData.subcategory = bookData.category;
  
  await Book.create(bookData);
  revalidatePath('/books');
  return { success: true };
}

export async function updateBook(bookId: string, data: { 
  domainId?: string;
  title?: string; 
  author?: string;
  category?: string;
  subcategory?: string;
  status?: string;
  totalPages?: number;
  currentPage?: number;
  startedOn?: string;
  finishedOn?: string;
  startDate?: string;
  completedDate?: string;
  notes?: string;
  rating?: number;
  order?: number;
}) {
  await connectDB();
  
  const updateData: any = { ...data };

  if (data.status !== undefined) {
    updateData.status = normalizeBookStatus(data.status);
  }

  if (data.category !== undefined || data.subcategory !== undefined) {
    updateData.category = data.category ?? data.subcategory ?? 'General';
    updateData.subcategory = updateData.category;
  }

  const startedOnInput = data.startedOn ?? data.startDate;
  const finishedOnInput = data.finishedOn ?? data.completedDate;

  if (startedOnInput !== undefined) {
    updateData.startedOn = startedOnInput ? parseToISTMidnight(startedOnInput) : null;
    updateData.startDate = updateData.startedOn;
  }

  if (finishedOnInput !== undefined) {
    updateData.finishedOn = finishedOnInput ? parseToISTMidnight(finishedOnInput) : null;
    updateData.completedDate = updateData.finishedOn;
  }

  if (updateData.status === 'reading' && !updateData.startedOn) {
    const existing = await Book.findById(bookId).lean();
    if (existing && !(existing as any).startedOn && !(existing as any).startDate) {
      const today = getTodayISTMidnight();
      updateData.startedOn = today;
      updateData.startDate = today;
    }
  }

  if (updateData.status === 'finished' && updateData.finishedOn === undefined) {
    const today = getTodayISTMidnight();
    updateData.finishedOn = today;
    updateData.completedDate = today;
  }

  if (updateData.status === 'not-started') {
    updateData.finishedOn = null;
    updateData.completedDate = null;
  }
  
  await Book.findByIdAndUpdate(bookId, updateData);
  revalidatePath('/books');
  return { success: true };
}

export async function deleteBook(bookId: string) {
  await connectDB();
  await Book.findByIdAndDelete(bookId);
  revalidatePath('/books');
  revalidatePath('/');
  return { success: true };
}

// ============ CHECK-IN ============

// Check in - log reading progress and start reading if needed
export async function checkInBook(bookId: string, currentPage?: number, notes?: string, dateStr?: string) {
  await connectDB();
  
  const book = await Book.findById(bookId);
  if (!book) return { error: 'Book not found' };
  
  // Use client-provided date or today's IST midnight
  const logDate = dateStr ? parseToISTMidnight(dateStr) : getTodayISTMidnight();
  const logDateStr = dateStr || getTodayDateString();
  
  const updateData: any = {
    lastReadDate: logDate,
  };
  
  // If book was not-started, move to reading and set startedOn if missing
  if (normalizeBookStatus((book as any).status) === 'not-started') {
    updateData.status = 'reading';
    if (!(book as any).startedOn && !(book as any).startDate) {
      updateData.startedOn = logDate;
      updateData.startDate = logDate;
    }
  }
  
  // Calculate pages read this session
  const previousPage = book.currentPage || 0;
  const pagesRead = currentPage !== undefined ? Math.max(0, currentPage - previousPage) : 0;
  
  if (currentPage !== undefined) {
    updateData.currentPage = currentPage;
    
    // Auto-complete if reached total pages
    if (book.totalPages && currentPage >= book.totalPages) {
      updateData.status = 'finished';
      updateData.finishedOn = logDate;
      updateData.completedDate = logDate;
    }
  }
  
  await Book.findByIdAndUpdate(bookId, updateData);
  
  // Create a log entry
  await BookLog.create({
    bookId,
    date: logDate,
    currentPage: currentPage || book.currentPage || 0,
    pagesRead,
    notes: notes || '',
  });
  
  // Update streak for this date (book reading contributes to special tasks)
  const { updateStreakForDate } = await import('./streak');
  await updateStreakForDate(logDateStr);
  
  revalidatePath('/books');
  revalidatePath('/');
  return { success: true };
}

// Search books
export async function searchBooks(query: string, limit: number = 10) {
  await connectDB();
  
  const books = await Book.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { author: { $regex: query, $options: 'i' } }
    ]
  }).sort({ lastReadDate: -1 }).limit(limit).lean();
  
  const enrichedBooks = await Promise.all(books.map(async (book: any) => {
    const domain = await BookDomain.findById(book.domainId).lean();
    return {
      ...book,
      _id: book._id.toString(),
      domainId: book.domainId.toString(),
      domain: domain ? { 
        name: (domain as any).name, 
        color: (domain as any).color,
        icon: (domain as any).icon
      } : null
    };
  }));
  
  return enrichedBooks;
}

// Get books by domain with pagination
export async function getBooksByDomain(domainId: string, page: number = 1, limit: number = 20) {
  await connectDB();
  
  const totalBooks = await Book.countDocuments({ domainId });
  const totalPages = Math.ceil(totalBooks / limit);
  
  const books = await Book.find({ domainId })
    .sort({ lastReadDate: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  const domain = await BookDomain.findById(domainId).lean();
  
  return {
    books: books.map((book: any) => ({
      ...book,
      _id: book._id.toString(),
      domainId: book.domainId.toString(),
      domain: domain ? { 
        name: (domain as any).name, 
        color: (domain as any).color,
        icon: (domain as any).icon
      } : null
    })),
    pagination: { page, limit, totalBooks, totalPages }
  };
}

// ============ TABLE VIEW WITH SORTING ============
export async function getBooksTableData(
  page: number = 1, 
  limit: number = 50,
  sortField: string = 'order',
  sortOrder: 'asc' | 'desc' = 'desc',
  filters?: {
    status?: string;
    domainId?: string;
    search?: string;
  }
) {
  await connectDB();
  
  // Build query
  let query: any = {};
  if (filters?.status && ALLOWED_BOOK_STATUSES.includes(filters.status as any)) {
    query.status = filters.status;
  }
  if (filters?.domainId) query.domainId = filters.domainId;
  if (filters?.search) {
    query.$or = [
      { title: { $regex: filters.search, $options: 'i' } },
      { author: { $regex: filters.search, $options: 'i' } },
      { category: { $regex: filters.search, $options: 'i' } },
      { subcategory: { $regex: filters.search, $options: 'i' } }
    ];
  }
  
  const totalBooks = await Book.countDocuments(query);
  const totalPages = Math.ceil(totalBooks / limit);
  
  // Build sort object
  const sortObj: any = {};
  sortObj[sortField] = sortOrder === 'asc' ? 1 : -1;
  
  const books = await Book.find(query)
    .sort(sortObj)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  
  // Enrich with domain info
  const enrichedBooks = await Promise.all(books.map(async (book: any) => {
    const domain = await BookDomain.findById(book.domainId).lean();
    return {
      ...book,
      _id: book._id.toString(),
      domainId: book.domainId.toString(),
      category: (book as any).category || (book as any).subcategory || 'General',
      status: normalizeBookStatus((book as any).status),
      startedOn: (book as any).startedOn || (book as any).startDate || null,
      finishedOn: (book as any).finishedOn || (book as any).completedDate || null,
      domain: domain ? { 
        _id: (domain as any)._id.toString(),
        name: (domain as any).name, 
        color: (domain as any).color,
        icon: (domain as any).icon
      } : null
    };
  }));
  
  // Get all domains for filter dropdown
  const allDomains = await BookDomain.find().sort({ order: 1 }).lean();
  
  return {
    books: enrichedBooks,
    pagination: { page, limit, totalBooks, totalPages },
    domains: allDomains.map((d: any) => ({ ...d, _id: d._id.toString() }))
  };
}

// ============ BULK IMPORT ============
export async function bulkImportBooks(booksData: Array<{
  title: string;
  author?: string;
  domain: string; // Domain name, will auto-create if doesn't exist
  category?: string;
  subcategory?: string;
  totalPages?: number;
  status?: string;
  startedOn?: string;
  startDate?: string;
  notes?: string;
}>) {
  await connectDB();
  
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  // Process each book
  for (const bookData of booksData) {
    try {
      if (!bookData.title || !bookData.domain) {
        results.failed++;
        results.errors.push(`Missing required fields for: ${bookData.title || 'Unknown'}`);
        continue;
      }
      
      // Find or create domain
      let domain = await BookDomain.findOne({ name: bookData.domain }).lean();
      
      if (!domain) {
        // Auto-create domain
        const maxOrder = await BookDomain.findOne().sort({ order: -1 }).lean();
        const newDomain = await BookDomain.create({
          name: bookData.domain,
          description: `Auto-created for ${bookData.domain}`,
          color: ['blue', 'purple', 'emerald', 'orange', 'cyan', 'amber'][Math.floor(Math.random() * 6)],
          icon: '📚',
          order: ((maxOrder as any)?.order || 0) + 1
        });
        domain = newDomain.toObject();
      }
      
      // Create book
      const today = getTodayISTMidnight();
      await Book.create({
        domainId: (domain as any)._id,
        title: bookData.title,
        author: bookData.author || '',
        category: bookData.category || bookData.subcategory || 'General',
        subcategory: bookData.category || bookData.subcategory || 'General',
        totalPages: bookData.totalPages || 0,
        status: normalizeBookStatus(bookData.status),
        startedOn: (bookData.startedOn || bookData.startDate) ? parseToISTMidnight(bookData.startedOn || bookData.startDate || '') : today,
        startDate: (bookData.startedOn || bookData.startDate) ? parseToISTMidnight(bookData.startedOn || bookData.startDate || '') : today,
        notes: bookData.notes || '',
        lastReadDate: today
      });
      
      results.success++;
    } catch (error: any) {
      results.failed++;
      results.errors.push(`Error importing "${bookData.title}": ${error.message}`);
    }
  }
  
  revalidatePath('/books');
  return results;
}

// ============ BOOK LOGS ============
export async function deleteBookLog(logId: string) {
  await connectDB();
  await BookLog.findByIdAndDelete(logId);
  revalidatePath('/books');
  return { success: true };
}

export async function getBookLogs(bookId: string, limit: number = 20) {
  await connectDB();
  
  const logs = await BookLog.find({ bookId })
    .sort({ date: -1 })
    .limit(limit)
    .lean();
  
  return logs.map((log: any) => ({
    ...log,
    _id: log._id.toString(),
    bookId: log.bookId.toString()
  }));
}
