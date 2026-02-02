/**
 * MCP Server Info/Discovery Endpoint
 * Provides server information and authentication details
 */

import { NextResponse } from 'next/server';
import { serverInfo } from '@/app/api/mcp/lib/server';
import { getCredentials } from '@/app/api/mcp/lib/auth';

export async function GET() {
  const credentials = getCredentials();
  
  return NextResponse.json({
    name: serverInfo.name,
    version: serverInfo.version,
    description: serverInfo.description,
    protocol: {
      version: '2025-03-26',
      transport: 'streamable-http',
    },
    endpoint: '/api/mcp',
    authentication: {
      type: 'static',
      methods: ['Basic', 'Bearer'],
      instructions: {
        basic: `Use Basic auth with client_id:client_secret encoded in base64`,
        bearer: `Use Bearer token with format: client_id:client_secret`,
      },
      credentials: {
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        note: 'For development only. In production, set MCP_CLIENT_ID and MCP_CLIENT_SECRET environment variables.',
      },
    },
    tools: [
      {
        name: 'list_books',
        description: 'List all books with optional filtering by status or domain',
      },
      {
        name: 'list_domains',
        description: 'List all book domains/categories',
      },
      {
        name: 'add_book',
        description: 'Add a new book to the reading list',
      },
      {
        name: 'add_books',
        description: 'Add multiple books at once',
      },
      {
        name: 'update_book',
        description: 'Update a single book by ID',
      },
      {
        name: 'update_books',
        description: 'Update multiple books at once',
      },
      {
        name: 'delete_book',
        description: 'Delete a single book by ID',
      },
      {
        name: 'delete_books',
        description: 'Delete multiple books by their IDs',
      },
      {
        name: 'get_book_stats',
        description: 'Get overall book statistics',
      },
    ],
    usage: {
      example: {
        curl: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Basic $(echo -n '${credentials.clientId}:${credentials.clientSecret}' | base64)" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'`,
      },
      mcpConfig: {
        note: 'Add this to your MCP client configuration',
        config: {
          'lifedashboard-books': {
            transport: 'streamable-http',
            url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp`,
            headers: {
              Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64')}`,
            },
          },
        },
      },
    },
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
