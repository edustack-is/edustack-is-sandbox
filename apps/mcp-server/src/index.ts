import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // Required for POST /message

const server = new McpServer({
    name: "EduStack Management Server",
    version: "1.0.0",
});

// Import tools
import "./tools/management.js";
import "./tools/analytics.js";

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
    console.log("New SSE connection");
    transport = new SSEServerTransport("/message", res);
    await server.connect(transport);
});

app.post("/message", async (req, res) => {
    console.log("Received message");
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send("No active SSE transport");
    }
});

const PORT = process.env.MCP_PORT || 3001;
app.listen(PORT, () => {
    console.log(`MCP Server running on http://localhost:${PORT}`);
});

export { server };
