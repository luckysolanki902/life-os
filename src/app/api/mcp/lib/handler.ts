/**
 * MCP Request Handler
 * Handles JSON-RPC requests for the MCP protocol directly
 */

import { serverInfo } from '@/app/api/mcp/lib/server';

// Book tools
import { listBooks, listDomains, addBook, addBooks, updateBook, updateBooks, deleteBook, deleteBooks, getBookStats } from '@/app/api/mcp/tools/books-handler';

// Routine tools
import {
  getRoutine, getAllTasks, createTask, updateTask, deleteTask,
  completeTask, uncompleteTask, skipTask, unskipTask,
  reorderTasks, bulkCreateTasks,
} from '@/app/api/mcp/tools/routine-handler';

// Health tools
import {
  getHealthDashboard, logWeight, getWeight, saveMood, getMood,
  getExercisePages, getExercisePage, logExerciseSet, updateExerciseSet, deleteExerciseSet,
  getWorkoutSummary, createExercise, updateExercise, deleteExercise,
  createHealthPage, deleteHealthPage,
} from '@/app/api/mcp/tools/health-handler';

// Learning tools
import {
  getLearningData, listCategories, createCategory, updateCategory, deleteCategory,
  createSkill, updateSkill, deleteSkill,
  logLearning, updateLearningLog, deleteLearningLog, getLearningStats,
} from '@/app/api/mcp/tools/learning-handler';

// Reports & Stats tools
import {
  getOverallReport, getRoutineReport, getHealthReport,
  getStreakData, getIdentityMetric, getLast7DaysCompletion,
} from '@/app/api/mcp/tools/reports-handler';

// Protocol version we support
const PROTOCOL_VERSION = '2024-11-05';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number
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
      // ==================== BOOKS ====================
      {
        name: 'list_books',
        title: 'List Books',
        description: 'List all books with optional filtering by status, domain, or search query. Supports pagination.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['not-started', 'reading', 'finished'], description: 'Filter by reading status' },
            domainId: { type: 'string', description: 'Filter by domain ID' },
            search: { type: 'string', description: 'Search in title or author' },
            limit: { type: 'number', description: 'Max results (default: 50)' },
            page: { type: 'number', description: 'Page number' },
          },
        },
        annotations: { title: 'List Books', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'list_domains',
        title: 'List Book Domains',
        description: 'List all book domains/categories with stats.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'List Domains', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'add_book',
        title: 'Add Book',
        description: 'Add a new book. Specify a domain/category name — it will be created if it does not exist.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Category name (e.g., "Fiction", "Technology")' },
            domainColor: { type: 'string', description: 'Hex color for new domain' },
            domainIcon: { type: 'string', description: 'Emoji icon for new domain' },
            title: { type: 'string' },
            author: { type: 'string' },
            subcategory: { type: 'string' },
            totalPages: { type: ['number', 'null'] },
            status: { type: 'string', enum: ['not-started', 'reading', 'finished'], description: 'Status (default: not-started)' },
            notes: { type: 'string' },
          },
          required: ['domain', 'title'],
        },
        annotations: { title: 'Add Book', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'add_books',
        title: 'Add Multiple Books',
        description: 'Add multiple books at once.',
        inputSchema: {
          type: 'object',
          properties: {
            books: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  domain: { type: 'string' }, domainColor: { type: 'string' }, domainIcon: { type: 'string' },
                  title: { type: 'string' }, author: { type: 'string' }, subcategory: { type: 'string' },
                  totalPages: { type: ['number', 'null'] }, status: { type: 'string' }, notes: { type: 'string' },
                },
                required: ['domain', 'title'],
              },
            },
          },
          required: ['books'],
        },
        annotations: { title: 'Add Multiple Books', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'update_book',
        title: 'Update Book',
        description: 'Update a book by ID. Only provided fields are updated.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' }, title: { type: 'string' }, author: { type: 'string' },
            domain: { type: 'string', description: 'New domain name' },
            subcategory: { type: 'string' }, totalPages: { type: 'number' }, currentPage: { type: 'number' },
            status: { type: 'string', enum: ['not-started', 'reading', 'finished'] },
            notes: { type: 'string' }, rating: { type: 'number', minimum: 1, maximum: 5 },
          },
          required: ['id'],
        },
        annotations: { title: 'Update Book', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'update_books',
        title: 'Update Multiple Books',
        description: 'Update multiple books at once. Each update must include id.',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' }, title: { type: 'string' }, author: { type: 'string' },
                  domain: { type: 'string' }, subcategory: { type: 'string' },
                  totalPages: { type: 'number' }, currentPage: { type: 'number' },
                  status: { type: 'string' }, notes: { type: 'string' }, rating: { type: 'number' },
                },
                required: ['id'],
              },
            },
          },
          required: ['updates'],
        },
        annotations: { title: 'Update Multiple Books', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_book',
        title: 'Delete Book',
        description: 'Delete a book by ID.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Book', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_books',
        title: 'Delete Multiple Books',
        description: 'Delete multiple books by IDs.',
        inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] },
        annotations: { title: 'Delete Multiple Books', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_book_stats',
        title: 'Book Statistics',
        description: 'Get book counts by status and currently reading books.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Book Statistics', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },

      // ==================== ROUTINE ====================
      {
        name: 'get_routine',
        title: 'Get Routine',
        description: 'Get routine tasks and their completion status for a date. Supports filtering by status, domain, and timeOfDay.',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
            status: { type: 'string', enum: ['pending', 'completed', 'skipped'], description: 'Filter by status' },
            domain: { type: 'string', enum: ['health', 'career', 'learning', 'social', 'discipline', 'personality', 'startups'], description: 'Filter by domain' },
            timeOfDay: { type: 'string', enum: ['none', 'morning', 'afternoon', 'evening', 'night', 'day'], description: 'Filter by time of day' },
          },
        },
        annotations: { title: 'Get Routine', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_all_tasks',
        title: 'Get All Tasks',
        description: 'List all active routine task definitions (regardless of recurrence/date).',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Get All Tasks', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'create_task',
        title: 'Create Task',
        description: 'Create a new routine task.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            domainId: { type: 'string', enum: ['health', 'career', 'learning', 'social', 'discipline', 'personality', 'startups'] },
            basePoints: { type: 'number', description: 'Points earned on completion (default: 1)' },
            timeOfDay: { type: 'string', enum: ['none', 'morning', 'afternoon', 'evening', 'night', 'day'] },
            mustDo: { type: 'boolean', description: 'Priority task flag' },
            recurrenceType: { type: 'string', enum: ['daily', 'weekdays', 'weekends', 'custom'] },
            recurrenceDays: { type: 'array', items: { type: 'number' }, description: 'Day numbers for custom recurrence: 0=Sun..6=Sat' },
          },
          required: ['title', 'domainId'],
        },
        annotations: { title: 'Create Task', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'update_task',
        title: 'Update Task',
        description: 'Update a routine task definition by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' }, domainId: { type: 'string' }, basePoints: { type: 'number' },
            timeOfDay: { type: 'string' }, mustDo: { type: 'boolean' },
            recurrenceType: { type: 'string' }, recurrenceDays: { type: 'array', items: { type: 'number' } },
          },
          required: ['id'],
        },
        annotations: { title: 'Update Task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_task',
        title: 'Delete Task',
        description: 'Soft-delete a routine task (set isActive=false).',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Task', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'complete_task',
        title: 'Complete Task',
        description: 'Mark a routine task as completed for a date. Awards base points.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Task ID' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['id'],
        },
        annotations: { title: 'Complete Task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'uncomplete_task',
        title: 'Uncomplete Task',
        description: 'Revert a task to pending status for a date.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['id'],
        },
        annotations: { title: 'Uncomplete Task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'skip_task',
        title: 'Skip Task',
        description: 'Mark a task as skipped for a date (no points).',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['id'],
        },
        annotations: { title: 'Skip Task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'unskip_task',
        title: 'Unskip Task',
        description: 'Revert a skipped task back to pending.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['id'],
        },
        annotations: { title: 'Unskip Task', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'reorder_tasks',
        title: 'Reorder Tasks',
        description: 'Set display order for routine tasks.',
        inputSchema: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, order: { type: 'number' } }, required: ['id', 'order'] } },
          },
          required: ['items'],
        },
        annotations: { title: 'Reorder Tasks', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'bulk_create_tasks',
        title: 'Bulk Create Tasks',
        description: 'Create multiple routine tasks at once.',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' }, domainId: { type: 'string' }, basePoints: { type: 'number' },
                  timeOfDay: { type: 'string' }, mustDo: { type: 'boolean' },
                  recurrenceType: { type: 'string' }, recurrenceDays: { type: 'array', items: { type: 'number' } },
                },
                required: ['title', 'domainId'],
              },
            },
          },
          required: ['tasks'],
        },
        annotations: { title: 'Bulk Create Tasks', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },

      // ==================== HEALTH ====================
      {
        name: 'get_health_dashboard',
        title: 'Health Dashboard',
        description: 'Get full health overview: weight, mood, today\'s workout with exercises and logs.',
        inputSchema: {
          type: 'object',
          properties: { date: { type: 'string', description: 'YYYY-MM-DD (default: today)' } },
        },
        annotations: { title: 'Health Dashboard', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'log_weight',
        title: 'Log Weight',
        description: 'Log or update weight for a date (in kg). Upserts if entry exists.',
        inputSchema: {
          type: 'object',
          properties: {
            weight: { type: 'number', description: 'Weight in kg' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['weight'],
        },
        annotations: { title: 'Log Weight', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_weight',
        title: 'Get Weight',
        description: 'Get weight for a specific date, date range, or recent entries.',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date YYYY-MM-DD' },
            startDate: { type: 'string', description: 'Range start YYYY-MM-DD' },
            endDate: { type: 'string', description: 'Range end YYYY-MM-DD' },
            limit: { type: 'number', description: 'Max recent entries (default: 30)' },
          },
        },
        annotations: { title: 'Get Weight', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'save_mood',
        title: 'Save Mood',
        description: 'Save or update mood for a date.',
        inputSchema: {
          type: 'object',
          properties: {
            mood: { type: 'string', enum: ['great', 'good', 'okay', 'low', 'bad'] },
            note: { type: 'string', description: 'Optional note (max 200 chars)' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['mood'],
        },
        annotations: { title: 'Save Mood', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_mood',
        title: 'Get Mood',
        description: 'Get mood for a date or date range.',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Single date YYYY-MM-DD' },
            startDate: { type: 'string', description: 'Range start' },
            endDate: { type: 'string', description: 'Range end' },
          },
        },
        annotations: { title: 'Get Mood', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_exercise_pages',
        title: 'Get Exercise Pages',
        description: 'List all exercise day pages (workout splits) with their exercises.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Get Exercise Pages', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_exercise_page',
        title: 'Get Exercise Page Detail',
        description: 'Get a specific exercise page with exercise logs for a date.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['pageId'],
        },
        annotations: { title: 'Get Exercise Page', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'log_exercise_set',
        title: 'Log Exercise Sets',
        description: 'Log sets for an exercise on a date. Upserts the log.',
        inputSchema: {
          type: 'object',
          properties: {
            exerciseId: { type: 'string' },
            sets: { type: 'array', items: { type: 'object', properties: { reps: { type: 'number' }, weight: { type: 'number' }, duration: { type: 'number' } } } },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['exerciseId', 'sets'],
        },
        annotations: { title: 'Log Exercise Sets', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'update_exercise_set',
        title: 'Update Exercise Set',
        description: 'Update a specific set within an exercise log.',
        inputSchema: {
          type: 'object',
          properties: {
            logId: { type: 'string', description: 'Exercise log ID' },
            setIndex: { type: 'number', description: '0-based set index' },
            reps: { type: 'number' }, weight: { type: 'number' }, duration: { type: 'number' },
          },
          required: ['logId', 'setIndex'],
        },
        annotations: { title: 'Update Exercise Set', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_exercise_set',
        title: 'Delete Exercise Set',
        description: 'Delete a specific set from an exercise log.',
        inputSchema: {
          type: 'object',
          properties: {
            logId: { type: 'string' },
            setIndex: { type: 'number', description: '0-based set index' },
          },
          required: ['logId', 'setIndex'],
        },
        annotations: { title: 'Delete Exercise Set', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_workout_summary',
        title: 'Workout Summary',
        description: 'Get today\'s workout summary: exercises done, sets, reps, muscles worked.',
        inputSchema: {
          type: 'object',
          properties: { date: { type: 'string', description: 'YYYY-MM-DD (default: today)' } },
        },
        annotations: { title: 'Workout Summary', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'create_exercise',
        title: 'Create Exercise',
        description: 'Add a new exercise definition to a workout page.',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string', enum: ['reps', 'duration', 'distance'] },
            targetMuscles: { type: 'array', items: { type: 'string' }, description: 'E.g., Chest, Back, Biceps, Triceps, Shoulders, Quads, Hamstrings, Glutes, Calves, Abs' },
            initialSets: { type: 'number' },
            initialReps: { type: 'number' },
            recommendedWeight: { type: 'number', description: '0 for bodyweight, else kg' },
          },
          required: ['pageId', 'title'],
        },
        annotations: { title: 'Create Exercise', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'update_exercise',
        title: 'Update Exercise',
        description: 'Update an exercise definition.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' }, title: { type: 'string' }, type: { type: 'string' },
            targetMuscles: { type: 'array', items: { type: 'string' } },
            initialSets: { type: 'number' }, initialReps: { type: 'number' }, recommendedWeight: { type: 'number' },
          },
          required: ['id'],
        },
        annotations: { title: 'Update Exercise', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_exercise',
        title: 'Delete Exercise',
        description: 'Delete an exercise definition.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Exercise', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'create_health_page',
        title: 'Create Health Page',
        description: 'Create a new workout day/page (e.g., "Push Day", "Leg Day").',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title'],
        },
        annotations: { title: 'Create Health Page', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'delete_health_page',
        title: 'Delete Health Page',
        description: 'Delete a workout page and all its exercises.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Health Page', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },

      // ==================== LEARNING ====================
      {
        name: 'get_learning_data',
        title: 'Get Learning Data',
        description: 'Get all learning categories, skills, and recent logs with stats.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Get Learning Data', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'list_learning_categories',
        title: 'List Learning Categories',
        description: 'List all learning categories.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'List Learning Categories', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'create_learning_category',
        title: 'Create Learning Category',
        description: 'Create a new learning category.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            icon: { type: 'string', description: 'Emoji (default: 📚)' },
            color: { type: 'string', description: 'Color name (default: violet)' },
          },
          required: ['title'],
        },
        annotations: { title: 'Create Learning Category', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'update_learning_category',
        title: 'Update Learning Category',
        description: 'Update a learning category.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' }, icon: { type: 'string' }, color: { type: 'string' } },
          required: ['id'],
        },
        annotations: { title: 'Update Learning Category', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_learning_category',
        title: 'Delete Learning Category',
        description: 'Delete a category and all its skills and logs.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Learning Category', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'create_learning_skill',
        title: 'Create Learning Skill',
        description: 'Create a skill under a category. Can look up category by name.',
        inputSchema: {
          type: 'object',
          properties: {
            categoryId: { type: 'string', description: 'Category ID' },
            categoryName: { type: 'string', description: 'Or category name (case-insensitive)' },
            name: { type: 'string' },
          },
          required: ['name'],
        },
        annotations: { title: 'Create Learning Skill', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'update_learning_skill',
        title: 'Update Learning Skill',
        description: 'Update a learning skill.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, categoryId: { type: 'string' } },
          required: ['id'],
        },
        annotations: { title: 'Update Learning Skill', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_learning_skill',
        title: 'Delete Learning Skill',
        description: 'Delete a skill and all its logs.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Learning Skill', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'log_learning',
        title: 'Log Learning',
        description: 'Log a learning session. Can look up skill by name.',
        inputSchema: {
          type: 'object',
          properties: {
            skillId: { type: 'string' },
            skillName: { type: 'string', description: 'Or skill name (case-insensitive)' },
            categoryName: { type: 'string', description: 'Helps disambiguate skill name' },
            duration: { type: 'number', description: 'Duration in minutes' },
            date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          },
          required: ['duration'],
        },
        annotations: { title: 'Log Learning', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      {
        name: 'update_learning_log',
        title: 'Update Learning Log',
        description: 'Update duration of a learning log.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, duration: { type: 'number' } },
          required: ['id', 'duration'],
        },
        annotations: { title: 'Update Learning Log', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'delete_learning_log',
        title: 'Delete Learning Log',
        description: 'Delete a learning log entry.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        annotations: { title: 'Delete Learning Log', readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_learning_stats',
        title: 'Learning Stats',
        description: 'Get learning statistics: total hours, breakdown by category/skill.',
        inputSchema: {
          type: 'object',
          properties: { days: { type: 'number', description: 'Number of days to analyze (default: 30)' } },
        },
        annotations: { title: 'Learning Stats', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },

      // ==================== REPORTS & STATS ====================
      {
        name: 'get_overall_report',
        title: 'Overall Report',
        description: 'Comprehensive report across all domains for a time period. Includes routine completion, weight, mood, exercise, books, and learning.',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['today', 'last7Days', 'last14Days', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'thisYear', 'allTime'],
              description: 'Time period (default: today)',
            },
          },
        },
        annotations: { title: 'Overall Report', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_routine_report',
        title: 'Routine Report',
        description: 'Detailed routine analytics: per-task completion rates, domain breakdown, best/worst tasks.',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['today', 'last7Days', 'last14Days', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'thisYear', 'allTime'],
              description: 'Time period (default: today)',
            },
          },
        },
        annotations: { title: 'Routine Report', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_health_report',
        title: 'Health Report',
        description: 'Health analytics: weight trend, exercise frequency, muscle hit map, mood trend.',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['today', 'last7Days', 'last14Days', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last3Months', 'last6Months', 'thisYear', 'allTime'],
              description: 'Time period (default: today)',
            },
          },
        },
        annotations: { title: 'Health Report', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_streak_data',
        title: 'Streak Data',
        description: 'Get current streak, longest streak, milestones, and bonus points.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Streak Data', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_identity_metric',
        title: 'Better Percentage',
        description: 'Get the "better percentage" identity metric and point breakdown (routine + streak + exercise).',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Better Percentage', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      {
        name: 'get_last_7_days',
        title: 'Last 7 Days Completion',
        description: 'Get daily task completion rates for the past 7 days.',
        inputSchema: { type: 'object', properties: {} },
        annotations: { title: 'Last 7 Days', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
    ],
  };
}

async function handleToolCall(params: Record<string, unknown>): Promise<unknown> {
  const toolName = params.name as string;
  const toolArgs = (params.arguments || {}) as Record<string, unknown>;
  
  switch (toolName) {
    // Books
    case 'list_books': return listBooks(toolArgs);
    case 'list_domains': return listDomains();
    case 'add_book': return addBook(toolArgs);
    case 'add_books': return addBooks(toolArgs.books as Array<Record<string, unknown>>);
    case 'update_book': return updateBook(toolArgs);
    case 'update_books': return updateBooks(toolArgs.updates as Array<Record<string, unknown>>);
    case 'delete_book': return deleteBook(toolArgs.id as string);
    case 'delete_books': return deleteBooks(toolArgs.ids as string[]);
    case 'get_book_stats': return getBookStats();

    // Routine
    case 'get_routine': return getRoutine(toolArgs);
    case 'get_all_tasks': return getAllTasks();
    case 'create_task': return createTask(toolArgs);
    case 'update_task': return updateTask(toolArgs);
    case 'delete_task': return deleteTask(toolArgs);
    case 'complete_task': return completeTask(toolArgs);
    case 'uncomplete_task': return uncompleteTask(toolArgs);
    case 'skip_task': return skipTask(toolArgs);
    case 'unskip_task': return unskipTask(toolArgs);
    case 'reorder_tasks': return reorderTasks(toolArgs);
    case 'bulk_create_tasks': return bulkCreateTasks(toolArgs);

    // Health
    case 'get_health_dashboard': return getHealthDashboard(toolArgs);
    case 'log_weight': return logWeight(toolArgs);
    case 'get_weight': return getWeight(toolArgs);
    case 'save_mood': return saveMood(toolArgs);
    case 'get_mood': return getMood(toolArgs);
    case 'get_exercise_pages': return getExercisePages();
    case 'get_exercise_page': return getExercisePage(toolArgs);
    case 'log_exercise_set': return logExerciseSet(toolArgs);
    case 'update_exercise_set': return updateExerciseSet(toolArgs);
    case 'delete_exercise_set': return deleteExerciseSet(toolArgs);
    case 'get_workout_summary': return getWorkoutSummary(toolArgs);
    case 'create_exercise': return createExercise(toolArgs);
    case 'update_exercise': return updateExercise(toolArgs);
    case 'delete_exercise': return deleteExercise(toolArgs);
    case 'create_health_page': return createHealthPage(toolArgs);
    case 'delete_health_page': return deleteHealthPage(toolArgs);

    // Learning
    case 'get_learning_data': return getLearningData();
    case 'list_learning_categories': return listCategories();
    case 'create_learning_category': return createCategory(toolArgs);
    case 'update_learning_category': return updateCategory(toolArgs);
    case 'delete_learning_category': return deleteCategory(toolArgs);
    case 'create_learning_skill': return createSkill(toolArgs);
    case 'update_learning_skill': return updateSkill(toolArgs);
    case 'delete_learning_skill': return deleteSkill(toolArgs);
    case 'log_learning': return logLearning(toolArgs);
    case 'update_learning_log': return updateLearningLog(toolArgs);
    case 'delete_learning_log': return deleteLearningLog(toolArgs);
    case 'get_learning_stats': return getLearningStats(toolArgs);

    // Reports & Stats
    case 'get_overall_report': return getOverallReport(toolArgs);
    case 'get_routine_report': return getRoutineReport(toolArgs);
    case 'get_health_report': return getHealthReport(toolArgs);
    case 'get_streak_data': return getStreakData();
    case 'get_identity_metric': return getIdentityMetric();
    case 'get_last_7_days': return getLast7DaysCompletion();

    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${toolName}` }) }],
        isError: true,
      };
  }
}
