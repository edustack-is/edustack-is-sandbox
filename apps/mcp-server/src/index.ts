import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import cors from 'cors';
import dotenv from 'dotenv';
import { server } from './server.js';
import { databasePath } from './db.js';
import path from 'path';
import fs from 'fs';

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
app.use(cors());

// Import tools (they register themselves on the server)
import './tools/management.js';
import './tools/analytics.js';
import './tools/users.js';
import './tools/seeding.js';
import './tools/curriculum.js';
import './tools/grading.js';

// Store transports by session ID
const transports = new Map<string, SSEServerTransport>();
let currentTransport: SSEServerTransport | null = null;

app.get('/', (req, res) => {
    // Access private tools list for diagnostic info
    const toolCount = (server as any)._tools?.size || 0;

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

app.get('/sse', async (req, res) => {
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

app.post('/message', async (req, res) => {
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

const PORT = Number(process.env.MCP_PORT) || 3001;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MCP Server running on http://0.0.0.0:${PORT}`);
});
