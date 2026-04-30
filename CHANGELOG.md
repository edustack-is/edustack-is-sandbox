# Changelog

All notable changes to EduStack IS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Global exception filter for standardized error responses
- Request logging middleware
- Docker setup (Dockerfile + docker-compose.yml)
- GitHub Actions CI/CD pipeline
- MCP Server tests
- Frontend tests with Vitest + React Testing Library
- Pre-commit hooks with husky + lint-staged
- Test documentation (docs/testing.md)
- Contributing guidelines (CONTRIBUTING.md)

### Changed
- Updated README to reflect actual tech stack (removed Prisma references)
- Rate limiting reduced from 3000 to 100 requests/minute
- Backend tests fixed (replaced PrismaService mocks with DatabaseService)
- DatabaseService improved with better type safety and error handling

### Fixed
- 8 failing backend test suites (PrismaService import errors)
- React version compatibility in frontend tests

## [1.0.0] - 2026-04-30

### Added
- Initial release
- NestJS backend with 15+ modules
- React frontend with shadcn/ui
- MCP Server with 36 AI tools
- Cloudflare D1 database integration
- JWT authentication with OAuth support
- Grading, attendance, scheduling modules
- AI integration (Gemini, OpenAI, Anthropic)
