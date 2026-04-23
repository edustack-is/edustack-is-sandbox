# Project Guidelines

## Code Style & Formatting

- **Prettier:** Use the project-root `.prettierrc` for all code formatting.
- **Indentation:** Use 4 spaces for code, 2 spaces for JSON.
- **Quotes:** Use single quotes for strings in TypeScript/JavaScript.
- **Semicolons:** Always include semicolons.
- **Print Width:** Preferred maximum line length is 120 characters.

## AI Instructions

- **Strict Typing (No `any`):** Always use precise TypeScript types/interfaces. The `any` type is strictly forbidden. If a library returns `any`, you must define a proper interface or use the specific type provided by the library (e.g., from `@prisma/client`).
- **Missing Library Types:** If official types are missing (e.g., Cloudflare D1 types in Node.js context), always define a complete local interface that satisfies the consumer's requirements (e.g., define `D1Database` with all required methods like `prepare`, `batch`, `withSession`, etc.) instead of falling back to `any`.
- **No `@ts-ignore`:** Never use `@ts-ignore` or `@ts-nocheck` to hide errors. Fix the underlying type issue or use a proper type assertion (`as unknown as ...`) if absolutely necessary and add a comment explaining why.
- **No `require()`:** Use standard ES `import` statements at the top of the file. CommonJS `require()` is forbidden unless it's the only possible way for a specific platform constraint (in which case, add a comment explaining why).
- **No Silent Failures:** Never use empty `catch` blocks or "silent fail" patterns. All caught errors must be either logged (e.g., `this.logger.warn`), re-thrown, or handled in a way that provides feedback to the system or user.
- **No `this` aliases:** Avoid patterns like `const self = this` or `const _this = this`. Use arrow functions to correctly capture the lexical `this` context from the surrounding scope.
- **No `dev.db`:** Do not use or create `dev.db` or other temporary/fake database files in development. Strictly follow the established storage patterns (e.g., `.wrangler` for local D1 simulation).
- Before submitting any code changes, always run `npm run format` from the project root to ensure consistent styling.

- Adhere to the established patterns in the monorepo (Apps in `apps/`, shared logic in `packages/`).
- Protect system integrity: never modify `.wrangler` or `.sqlite` files directly.
- Use the established `PrismaService` for database operations.
