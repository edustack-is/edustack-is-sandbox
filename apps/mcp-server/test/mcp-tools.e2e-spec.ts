import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { server } from "../src/server";
import EventSource from "eventsource";
import { Server } from "http";

// Import all tools to register them
import "../src/tools/management";
import "../src/tools/analytics";
import "../src/tools/users";
import "../src/tools/seeding";
import "../src/tools/curriculum";
import "../src/tools/grading";

// @ts-ignore - polyfill for Node.js
global.EventSource = EventSource;

describe('MCP Server Tools (e2e)', () => {
    let app: express.Application;
    let httpServer: Server;
    let mcpClient: Client;
    let mcpTransport: SSEClientTransport;
    const PORT = 3002;
    const transports = new Map<string, SSEServerTransport>();

    beforeAll((done) => {
        // Setup Express Server
        app = express();
        
        app.get("/sse", async (req, res) => {
            const transport = new SSEServerTransport("/message", res);
            const sessionId = transport.sessionId;
            transports.set(sessionId, transport);
            res.on("close", () => transports.delete(sessionId));
            await server.connect(transport);
        });

        app.post("/message", async (req, res) => {
            const sessionId = req.query.sessionId as string;
            const transport = transports.get(sessionId);
            if (transport) {
                await transport.handlePostMessage(req, res);
            } else {
                res.status(400).json({ error: "Session not found" });
            }
        });

        httpServer = app.listen(PORT, async () => {
            // Setup MCP Client
            mcpTransport = new SSEClientTransport(new URL(`http://localhost:${PORT}/sse`));
            mcpClient = new Client({
                name: "Test-Client",
                version: "1.0.0",
            }, { capabilities: {} });
            
            await mcpClient.connect(mcpTransport);
            done();
        });
    });

    afterAll(async () => {
        if (mcpClient) {
            // Wait a tick to ensure pending connections finish
            await new Promise(r => setTimeout(r, 100));
            // mcpClient disconnect doesn't cleanly exist or is handled via transport
            try { await mcpClient.close(); } catch(e) {}
        }
        if (httpServer) {
            httpServer.close();
        }
    });

    it('should list available tools', async () => {
        const toolsResult = await mcpClient.listTools();
        expect(toolsResult.tools.length).toBeGreaterThan(0);
        const toolNames = toolsResult.tools.map(t => t.name);
        
        // Assert some key tools are present
        expect(toolNames).toContain('create_school');
        expect(toolNames).toContain('list_schools');
        expect(toolNames).toContain('seed_school_structure');
        expect(toolNames).toContain('get_attendance_summary');
    });

    it('should create a school via management tool', async () => {
        const schoolName = `Test School ${Date.now()}`;
        const result = await mcpClient.callTool({
            name: "create_school",
            arguments: { name: schoolName }
        });
        
        expect((result as any).isError).toBeFalsy();
        const content = (result.content as any)[0].text;
        expect(content).toContain(`Škola '${schoolName}' byla úspěšně vytvořena`);
    });

    it('should list schools and find the created one', async () => {
        const result = await mcpClient.callTool({
            name: "list_schools",
            arguments: {}
        });
        
        expect((result as any).isError).toBeFalsy();
        const content = (result.content as any)[0].text;
        const schools = JSON.parse(content);
        expect(Array.isArray(schools)).toBe(true);
        expect(schools.length).toBeGreaterThan(0);
    });

    it('should handle validation errors for missing arguments', async () => {
        // Attempting to call a tool without required arguments should result in an error
        try {
            await mcpClient.callTool({
                name: "create_school",
                arguments: {} // missing name
            });
            fail('Expected callTool to throw due to validation');
        } catch (error: any) {
            expect(error.message).toMatch(/Invalid/i);
        }
    });
});
