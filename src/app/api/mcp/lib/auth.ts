/**
 * Static MCP Authentication
 * Uses a simple client_id + client_secret pair for authentication
 */

// Static credentials - in production, use environment variables
const STATIC_CLIENT_ID = process.env.MCP_CLIENT_ID || 'lifedashboard-mcp-client';
const STATIC_CLIENT_SECRET = process.env.MCP_CLIENT_SECRET || 'lifedashboard-mcp-secret-2024';

export interface AuthResult {
  valid: boolean;
  error?: string;
  clientId?: string;
}

/**
 * Validates the Authorization header for MCP requests
 * Expects: Basic base64(client_id:client_secret)
 */
export function validateAuth(request: Request): AuthResult {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }
  
  // Support both Basic and Bearer auth
  if (authHeader.startsWith('Basic ')) {
    return validateBasicAuth(authHeader);
  } else if (authHeader.startsWith('Bearer ')) {
    return validateBearerAuth(authHeader);
  }
  
  return { valid: false, error: 'Invalid Authorization scheme. Use Basic or Bearer.' };
}

function validateBasicAuth(authHeader: string): AuthResult {
  try {
    const base64Credentials = authHeader.slice(6); // Remove 'Basic '
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [clientId, clientSecret] = credentials.split(':');
    
    if (clientId === STATIC_CLIENT_ID && clientSecret === STATIC_CLIENT_SECRET) {
      return { valid: true, clientId };
    }
    
    return { valid: false, error: 'Invalid client credentials' };
  } catch {
    return { valid: false, error: 'Invalid Basic auth encoding' };
  }
}

function validateBearerAuth(authHeader: string): AuthResult {
  // For Bearer, we expect the token to be: client_id:client_secret
  try {
    const token = authHeader.slice(7); // Remove 'Bearer '
    const [clientId, clientSecret] = token.split(':');
    
    if (clientId === STATIC_CLIENT_ID && clientSecret === STATIC_CLIENT_SECRET) {
      return { valid: true, clientId };
    }
    
    return { valid: false, error: 'Invalid bearer token' };
  } catch {
    return { valid: false, error: 'Invalid Bearer token format' };
  }
}

/**
 * Creates the Basic auth header value for client usage
 */
export function createAuthHeader(): string {
  const credentials = `${STATIC_CLIENT_ID}:${STATIC_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

/**
 * Gets the static credentials for documentation
 */
export function getCredentials() {
  return {
    clientId: STATIC_CLIENT_ID,
    clientSecret: STATIC_CLIENT_SECRET,
  };
}
