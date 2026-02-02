# LifeDashboard Books MCP Server

This is an MCP (Model Context Protocol) server for managing books in LifeDashboard. It provides tools for listing, adding, updating, and deleting books through the MCP protocol.

## Endpoints

- **POST `/api/mcp`** - Main MCP endpoint for JSON-RPC requests
- **GET `/api/mcp/info`** - Discovery endpoint with server info and credentials

## Authentication

The server uses static client credentials for authentication. Include the Authorization header in all requests:

### Basic Auth
```
Authorization: Basic base64(client_id:client_secret)
```

### Bearer Token
```
Authorization: Bearer client_id:client_secret
```

### Default Credentials (Development)
- **Client ID**: `lifedashboard-mcp-client`
- **Client Secret**: `lifedashboard-mcp-secret-2024`

In production, set these environment variables:
- `MCP_CLIENT_ID`
- `MCP_CLIENT_SECRET`

## Available Tools

### 1. `list_books`
List all books with optional filtering.

**Parameters:**
- `status` (optional): Filter by status - `to-read`, `reading`, `paused`, `completed`, `dropped`
- `domainId` (optional): Filter by domain ID
- `search` (optional): Search in title or author
- `limit` (optional): Max results (default: 50)
- `page` (optional): Page number

### 2. `list_domains`
List all book domains/categories with stats.

### 3. `add_book`
Add a single book.

**Parameters:**
- `domainId` (required): Domain ID
- `title` (required): Book title
- `author` (optional): Author name
- `subcategory` (optional): Subcategory within domain
- `totalPages` (optional): Total pages
- `status` (optional): Initial status
- `notes` (optional): Personal notes

### 4. `add_books`
Add multiple books at once.

**Parameters:**
- `books`: Array of book objects (same structure as add_book)

### 5. `update_book`
Update a single book.

**Parameters:**
- `id` (required): Book ID
- All other book fields are optional

### 6. `update_books`
Update multiple books at once.

**Parameters:**
- `updates`: Array of update objects (each must include `id`)

### 7. `delete_book`
Delete a single book.

**Parameters:**
- `id` (required): Book ID to delete

### 8. `delete_books`
Delete multiple books.

**Parameters:**
- `ids` (required): Array of book IDs to delete

### 9. `get_book_stats`
Get overall book statistics.

## Usage Examples

### Initialize Connection
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Basic $(echo -n 'lifedashboard-mcp-client:lifedashboard-mcp-secret-2024' | base64)" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

### List Tools
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Basic $(echo -n 'lifedashboard-mcp-client:lifedashboard-mcp-secret-2024' | base64)" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'
```

### Call a Tool (List Books)
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Basic $(echo -n 'lifedashboard-mcp-client:lifedashboard-mcp-secret-2024' | base64)" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "list_books",
      "arguments": {
        "status": "reading",
        "limit": 10
      }
    }
  }'
```

### Add a Book
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Basic $(echo -n 'lifedashboard-mcp-client:lifedashboard-mcp-secret-2024' | base64)" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "add_book",
      "arguments": {
        "domainId": "YOUR_DOMAIN_ID",
        "title": "The Pragmatic Programmer",
        "author": "David Thomas, Andrew Hunt",
        "totalPages": 352,
        "status": "to-read"
      }
    }
  }'
```

### Delete Multiple Books
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Basic $(echo -n 'lifedashboard-mcp-client:lifedashboard-mcp-secret-2024' | base64)" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "delete_books",
      "arguments": {
        "ids": ["book_id_1", "book_id_2", "book_id_3"]
      }
    }
  }'
```

## MCP Client Configuration

To use this server with an MCP client (like Claude Desktop), add this configuration:

```json
{
  "mcpServers": {
    "lifedashboard-books": {
      "transport": "streamable-http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Basic bGlmZWRhc2hib2FyZC1tY3AtY2xpZW50OmxpZmVkYXNoYm9hcmQtbWNwLXNlY3JldC0yMDI0"
      }
    }
  }
}
```

## Protocol

This server implements a simplified version of the MCP protocol over HTTP:
- **Protocol Version**: 2024-11-05
- **Transport**: HTTP POST (stateless)
- **Format**: JSON-RPC 2.0
