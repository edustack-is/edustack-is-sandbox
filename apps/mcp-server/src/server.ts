import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface RegisteredTool {
    name: string;
    description: string;
    inputSchema: unknown;
    // Capture the handler so callers (e.g. /v1/chat/completions) can invoke
    // a tool directly without going through private SDK internals.
    handler: (args: unknown) => Promise<unknown>;
}

const _server = new McpServer({
    name: 'EduStack Management Server',
    version: '1.0.0',
});

const _tools: RegisteredTool[] = [];

// Intercept tool registrations so we have a stable, public list of tools to
// enumerate (used by /v1/chat/completions and the status page). This avoids
// reaching into `(server as any)._tools`, which is a private SDK field and
// shifts across versions.
const _originalTool = _server.tool.bind(_server);
(_server as any).tool = function (
    name: string,
    description: string,
    inputSchema: unknown,
    handler: (args: unknown) => Promise<unknown>,
) {
    _tools.push({ name, description, inputSchema, handler });
    return _originalTool(name as any, description as any, inputSchema as any, handler as any);
};

export const server = _server;

export function listRegisteredTools(): readonly RegisteredTool[] {
    return _tools;
}
