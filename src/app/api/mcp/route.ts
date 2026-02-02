/**
 * MCP Server Route Handler
 * Implements MCP protocol directly for Next.js API routes
 * 
 * Endpoint: /api/mcp
 * Authentication: Static client_id + client_secret (Basic or Bearer auth)
 * 
 * This implementation handles JSON-RPC messages directly without using
 * the SDK's transport layer which requires Node.js HTTP primitives.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAuth } from './lib/auth';
import { serverInfo } from './lib/server';
import { handleMcpRequest } from './lib/handler';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle MCP requests via POST
 * This handles the JSON-RPC messages for MCP
 */
export async function POST(request: NextRequest): Promise<Response> {
  // Validate authentication
  const authResult = validateAuth(request);
  if (!authResult.valid) {
    return NextResponse.json(
      { 
        jsonrpc: '2.0', 
        error: { 
          code: -32001, 
          message: authResult.error || 'Unauthorized' 
        },
        id: null
      },
      { status: 401, headers: corsHeaders }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const response = await handleMcpRequest(body);
    
    if (response === null) {
      // Notification - no response needed
      return new Response(null, { status: 202, headers: corsHeaders });
    }
    
    return NextResponse.json(response, { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('MCP request error:', error);
    return NextResponse.json(
      { 
        jsonrpc: '2.0', 
        error: { 
          code: -32603, 
          message: error instanceof Error ? error.message : 'Internal error' 
        },
        id: body?.id || null 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Handle GET requests - Method not allowed for this simple implementation
 */
export async function GET(): Promise<Response> {
  return NextResponse.json(
    { 
      jsonrpc: '2.0', 
      error: { code: -32000, message: 'Method not allowed. Use POST for MCP requests.' },
      id: null 
    },
    { status: 405, headers: { ...corsHeaders, 'Allow': 'POST, OPTIONS' } }
  );
}

/**
 * Handle DELETE requests - Method not allowed for stateless implementation
 */
export async function DELETE(): Promise<Response> {
  return NextResponse.json(
    { 
      jsonrpc: '2.0', 
      error: { code: -32000, message: 'Method not allowed. This is a stateless server.' },
      id: null 
    },
    { status: 405, headers: { ...corsHeaders, 'Allow': 'POST, OPTIONS' } }
  );
}

/**
 * Handle OPTIONS for CORS preflight
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Export server info for discovery endpoint
export { serverInfo };
