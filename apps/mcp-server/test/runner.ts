import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { server } from '../src/server.js';
import EventSource from 'eventsource';
import * as assert from 'assert';

// Import all tools to register them
import '../src/tools/management.js';
import '../src/tools/analytics.js';
import '../src/tools/users.js';
import '../src/tools/seeding.js';
import '../src/tools/curriculum.js';
import '../src/tools/grading.js';

// @ts-ignore
global.EventSource = EventSource;

async function runTests() {
    const app = express();
    const transports = new Map<string, SSEServerTransport>();

    app.get('/sse', async (req, res) => {
        const transport = new SSEServerTransport('/message', res);
        const sessionId = transport.sessionId;
        transports.set(sessionId, transport);
        res.on('close', () => transports.delete(sessionId));
        await server.connect(transport);
    });

    app.post('/message', async (req, res) => {
        const sessionId = req.query.sessionId as string;
        const transport = transports.get(sessionId);
        if (transport) {
            await transport.handlePostMessage(req, res);
        } else {
            res.status(400).json({ error: 'Session not found' });
        }
    });

    const PORT = 3005;
    const httpServer = app.listen(PORT, async () => {
        try {
            console.log('Starting tests...');
            const mcpTransport = new SSEClientTransport(new URL(`http://localhost:${PORT}/sse`));
            const mcpClient = new Client(
                {
                    name: 'Test-Client',
                    version: '1.0.0',
                },
                { capabilities: {} },
            );

            await mcpClient.connect(mcpTransport);

            console.log('Testing tool list...');
            const toolsResult = await mcpClient.listTools();
            assert.ok(toolsResult.tools.length > 0, 'Should have tools');
            const toolNames = toolsResult.tools.map((t) => t.name);
            assert.ok(toolNames.includes('create_school'), 'Should have create_school');
            assert.ok(toolNames.includes('list_schools'), 'Should have list_schools');

            console.log('Testing create_school...');
            const schoolName = `Test School ${Date.now()}`;
            const createResult = await mcpClient.callTool({
                name: 'create_school',
                arguments: { name: schoolName },
            });
            assert.ok(!(createResult as any).isError, 'Create school should not error');
            assert.ok(
                (createResult as any).content[0].text.includes('byla úspěšně vytvořena'),
                'Should contain success message',
            );

            console.log('Testing list_schools...');
            const listResult = await mcpClient.callTool({
                name: 'list_schools',
                arguments: {},
            });
            assert.ok(!(listResult as any).isError, 'List schools should not error');
            const schools = JSON.parse((listResult as any).content[0].text);
            assert.ok(Array.isArray(schools), 'Should return array of schools');
            assert.ok(schools.length > 0, 'Should have at least one school');

            console.log('Testing validation error...');
            const valResult = await mcpClient
                .callTool({
                    name: 'create_school',
                    arguments: {},
                })
                .catch((e) => e);
            assert.ok((valResult as any).isError === true, 'Should return isError for invalid arguments');

            console.log('Testing seed_school_structure...');
            const seedResult = await mcpClient.callTool({
                name: 'seed_school_structure',
                arguments: {
                    schoolId: schools[0].id,
                    schoolType: 'elementary_1',
                    academicYearName: '2024/2025',
                },
            });
            assert.ok(!(seedResult as any).isError, 'Seed school structure should not error');
            assert.ok(
                (seedResult as any).content[0].text.includes('byla úspěšně naplněna strukturou'),
                'Should contain success message',
            );

            console.log('All tests passed!');
            process.exit(0);
        } catch (e) {
            console.error('Test failed:', e);
            process.exit(1);
        }
    });
}

runTests();
