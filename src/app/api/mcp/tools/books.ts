/**
 * Book Tools for MCP Server
 * Provides list, add, delete (multiple), and update (multiple) operations
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import connectDB from '@/lib/db';
import Book from '@/models/Book';
import BookDomain from '@/models/BookDomain';

// Schema definitions for tool parameters
const BookCreateSchema = z.object({
  domainId: z.string().describe('The ID of the domain this book belongs to'),
  title: z.string().describe('The title of the book'),
  author: z.string().optional().describe('The author of the book'),
  subcategory: z.string().optional().describe('Subcategory within the domain (e.g., "Marketing", "Validation")'),
  totalPages: z.number().optional().describe('Total number of pages'),
  status: z.enum(['to-read', 'reading', 'paused', 'completed', 'dropped']).optional().describe('Reading status'),
  notes: z.string().optional().describe('Personal notes about the book'),
});

const BookUpdateSchema = z.object({
  id: z.string().describe('The book ID to update'),
  title: z.string().optional().describe('New title'),
  author: z.string().optional().describe('New author'),
  domainId: z.string().optional().describe('New domain ID'),
  subcategory: z.string().optional().describe('New subcategory'),
  totalPages: z.number().optional().describe('New total pages'),
  currentPage: z.number().optional().describe('Current page number'),
  status: z.enum(['to-read', 'reading', 'paused', 'completed', 'dropped']).optional().describe('New status'),
  notes: z.string().optional().describe('New notes'),
  rating: z.number().min(1).max(5).optional().describe('Rating from 1-5'),
});

export function registerBookTools(server: McpServer): void {
  // ============ LIST BOOKS ============
  server.tool(
    'list_books',
    'List all books with optional filtering by status or domain. Returns book details including title, author, status, progress, and domain info.',
    {
      status: z.enum(['to-read', 'reading', 'paused', 'completed', 'dropped']).optional()
        .describe('Filter by reading status'),
      domainId: z.string().optional().describe('Filter by domain ID'),
      search: z.string().optional().describe('Search in title or author'),
      limit: z.number().optional().default(50).describe('Maximum number of books to return (default: 50)'),
      page: z.number().optional().default(1).describe('Page number for pagination'),
    },
    async ({ status, domainId, search, limit = 50, page = 1 }) => {
      await connectDB();
      
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
      const totalPages = Math.ceil(totalBooks / limit);
      
      const books = await Book.find(query)
        .sort({ lastReadDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
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
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              books: enrichedBooks,
              pagination: {
                page,
                limit,
                totalBooks,
                totalPages,
              },
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ LIST DOMAINS ============
  server.tool(
    'list_domains',
    'List all book domains/categories. Use this to get domain IDs for adding books.',
    {},
    async () => {
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
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ domains: domainsWithStats }, null, 2),
          },
        ],
      };
    }
  );

  // ============ ADD BOOK ============
  server.tool(
    'add_book',
    'Add a new book to the reading list. Requires a domain ID (use list_domains to get available domains).',
    BookCreateSchema.shape,
    async (params) => {
      await connectDB();
      
      // Validate domain exists
      const domain = await BookDomain.findById(params.domainId);
      if (!domain) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Domain not found', domainId: params.domainId }) }],
          isError: true,
        };
      }
      
      // Get max order for this domain
      const maxOrderBook = await Book.findOne({ domainId: params.domainId }).sort({ order: -1 }).lean();
      const order = ((maxOrderBook as Record<string, unknown> | null)?.order as number || 0) + 1;
      
      const book = await Book.create({
        domainId: params.domainId,
        title: params.title,
        author: params.author || '',
        subcategory: params.subcategory || 'General',
        totalPages: params.totalPages || 0,
        status: params.status || 'to-read',
        notes: params.notes || '',
        order,
        currentPage: 0,
      });
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Book "${params.title}" added successfully`,
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
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ ADD MULTIPLE BOOKS ============
  server.tool(
    'add_books',
    'Add multiple books at once. Each book requires a domain ID.',
    {
      books: z.array(BookCreateSchema).describe('Array of books to add'),
    },
    async ({ books }) => {
      await connectDB();
      
      const results = {
        success: [] as Array<{ id: string; title: string }>,
        failed: [] as Array<{ title: string; error: string }>,
      };
      
      for (const bookData of books) {
        try {
          // Validate domain exists
          const domain = await BookDomain.findById(bookData.domainId);
          if (!domain) {
            results.failed.push({ title: bookData.title, error: 'Domain not found' });
            continue;
          }
          
          const maxOrderBook = await Book.findOne({ domainId: bookData.domainId }).sort({ order: -1 }).lean();
          const order = ((maxOrderBook as Record<string, unknown> | null)?.order as number || 0) + 1;
          
          const book = await Book.create({
            domainId: bookData.domainId,
            title: bookData.title,
            author: bookData.author || '',
            subcategory: bookData.subcategory || 'General',
            totalPages: bookData.totalPages || 0,
            status: bookData.status || 'to-read',
            notes: bookData.notes || '',
            order,
            currentPage: 0,
          });
          
          results.success.push({ id: book._id.toString(), title: book.title });
        } catch (error) {
          results.failed.push({
            title: bookData.title,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              message: `Added ${results.success.length} books, ${results.failed.length} failed`,
              results,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ UPDATE BOOK ============
  server.tool(
    'update_book',
    'Update a single book by ID. Only provided fields will be updated.',
    BookUpdateSchema.shape,
    async (params) => {
      await connectDB();
      
      const { id, ...updateData } = params;
      
      // Remove undefined values
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
          return {
            content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Domain not found' }) }],
            isError: true,
          };
        }
      }
      
      const book = await Book.findByIdAndUpdate(id, cleanData, { new: true }).lean();
      
      if (!book) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Book not found', id }) }],
          isError: true,
        };
      }
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ UPDATE MULTIPLE BOOKS ============
  server.tool(
    'update_books',
    'Update multiple books at once. Each update object must include the book ID.',
    {
      updates: z.array(BookUpdateSchema).describe('Array of book updates'),
    },
    async ({ updates }) => {
      await connectDB();
      
      const results = {
        success: [] as Array<{ id: string; title: string }>,
        failed: [] as Array<{ id: string; error: string }>,
      };
      
      for (const update of updates) {
        try {
          const { id, ...updateData } = update;
          
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
              results.failed.push({ id, error: 'Domain not found' });
              continue;
            }
          }
          
          const book = await Book.findByIdAndUpdate(id, cleanData, { new: true }).lean();
          
          if (!book) {
            results.failed.push({ id, error: 'Book not found' });
          } else {
            results.success.push({ id, title: (book as Record<string, unknown>).title as string });
          }
        } catch (error) {
          results.failed.push({
            id: update.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              message: `Updated ${results.success.length} books, ${results.failed.length} failed`,
              results,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ DELETE BOOK ============
  server.tool(
    'delete_book',
    'Delete a single book by ID.',
    {
      id: z.string().describe('The book ID to delete'),
    },
    async ({ id }) => {
      await connectDB();
      
      const book = await Book.findById(id).lean();
      
      if (!book) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Book not found', id }) }],
          isError: true,
        };
      }
      
      await Book.findByIdAndDelete(id);
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: `Book "${(book as Record<string, unknown>).title}" deleted successfully`,
              deletedBook: {
                id,
                title: (book as Record<string, unknown>).title,
              },
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ DELETE MULTIPLE BOOKS ============
  server.tool(
    'delete_books',
    'Delete multiple books by their IDs.',
    {
      ids: z.array(z.string()).describe('Array of book IDs to delete'),
    },
    async ({ ids }) => {
      await connectDB();
      
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
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              message: `Deleted ${results.deleted.length} books, ${results.notFound.length} not found`,
              results,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ============ GET BOOK STATS ============
  server.tool(
    'get_book_stats',
    'Get overall book statistics including counts by status and reading progress.',
    {},
    async () => {
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
      
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    }
  );
}
