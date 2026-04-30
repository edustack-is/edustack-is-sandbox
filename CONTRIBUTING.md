# Contributing to EduStack IS

Thank you for your interest in contributing!

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/edu-stack-is-sandbox.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user profile page
fix: correct login redirect issue
docs: update API documentation
refactor: simplify database service logic
```

## Pull Request Process

1. Ensure all tests pass: `npm run test`
2. Run linter: `npm run lint`
3. Update documentation if needed
4. Fill out the PR template completely
5. Request review from maintainers

## Code Style

- We use Prettier and ESLint (auto-formatted on commit via husky)
- Write tests for new features
- Follow existing code patterns

## Testing

```bash
# Run all tests
npm run test

# Backend only
npm run test -w backend

# Frontend only
npm run test:run -w frontend
```

## Questions?

Open an issue or contact the maintainers.
