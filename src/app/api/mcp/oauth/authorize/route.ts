/**
 * OAuth 2.0 Authorization Endpoint
 * Handles authorization_code flow for ChatGPT and other OAuth clients
 * 
 * For static credentials, this auto-approves known clients
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { storeAuthCode } from '@/app/api/mcp/lib/oauth-store';

// Static credentials from environment
const STATIC_CLIENT_ID = process.env.STATIC_CLIENT_ID || process.env.MCP_CLIENT_ID || 'lifedashboard-mcp-client';
const STATIC_CLIENT_SECRET = process.env.STATIC_CLIENT_SECRET || process.env.MCP_CLIENT_SECRET || 'lifedashboard-mcp-secret-2024';

function generateCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateAuthPage(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  error?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LifeOS MCP Authorization</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #1a1a2e;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 24px;
    }
    .client-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .client-info label {
      color: #888;
      font-size: 12px;
      text-transform: uppercase;
    }
    .client-info p {
      color: #333;
      font-weight: 500;
    }
    .scope-list {
      margin-bottom: 24px;
    }
    .scope-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .scope-item:last-child { border-bottom: none; }
    .scope-icon { font-size: 18px; }
    input[type="password"] {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 16px;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    input[type="password"]:focus {
      outline: none;
      border-color: #4a90d9;
    }
    .error {
      background: #fee;
      color: #c00;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    button:hover { transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    .btn-authorize {
      background: linear-gradient(135deg, #4a90d9 0%, #357abd 100%);
      color: white;
    }
    .btn-cancel {
      background: #f5f5f5;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 LifeOS MCP</h1>
    <p class="subtitle">Authorize access to your books and data</p>
    
    <div class="client-info">
      <label>Application</label>
      <p>${params.clientId}</p>
    </div>
    
    <div class="scope-list">
      <div class="scope-item">
        <span class="scope-icon">📚</span>
        <span>Read and manage your books</span>
      </div>
      <div class="scope-item">
        <span class="scope-icon">📊</span>
        <span>View reading statistics</span>
      </div>
      <div class="scope-item">
        <span class="scope-icon">✏️</span>
        <span>Add and update book entries</span>
      </div>
    </div>
    
    ${params.error ? `<div class="error">${params.error}</div>` : ''}
    
    <form method="POST">
      <input type="hidden" name="client_id" value="${params.clientId}">
      <input type="hidden" name="redirect_uri" value="${params.redirectUri}">
      <input type="hidden" name="scope" value="${params.scope}">
      ${params.state ? `<input type="hidden" name="state" value="${params.state}">` : ''}
      
      <input 
        type="password" 
        name="client_secret" 
        placeholder="Enter Client Secret"
        required
        autocomplete="current-password"
      >
      
      <div class="buttons">
        <button type="button" class="btn-cancel" onclick="window.close()">Cancel</button>
        <button type="submit" class="btn-authorize">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>
  `;
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  
  const responseType = searchParams.get('response_type');
  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const scope = searchParams.get('scope') || 'mcp:read mcp:write';
  const state = searchParams.get('state');
  
  // PKCE parameters
  const codeChallenge = searchParams.get('code_challenge');
  const codeChallengeMethod = searchParams.get('code_challenge_method') || 'S256';

  // Validate required parameters
  if (!responseType || !clientId || !redirectUri) {
    return new Response(
      generateAuthPage({
        clientId: clientId || 'Unknown',
        redirectUri: redirectUri || '',
        scope,
        error: 'Missing required parameters (response_type, client_id, redirect_uri)',
      }),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (responseType !== 'code') {
    return new Response(
      generateAuthPage({
        clientId,
        redirectUri,
        scope,
        error: 'Only response_type=code is supported',
      }),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // For known/trusted clients or PKCE flows (public clients like ChatGPT),
  // auto-authorize and redirect with code immediately.
  // PKCE provides security via code_challenge/code_verifier — no client_secret needed.
  if (codeChallenge || clientId === STATIC_CLIENT_ID) {
    // Generate authorization code
    const code = generateCode();
    
    console.log('[OAuth Authorize] Auto-approving known client');
    console.log('[OAuth Authorize] Generated code:', code.substring(0, 20) + '...');
    console.log('[OAuth Authorize] PKCE code_challenge:', codeChallenge?.substring(0, 20) + '...');
    console.log('[OAuth Authorize] PKCE code_challenge_method:', codeChallengeMethod);
    
    // Store the code with PKCE challenge
    storeAuthCode(code, {
      clientId,
      redirectUri,
      scope,
      codeChallenge: codeChallenge || undefined,
      codeChallengeMethod: codeChallenge ? codeChallengeMethod : undefined,
    });
    
    console.log('[OAuth Authorize] Code stored successfully');

    // Redirect back to client with code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    return NextResponse.redirect(redirectUrl.toString(), 302);
  }

  // For unknown clients, show authorization page
  return new Response(
    generateAuthPage({ clientId, redirectUri, scope, state: state || undefined }),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: URLSearchParams;
  
  try {
    const text = await request.text();
    body = new URLSearchParams(text);
  } catch {
    return new Response('Invalid request', { status: 400 });
  }

  const clientId = body.get('client_id');
  const clientSecret = body.get('client_secret');
  const redirectUri = body.get('redirect_uri');
  const scope = body.get('scope') || 'mcp:read mcp:write';
  const state = body.get('state');

  if (!clientId || !clientSecret || !redirectUri) {
    return new Response(
      generateAuthPage({
        clientId: clientId || 'Unknown',
        redirectUri: redirectUri || '',
        scope,
        error: 'Missing required fields',
      }),
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Validate credentials
  if (clientId !== STATIC_CLIENT_ID || clientSecret !== STATIC_CLIENT_SECRET) {
    return new Response(
      generateAuthPage({
        clientId,
        redirectUri,
        scope,
        state: state || undefined,
        error: 'Invalid client credentials',
      }),
      { status: 401, headers: { 'Content-Type': 'text/html' } }
    );
  }

  // Generate authorization code
  const code = generateCode();
  
  // Store the code using shared store
  storeAuthCode(code, {
    clientId,
    redirectUri,
    scope,
  });

  // Redirect back to client with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(redirectUrl.toString(), 302);
}
