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
  
  const { domain: domainName, domainColor, domainIcon, title, author, subcategory, totalPages, status, notes } = args;
  
  if (!domainName || !title) {
    return textResult({ error: 'domain (name/category) and title are required' }, true);
  }
  
  // Find or create domain by name (case-insensitive)
  let domain = await BookDomain.findOne({ 
    name: { $regex: new RegExp(`^${domainName}$`, 'i') } 
  });
  
  if (!domain) {
    // Create new domain with provided or default styling
    const defaultColors = ['#4A90D9', '#50C878', '#FF6B6B', '#FFB347', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71'];
    const defaultIcons = ['📚', '💡', '🎯', '🔬', '💻', '📖', '🧠', '🌟'];
    const existingDomains = await BookDomain.countDocuments();
    
    domain = await BookDomain.create({
      name: domainName,
      description: `Books about ${domainName}`,
      color: (domainColor as string) || defaultColors[existingDomains % defaultColors.length],
      icon: (domainIcon as string) || defaultIcons[existingDomains % defaultIcons.length],
      order: existingDomains + 1,
    });
  }
  
  // Get max order for this domain
  const maxOrderBook = await Book.findOne({ domainId: domain._id }).sort({ order: -1 }).lean();
  const order = ((maxOrderBook as Record<string, unknown> | null)?.order as number || 0) + 1;
  
  const book = await Book.create({
    domainId: domain._id,
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
    message: `Book "${title}" added successfully to "${domain.name}" domain`,
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
    success: [] as Array<{ id: string; title: string; domain: string }>,
    failed: [] as Array<{ title: string; error: string }>,
  };
  
  // Cache domains to avoid repeated lookups
  const domainCache = new Map<string, { _id: { toString(): string }; name: string }>();
  
  // Default domain styling options
  const defaultColors = ['#4A90D9', '#50C878', '#FF6B6B', '#FFB347', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71'];
  const defaultIcons = ['📚', '💡', '🎯', '🔬', '💻', '📖', '🧠', '🌟'];
  
  for (const bookData of books) {
    try {
      const { domain: domainName, domainColor, domainIcon, title, author, subcategory, totalPages, status, notes } = bookData;
      
      if (!domainName || !title) {
        results.failed.push({ title: (title as string) || 'Unknown', error: 'Missing domain or title' });
        continue;
      }
      
      const domainKey = (domainName as string).toLowerCase();
      let domain = domainCache.get(domainKey);
      
      if (!domain) {
        // Find or create domain
        let existingDomain = await BookDomain.findOne({ 
          name: { $regex: new RegExp(`^${domainName}$`, 'i') } 
        });
        
        if (!existingDomain) {
          const existingDomains = await BookDomain.countDocuments();
          existingDomain = await BookDomain.create({
            name: domainName,
            description: `Books about ${domainName}`,
            color: (domainColor as string) || defaultColors[existingDomains % defaultColors.length],
            icon: (domainIcon as string) || defaultIcons[existingDomains % defaultIcons.length],
            order: existingDomains + 1,
          });
        }
        
        domain = { _id: existingDomain._id, name: existingDomain.name };
        domainCache.set(domainKey, domain);
      }
      
      const maxOrderBook = await Book.findOne({ domainId: domain._id }).sort({ order: -1 }).lean();
      const order = ((maxOrderBook as Record<string, unknown> | null)?.order as number || 0) + 1;
      
      const book = await Book.create({
        domainId: domain._id,
        title,
        author: author || '',
        subcategory: subcategory || 'General',
        totalPages: totalPages || 0,
        status: status || 'to-read',
        notes: notes || '',
        order,
        currentPage: 0,
      });
      
      results.success.push({ id: book._id.toString(), title: book.title, domain: domain.name });
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
  
  const { id, domain: domainName, ...updateData } = args;
  
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
  
  // Auto-set dates based on status changes
  if (cleanData.status === 'reading' && !cleanData.startedOn) {
    cleanData.startedOn = new Date();
  }
  if (cleanData.status === 'finished') {
    cleanData.finishedOn = new Date();
  }
  
  // If updating domain by name, find or create it
  if (domainName) {
    let domain = await BookDomain.findOne({ 
      name: { $regex: new RegExp(`^${domainName}$`, 'i') } 
    });
    
    if (!domain) {
      const domainColors = ['#4A90D9', '#50C878', '#FF6B6B', '#FFB347', '#9B59B6', '#3498DB', '#E74C3C', '#2ECC71'];
      const domainIcons = ['📚', '💡', '🎯', '🔬', '💻', '📖', '🧠', '🌟'];
      const existingDomains = await BookDomain.countDocuments();
      
      domain = await BookDomain.create({
        name: domainName,
        description: `Books about ${domainName}`,
        color: domainColors[existingDomains % domainColors.length],
        icon: domainIcons[existingDomains % domainIcons.length],
        order: existingDomains + 1,
      });
    }
    
    cleanData.domainId = domain._id;
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
      
      if (cleanData.status === 'reading' && !cleanData.startedOn) {
        cleanData.startedOn = new Date();
      }
      if (cleanData.status === 'finished') {
        cleanData.finishedOn = new Date();
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
  
  const [totalBooks, notStarted, reading, finished] = await Promise.all([
    Book.countDocuments(),
    Book.countDocuments({ status: 'not-started' }),
    Book.countDocuments({ status: 'reading' }),
    Book.countDocuments({ status: 'finished' }),
  ]);
  
  // Get currently reading books
  const currentlyReading = await Book.find({ status: 'reading' })
    .sort({ lastReadDate: -1 })
    .limit(5)
    .lean();
  
  const readingProgress = currentlyReading.map((book: Record<string, unknown>) => ({
    id: (book._id as { toString(): string }).toString(),
    title: book.title,
    author: book.author || null,
    category: book.category || book.subcategory || null,
    currentPage: book.currentPage || 0,
    totalPages: book.totalPages || 0,
    progress: book.totalPages ? Math.round(((book.currentPage as number || 0) / (book.totalPages as number)) * 100) : null,
    startedOn: book.startedOn || book.startDate || null,
    lastReadDate: book.lastReadDate,
  }));
  
  return textResult({
    stats: {
      total: totalBooks,
      byStatus: {
        notStarted,
        reading,
        finished,
      },
    },
    currentlyReading: readingProgress,
  });
}
