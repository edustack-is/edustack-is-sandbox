import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import dotenv from "dotenv";
import { server } from "./server.js";

dotenv.config();

const app = express();
app.use(cors());

// Import tools (they register themselves on the server)
import "./tools/management.js";
import "./tools/analytics.js";
import "./tools/users.js";
import "./tools/seeding.js";

// Store transports by session ID
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
    console.log("New SSE connection");
    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    console.log(`SSE session started: ${sessionId}`);

    // Clean up on disconnect
    res.on("close", () => {
        console.log(`SSE session closed: ${sessionId}`);
        transports.delete(sessionId);
    });

    await server.connect(transport);
});

app.post("/message", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    console.log(`Received message for session: ${sessionId}`);

    const transport = transports.get(sessionId);
    if (transport) {
        try {
            await transport.handlePostMessage(req, res);
        } catch (err) {
            console.error(`Error handling message for session ${sessionId}:`, err);
            if (!res.headersSent) {
                res.status(500).json({ error: "Internal error" });
            }
        }
    } else {
        console.error(`No transport found for session: ${sessionId}, available sessions: ${Array.from(transports.keys()).join(', ')}`);
        res.status(400).json({ error: "No active SSE transport for this session" });
    }
});

const PORT = process.env.MCP_PORT || 3001;
app.listen(PORT, () => {
    console.log(`MCP Server running on http://localhost:${PORT}`);
});
