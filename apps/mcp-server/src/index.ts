import express, { Request, Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cors from 'cors';
import dotenv from 'dotenv';
import { server, listRegisteredTools } from './server.js';
import { databasePath } from './db.js';
import path from 'path';
import fs from 'fs';
import { generateText, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Find and load root .env
const envPaths = ['.env', '../../.env'];
for (const p of envPaths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
        break;
    }
}

const app = express();

// ─── CORS ──────────────────────────────────────────────────────
// MCP_CORS_ORIGIN: comma-separated allow-list. Defaults to none (CORS disabled),
// which is safe because the only legitimate caller is the backend on the same host.
const mcpCorsOrigin = (process.env.MCP_CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
if (mcpCorsOrigin.length > 0) {
    app.use(cors({ origin: mcpCorsOrigin, credentials: true }));
}

// ─── Bearer-token auth ────────────────────────────────────────
// When MCP_AUTH_TOKEN is set, /sse, /message, and /v1/chat/completions require
// Authorization: Bearer <token>. When unset, the server runs unauthenticated
// (acceptable only when bound to loopback for local dev).
const mcpAuthToken = process.env.MCP_AUTH_TOKEN;
const requireAuth = (req: Request, res: Response, next: () => void) => {
    if (!mcpAuthToken) {
        next();
        return;
    }
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || token !== mcpAuthToken) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
};

// Import tools (they register themselves on the server)
import './tools/management.js';
import './tools/analytics.js';
import './tools/users.js';
import './tools/seeding.js';
import './tools/curriculum.js';
import './tools/grading.js';

// Store transports by session ID.
// NOTE: McpServer in the current SDK is single-transport — only one connected
// client is supported at a time. The backend is currently the only legitimate
// caller, so this is acceptable. Supporting multiple concurrent clients would
// require one McpServer instance per session (or SDK-level session management).
const transports = new Map<string, SSEServerTransport>();
let currentTransport: SSEServerTransport | null = null;

app.get('/', (req, res) => {
    const toolCount = listRegisteredTools().length;

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>EduStack MCP Server</title>
            <style>
                body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #f8fafc; color: #1e293b; }
                .card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
                .status { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
                .status-ok { background: #dcfce7; color: #166534; }
                h1 { margin-top: 0; color: #0f172a; }
                code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; word-break: break-all; }
                .meta { display: grid; grid-template-columns: 140px 1fr; gap: 12px; margin-top: 24px; }
                .label { font-weight: bold; color: #64748b; }
                hr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }
                .pulse { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>EduStack MCP Server</h1>
                <div class="status status-ok"><span class="pulse"></span> Running correctly</div>
                
                <div class="meta">
                    <div class="label">Endpoint:</div>
                    <div><code>/sse</code></div>
                    
                    <div class="label">Active Sessions:</div>
                    <div>${transports.size}</div>
                    
                    <div class="label">Available Tools:</div>
                    <div>${toolCount}</div>
                    
                    <div class="label">Database:</div>
                    <div><code>${databasePath}</code></div>
                </div>

                <hr />
                <p style="font-size: 14px; color: #64748b;">
                    This is an MCP (Model Context Protocol) server providing AI capabilities for the EduStack IS. 
                    The backend application connects here via SSE to execute data management tasks using AI tools.
                </p>
            </div>
        </body>
        </html>
    `);
});

app.get('/sse', requireAuth, async (req, res) => {
    console.log('New SSE connection requested');

    // Close existing transport if any
    if (currentTransport) {
        console.log('Closing existing transport to allow new connection');
        try {
            await server.close();
        } catch (e) {
            // Ignore close errors
        }
    }

    const transport = new SSEServerTransport('/message', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    currentTransport = transport;

    console.log(`SSE session started: ${sessionId}`);

    // Clean up on disconnect
    res.on('close', () => {
        console.log(`SSE session closed: ${sessionId}`);
        transports.delete(sessionId);
        if (currentTransport === transport) {
            currentTransport = null;
        }
    });

    try {
        await server.connect(transport);
    } catch (err: any) {
        console.error('Failed to connect transport to MCP server:', err);
    }
});

app.post('/message', requireAuth, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    console.log(`Received message for session: ${sessionId}`);

    const transport = transports.get(sessionId);
    if (transport) {
        try {
            await transport.handlePostMessage(req, res);
        } catch (err) {
            console.error(`Error handling message for session ${sessionId}:`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Internal error' });
            }
        }
    } else {
        console.error(
            `No transport found for session: ${sessionId}, available sessions: ${Array.from(transports.keys()).join(', ')}`,
        );
        res.status(400).json({ error: 'No active SSE transport for this session' });
    }
});

app.post('/v1/chat/completions', requireAuth, express.json(), async (req: Request, res: Response) => {
    const { messages, model } = req.body;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
        console.error('GEMINI_API_KEY is not set.');
        return res.status(500).json({ error: 'Server is not configured with a Gemini API key.' });
    }

    const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });
    const llm = google(model || 'models/gemini-1.5-flash-latest');

    const mcpTools: any = {};
    for (const t of listRegisteredTools()) {
        mcpTools[t.name] = tool({
            description: t.description || '',
            inputSchema: t.inputSchema,
            execute: async (args: any) => {
                console.log(`Executing MCP tool from proxied endpoint: ${t.name}`);
                const result = await (server as any).callTool({
                    name: t.name,
                    arguments: args,
                });
                if ((result as any).isError) {
                    return (result as any).content.map((c: any) => c.text).join('\n');
                }
                return (result as any).content.map((c: any) => c.text).join('\n');
            },
        });
    }

    try {
        const result = await generateText({
            model: llm,
            messages,
            tools: mcpTools,
        });

        const response = {
            id: 'chatcmpl-' + Date.now(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: result.text,
                    },
                    finish_reason: 'stop',
                },
            ],
            usage: {
                prompt_tokens: result.usage.promptTokens,
                completion_tokens: result.usage.completionTokens,
                total_tokens: result.usage.totalTokens,
            },
        };

        res.json(response);
    } catch (error) {
        console.error('Error proxying to LLM:', error);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

const PORT = Number(process.env.MCP_PORT) || 3001;
// Bind to loopback by default so the MCP server is not reachable from the network.
// Override with MCP_HOST=0.0.0.0 only when fronted by a reverse proxy + auth.
const HOST = process.env.MCP_HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
    console.log(`MCP Server running on http://${HOST}:${PORT}`);
    if (!mcpAuthToken && HOST !== '127.0.0.1') {
        console.warn(
            '⚠️  MCP server is bound to a non-loopback address without MCP_AUTH_TOKEN. ' +
                'Set MCP_AUTH_TOKEN to require Bearer authentication on /sse, /message, and /v1/chat/completions.',
        );
    }
});
