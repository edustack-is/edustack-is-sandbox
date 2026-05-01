// Setup file for E2E tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'file::memory:?cache=shared';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'super-secret-jwt-key-for-testing-only-123456';
// Mock fetch for MCP
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  }),
) as jest.Mock;
// Mock EventSource for MCP Client
class MockEventSource {
  constructor(url: string) {}
  close() {}
  onmessage = null;
  onerror = null;
  onopen = null;
}
global.EventSource = MockEventSource as any;
