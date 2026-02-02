/**
 * MCP Request Handler
 * Handles JSON-RPC requests for the MCP protocol directly
 */

import { serverInfo } from '@/app/api/mcp/lib/server';
import { listBooks, listDomains, addBook, addBooks, updateBook, updateBooks, deleteBook, deleteBooks, getBookStats } from '@/app/api/mcp/tools/books-handler';

// Protocol version we support
const PROTOCOL_VERSION = '2024-11-05';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Handle an MCP JSON-RPC request
 */
export async function handleMcpRequest(request: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const { jsonrpc, id, method, params } = request;
  
  // Validate JSON-RPC version
  if (jsonrpc !== '2.0') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }
    };
  }
  
  // If no id, it's a notification - no response needed
  if (id === undefined) {
    // Handle notification (we don't need to respond)
    await handleNotification(method, params);
    return null;
  }
  
  // Handle the request method
  try {
    const result = await handleMethod(method, params || {});
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error instanceof MethodNotFoundError ? -32601 : -32603;
    return {
      jsonrpc: '2.0',
      id,
      error: { code: errorCode, message: errorMessage }
    };
  }
}

class MethodNotFoundError extends Error {
  constructor(method: string) {
    super(`Method not found: ${method}`);
    this.name = 'MethodNotFoundError';
  }
}

async function handleNotification(method: string, params?: Record<string, unknown>): Promise<void> {
  void params; // Suppress unused warning
  // Handle notifications (no response needed)
  switch (method) {
    case 'notifications/initialized':
      // Client is ready
      console.log('[MCP] Client initialized');
      break;
    case 'notifications/cancelled':
      // Request was cancelled
      console.log('[MCP] Request cancelled');
      break;
    default:
      console.log(`[MCP] Unknown notification: ${method}`);
  }
}

async function handleMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    // ============ LIFECYCLE ============
    case 'initialize':
      return handleInitialize(params);
    
    // ============ TOOLS ============
    case 'tools/list':
      return handleToolsList();
    
    case 'tools/call':
      return handleToolCall(params);
    
    // ============ OTHER METHODS ============
    case 'ping':
      return {};
    
    default:
      throw new MethodNotFoundError(method);
  }
}

function handleInitialize(params: Record<string, unknown>): unknown {
  void params; // Suppress unused warning
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false
      }
    },
    serverInfo: {
      name: serverInfo.name,
      version: serverInfo.version
    }
  };
}

function handleToolsList(): unknown {
  return {
    tools: [
      {
        name: 'list_books',
        description: 'List all books with optional filtering by status or domain. Returns book details including title, author, status, progress, and domain info.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['to-read', 'reading', 'paused', 'completed', 'dropped'],
              description: 'Filter by reading status'
            },
            domainId: {
              type: 'string',
              description: 'Filter by domain ID'
            },
            search: {
              type: 'string',
              description: 'Search in title or author'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of books to return (default: 50)'
            },
            page: {
              type: 'number',
              description: 'Page number for pagination'
            }
          }
        }
      },
      {
        name: 'list_domains',
        description: 'List all book domains/categories. Use this to get domain IDs for adding books.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'add_book',
        description: 'Add a new book to the reading list. Requires a domain ID (use list_domains to get available domains).',
        inputSchema: {
          type: 'object',
          properties: {
            domainId: { type: 'string', description: 'The ID of the domain this book belongs to' },
            title: { type: 'string', description: 'The title of the book' },
            author: { type: 'string', description: 'The author of the book' },
            subcategory: { type: 'string', description: 'Subcategory within the domain' },
            totalPages: { type: 'number', description: 'Total number of pages' },
            status: {
              type: 'string',
              enum: ['to-read', 'reading', 'paused', 'completed', 'dropped'],
              description: 'Reading status'
            },
            notes: { type: 'string', description: 'Personal notes about the book' }
          },
          required: ['domainId', 'title']
        }
      },
      {
        name: 'add_books',
        description: 'Add multiple books at once. Each book requires a domain ID.',
        inputSchema: {
          type: 'object',
          properties: {
            books: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  domainId: { type: 'string' },
                  title: { type: 'string' },
                  author: { type: 'string' },
                  subcategory: { type: 'string' },
                  totalPages: { type: 'number' },
                  status: { type: 'string' },
                  notes: { type: 'string' }
                },
                required: ['domainId', 'title']
              },
              description: 'Array of books to add'
            }
          },
          required: ['books']
        }
      },
      {
        name: 'update_book',
        description: 'Update a single book by ID. Only provided fields will be updated.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The book ID to update' },
            title: { type: 'string', description: 'New title' },
            author: { type: 'string', description: 'New author' },
            domainId: { type: 'string', description: 'New domain ID' },
            subcategory: { type: 'string', description: 'New subcategory' },
            totalPages: { type: 'number', description: 'New total pages' },
            currentPage: { type: 'number', description: 'Current page number' },
            status: {
              type: 'string',
              enum: ['to-read', 'reading', 'paused', 'completed', 'dropped'],
              description: 'New status'
            },
            notes: { type: 'string', description: 'New notes' },
            rating: { type: 'number', minimum: 1, maximum: 5, description: 'Rating from 1-5' }
          },
          required: ['id']
        }
      },
      {
        name: 'update_books',
        description: 'Update multiple books at once. Each update object must include the book ID.',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  author: { type: 'string' },
                  domainId: { type: 'string' },
                  subcategory: { type: 'string' },
                  totalPages: { type: 'number' },
                  currentPage: { type: 'number' },
                  status: { type: 'string' },
                  notes: { type: 'string' },
                  rating: { type: 'number' }
                },
                required: ['id']
              },
              description: 'Array of book updates'
            }
          },
          required: ['updates']
        }
      },
      {
        name: 'delete_book',
        description: 'Delete a single book by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The book ID to delete' }
          },
          required: ['id']
        }
      },
      {
        name: 'delete_books',
        description: 'Delete multiple books by their IDs.',
        inputSchema: {
          type: 'object',
          properties: {
            ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of book IDs to delete'
            }
          },
          required: ['ids']
        }
      },
      {
        name: 'get_book_stats',
        description: 'Get overall book statistics including counts by status and reading progress.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
}

async function handleToolCall(params: Record<string, unknown>): Promise<unknown> {
  const toolName = params.name as string;
  const toolArgs = (params.arguments || {}) as Record<string, unknown>;
  
  switch (toolName) {
    case 'list_books':
      return listBooks(toolArgs);
    
    case 'list_domains':
      return listDomains();
    
    case 'add_book':
      return addBook(toolArgs);
    
    case 'add_books':
      return addBooks(toolArgs.books as Array<Record<string, unknown>>);
    
    case 'update_book':
      return updateBook(toolArgs);
    
    case 'update_books':
      return updateBooks(toolArgs.updates as Array<Record<string, unknown>>);
    
    case 'delete_book':
      return deleteBook(toolArgs.id as string);
    
    case 'delete_books':
      return deleteBooks(toolArgs.ids as string[]);
    
    case 'get_book_stats':
      return getBookStats();
    
    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
        isError: true
      };
  }
}
