# Testing Strategy

## Overview

EduStack IS uses multiple testing strategies across its monorepo structure.

## Test Structure

### Backend (NestJS)

- **Framework**: Jest with ts-jest
- **Test Location**: `apps/backend/src/**/*.spec.ts`
- **Current Coverage**: 13 test suites (13 tests)

#### Running Tests

```bash
# All backend tests
npm run test -w backend

# With coverage
cd apps/backend && npm run test:cov
```

#### Writing Tests

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database/database.service';

describe('ServiceName', () => {
    let service: ServiceName;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ServiceName,
                {
                    provide: DatabaseService,
                    useValue: {
                        query: jest.fn().mockResolvedValue([]),
                        queryOne: jest.fn().mockResolvedValue(null),
                        execute: jest.fn().mockResolvedValue({ lastInsertRowid: 0, changes: 0 }),
                    },
                },
            ],
        }).compile();

        service = module.get<ServiceName>(ServiceName);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
```

### Frontend (React)

- **Framework**: Vitest + React Testing Library
- **Test Location**: `apps/frontend/src/**/*.{test,spec}.{ts,tsx}`
- **Current Coverage**: 8 tests (Button, Input components)

#### Running Tests

```bash
# Run tests once
npm run test:run -w frontend

# Watch mode with UI
npm run test:ui -w frontend
```

#### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
```

### MCP Server

- **Framework**: Jest
- **Test Location**: `apps/mcp-server/src/**/*.spec.ts`
- **Current Coverage**: 2 basic tests

### E2E Tests

- **Framework**: Playwright
- **Test Location**: `apps/frontend/e2e/*.spec.ts`
- **Prerequisites**: Backend running on :3000, Frontend on :5173

```bash
# Install browsers (first time)
npm run test:e2e:install -w frontend

# Run E2E tests
npm run test:e2e -w frontend
```

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

- Lint (backend + frontend)
- Typecheck (backend + frontend)
- Backend tests
- Frontend tests
- MCP server tests

## Coverage Goals

- Backend: 60% minimum (currently configured in jest config)
- Frontend: 70% minimum (recommended)
- MCP Server: 50% minimum (recommended)

## Pre-commit Hooks

Husky + lint-staged automatically:

- Run Prettier on staged files
- Run ESLint on staged .ts/.tsx files
- Run tests related to changed files

## Best Practices

1. Mock DatabaseService in backend unit tests
2. Use React Testing Library queries (getByRole, getByText)
3. Test component behavior, not implementation details
4. Keep E2E tests for critical user flows only
