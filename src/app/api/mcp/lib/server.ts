/**
 * MCP Server Instance
 * Central MCP server configuration
 */

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
