/**
 * MCP Server Instance
 * Central MCP server configuration with all tools registered
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBookTools } from '../tools/books';
import { getCredentials } from './auth';

// Create and configure the MCP server
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'lifedashboard-books-mcp',
    version: '1.0.0',
  });

  // Register all tools
  registerBookTools(server);

  return server;
}

// Server info for discovery
export const serverInfo = {
  name: 'lifedashboard-books-mcp',
  version: '1.0.0',
  description: 'MCP server for managing books in LifeDashboard',
  capabilities: {
    tools: {
      listChanged: false,
    },
  },
};

// Re-export getCredentials for convenience
export { getCredentials };
