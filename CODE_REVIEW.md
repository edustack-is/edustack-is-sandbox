# Code Review — EduStack IS Sandbox

**Date:** 2026-05-14
**Reviewer:** Claude (Opus 4.7, 1M)
**Scope:** Full repository — high-level review. Backend (NestJS), Frontend (React/Vite), MCP Server (Node).
**Branch reviewed:** `feat/data-generator-completion` (51 changed files vs. `main`, plus 9 uncommitted)
**Focus areas:** Security & auth, code quality & maintainability, correctness & bugs, performance & DB.

> This review complements `SECURITY-AUDIT.md` (dated 2026-02-16). Several findings here are **regressions** — items the earlier audit marked as fixed that no longer hold in the current code.

---

## Executive summary

The codebase is reasonably well-organized for a 53k-LoC NestJS/React monorepo, and many security primitives are good (AES-256-GCM, bcrypt, helmet, allow-listed CORS, validation pipe, throttling module, audit logging). However, the security posture has **regressed since the previous audit** and several correctness bugs are present:

| Severity      | Count |
| ------------- | :---: |
| 🔴 Critical   |   3   |
| 🟠 High       |   8   |
| 🟡 Medium     |   7   |
| 🔵 Low / Info |   8   |

The two most urgent issues are:

1. **The MCP server has zero authentication and binds to `0.0.0.0`** — anyone on the network can read/write the production SQLite/D1 file directly.
2. **`JwtAuthGuard` is no longer a global `APP_GUARD`** (only `ThrottlerGuard` is), and at least one controller (`RegistryController`) is consequently fully unauthenticated. The earlier audit's "Global guard via APP_GUARD" claim no longer holds.

These should both be addressed before any further feature work.

---

## 🔴 Critical findings

### C1 — `RegistryController` is fully unauthenticated

**File:** `apps/backend/src/registry/registry.controller.ts:1-37`

- Class has neither `@UseGuards(JwtAuthGuard)` nor `@Public()`.
- `apps/backend/src/app.module.ts:80-83` only registers `ThrottlerGuard` as `APP_GUARD`. **`JwtAuthGuard` is not global.**
- Therefore `POST /api/registry/classrooms`, `/students`, `/teachers` and `GET /api/registry/classrooms` accept anonymous requests.
- Bodies are typed `@Body() data: any` so `ValidationPipe` cannot strip them.
- `findAllClassrooms()` (`registry.service.ts:22-39`) returns **every classroom in every tenant** — no `schoolId` filter — so any unauthenticated caller can enumerate all schools' students and homeroom teachers in one request.

**Fix:** Either register `JwtAuthGuard` (and `RolesGuard`) as `APP_GUARD` providers in `app.module.ts` (so the rest of the controllers don't depend on remembering `@UseGuards`), or add `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` and scope queries by `req.user.schoolId` here. Strongly prefer the global-guard route — see C2/H1/H2 below, which are all symptoms of the same root cause.

### C2 — MCP server has no authentication and binds to `0.0.0.0`

**File:** `apps/mcp-server/src/index.ts:22-23, 90-146, 216-219`

- `app.use(cors())` — CORS open to any origin.
- `app.listen(PORT, '0.0.0.0', …)` — reachable from any host on the LAN/VPN/cloud network.
- `/sse`, `/message`, and the newly added `/v1/chat/completions` accept any payload from anyone.
- `apps/mcp-server/src/db.ts:49` opens the live wrangler/D1 SQLite file with `new Database(databasePath)` and exposes tool functions (`tools/management.ts`, `tools/users.ts`, `tools/grading.ts`, `tools/seeding.ts`) that read and **mutate** records.
- The `/v1/chat/completions` endpoint accepts arbitrary `messages` and forwards them through Gemini with full tool calling — i.e. an unauthenticated attacker can use the LLM to drive privileged tools against the DB.

**Fix:**

1. Bind to `127.0.0.1` by default (`app.listen(PORT, '127.0.0.1', …)`); expose externally only with an explicit env flag.
2. Require a shared secret / bearer token on `/sse`, `/message`, and `/v1/chat/completions`.
3. Restrict `cors()` to known origins (the backend host).
4. Validate `req.body` size/shape on `/v1/chat/completions`.

### C3 — Dependency vulnerabilities have ballooned since the last audit

`npm audit` reports **30 vulnerabilities (2 critical, 7 high, 21 moderate)**. The previous audit (2026-02-16) noted 17 (2 critical, 2 high, 13 moderate). Many are auto-fixable (`npm audit fix`); the rest need a deliberate dependency bump. Block the next deploy on a clean (or at least zero-critical) audit.

---

## 🟠 High findings

### H1 — `accept-invite` requires JWT, so new users can't accept invitations

**File:** `apps/backend/src/auth/auth.controller.ts:47-49, 300-317`

- `@Controller('api/auth')` has class-level `@UseGuards(JwtAuthGuard)` (line 49).
- The handler at line 300 has **no `@Public()` decorator**.
- Newly invited users do not yet hold a JWT — they will get 401 before the service even runs.

Other endpoints in the same controller correctly carry `@Public()` (sso-options, forgot-password, reset-password, login, exchange-token). `accept-invite` is the conspicuous outlier. The previous audit (F5) hand-waved this away with "relies on the global auth guard" — but the global guard isn't actually `JwtAuthGuard`, so the assertion was wrong both ways.

**Fix:** Add `@Public()` above `@Post('accept-invite')` and add an aggressive `@Throttle({ default: { limit: 5, ttl: 60_000 } })` since this is unauthenticated and consumes an invitation token.

### H2 — `POST /api/auth/invite/:userId` has no role check

**File:** `apps/backend/src/auth/auth.controller.ts:270-298`

The endpoint is JWT-guarded (class-level) but has no `@Roles()` annotation and no manual role check in the handler. Any authenticated user — including a `STUDENT` or `PARENT` — can call `POST /api/auth/invite/<some user id>` and trigger an invitation email. The previous audit credited this controller with strong RBAC, but the invite endpoint is the gap.

**Fix:** Add `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)` (plus system-admin bypass that `RolesGuard` already provides).

### H3 — `DatabaseService.transaction()` is a no-op

**File:** `apps/backend/src/database/database.service.ts:209-217`

```ts
async transaction<T>(fn: (db: DatabaseService) => Promise<T>): Promise<T> {
  // For simplicity in this SQL POC, we execute as-is.
  return await fn(this);
}
```

Every caller that wraps multi-step writes in `db.transaction(…)` (init/setup, seed, grade upserts, etc.) silently runs **without atomicity**. A partial failure leaves the DB in a half-applied state. The init flow (which creates a school + admin user + school membership in one transaction) is particularly exposed.

**Fix:** Implement the local path with `better-sqlite3`'s `db.transaction()` API (note: it is sync — wrap async callbacks carefully) and the D1 path with `d1.batch(...)`. If proper transactions are impractical in D1, at least document this and add manual cleanup on failure.

### H4 — Login endpoint inherits global 100 req/60s throttle; no per-endpoint clamp

**Files:** `apps/backend/src/app.module.ts:47-52`, `apps/backend/src/auth/auth.controller.ts:417-444`

`ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` is generous for password brute-force. The previous audit claimed "Auth login endpoint gets stricter limits" — no such `@Throttle` exists on `login()`. Add e.g. `@Throttle({ default: { limit: 5, ttl: 60_000 } })` and consider per-email lockout (already listed as F3 in the prior audit).

### H5 — `init/status` throttle says 10/min but is set to 1000/min

**File:** `apps/backend/src/init/init.controller.ts:34-38`

```ts
/**
 * GET /api/init/status
 * Rate-limited to 10 requests per 60 seconds.
 */
@Public()
@Throttle({ default: { limit: 1000, ttl: 60000 } })
```

The comment and the code disagree by 100×. Either tighten the limit to 10/60s as the comment promises, or update the comment. Since this endpoint is public and queried on every boot of the frontend, 30–60/60s per IP is probably the right pragmatic value.

### H6 — `@Body() body: any` defeats validation across many controllers

**Scope:** 15 occurrences across `attendance`, `grading`, `registry`, `classbook`, etc.

`@ApiBody({ type: CreateGradeDto })` documents a DTO, but the handler uses `@Body() body: any`, so the global `ValidationPipe` doesn't strip or validate. Swagger and reality diverge.

Example — `grading.controller.ts:81`:

```ts
@ApiBody({ type: CreateGradeDto })
async createGrade(@Req() req: any, @Body() body: any) { … }
```

**Fix:** Replace `any` with the DTO class. With `whitelist: true` + `forbidNonWhitelisted: true` already set globally (`main.ts:230-236`), this immediately enforces shape, types, and unknown-property rejection.

### H7 — `MinLength(10)` was just removed from AI API-key DTO

**File:** `apps/backend/src/system-admin/dto/upsert-ai-settings.dto.ts` (uncommitted diff)

The minimum-length guard on `geminiApiKey`, `openAiApiKey`, `anthropicApiKey`, `opencodeApiKey` was deleted. Empty/whitespace keys can now be saved and encrypted. The application will then attempt to call providers with junk keys and fail at runtime; worse, an attacker who can reach `PUT /api/system/settings/ai` could clobber valid keys with an empty string and silently break AI features.

**Fix:** Restore `@MinLength(10)` (or `@Matches(/^[A-Za-z0-9_\-]{10,}$/)` for a stricter shape). If the goal was to allow "clear the key", accept an explicit `null` rather than relaxing length.

### H8 — New OpenCode provider hardcoded to `http://127.0.0.1:3001/v1`

**File:** `apps/backend/src/ai/ai-chat.service.ts:667-675` (uncommitted)

```ts
const opencode = createOpenAI({
    apiKey: keys.opencodeApiKey,
    baseURL: 'http://127.0.0.1:3001/v1',
});
```

- Port 3001 is the MCP server. The backend now ships chat traffic _to its own MCP server's OpenAI-compatible endpoint_ (added in the same diff). Combined with C2, this means user-facing AI chat is being routed through an unauthenticated proxy that has full DB access. If C2 is mitigated by binding to `127.0.0.1`, this loop still works locally, but the security boundary becomes "anything on this host" — which is brittle.
- The URL is non-configurable. Use an env var (`OPENCODE_BASE_URL`), default to a sane value, and **require it to be HTTPS in production**.

---

## 🟡 Medium findings

### M1 — N+1 queries in registry and elsewhere

**Files:** `apps/backend/src/registry/registry.service.ts:22-39`, multiple other services.

`RegistryService.findAllClassrooms()` runs `N×2` extra queries per classroom (students + teacher). The same pattern was being fixed for `DeputyService.getSchoolUsers()` in the current uncommitted diff (good — bulk `IN (?,?,?)` query) — apply the same refactor to registry and audit other services in the same file (`attendance`, `messaging`, `community`, `reports` are the next likely offenders given their `for (const x of list)` shapes).

### M2 — MCP server abuses private internals and singleton transport

**File:** `apps/mcp-server/src/index.ts:39, 161, 95-101`

- `(server as any)._tools` reaches into a private field of `McpServer`; will break on any SDK upgrade.
- `currentTransport` is a module-level singleton — on a second `/sse` connection, the code calls `server.close()` and resets the singleton, which silently disconnects the prior client. The `transports` Map suggests multi-client support that the rest of the code contradicts.

**Fix:** Use the SDK's public API to enumerate tools (or maintain your own registry as `tools/*.ts` register them). Don't tear down `server` on connect — let `SSEServerTransport` manage its own lifecycle per session.

### M3 — JWT stored in `localStorage` (pre-existing)

**File:** `apps/frontend/src/api/index.ts:22-32`, `App.tsx`, `context/SchoolContext.tsx` (multiple)

Already documented as F1/M5 in `SECURITY-AUDIT.md`. CSP mitigates the worst case in production. The fact that `accept-invite`, `forgot-password`, `reset-password` and `sso/exchange-token` already use httpOnly cookies makes the rest of the JWT-storage migration shorter than F1 estimates.

### M4 — `AUTO_SEED` race condition on multi-instance boot

**File:** `apps/backend/src/main.ts:398-434`

`main.ts` reads `initService.getStatus()` and then conditionally runs `initService.setup()` + `seedService.executeSeed()`. With two processes booting in parallel (containers, restarts), both can pass the check before either calls `setup`, producing partial / duplicate seed data. Fix with an advisory lock (SQLite `BEGIN EXCLUSIVE`) or, given this is a dev convenience, only allow `AUTO_SEED` when `NODE_ENV !== 'production'`.

### M5 — `main.ts` mixes bootstrap, validation, security headers, Swagger boilerplate, and seed orchestration in 437 lines

**File:** `apps/backend/src/main.ts`

Lines 4-112 are a single Swagger DTO import dump; lines 277-387 list the same DTOs again as `extraModels`. Extract the entire Swagger setup to `swagger.setup.ts` and the auto-seed flow to a small module hook. The current shape hides real logic behind boilerplate and discourages reviewers from reading the file at all.

### M6 — Hand-rolled cookie parser

**File:** `apps/backend/src/auth/auth.controller.ts:53-64`

`decodeURIComponent(val.join('='))` will throw on malformed cookie values (e.g. an injected `%E0`). It's also subtly wrong for cookies that contain `=` in their value when not properly URI-encoded. Use `cookie-parser` middleware (or `cookie` package) — both are tiny.

### M7 — Stub endpoint shipped as production code

**File:** `apps/backend/src/grading/grading.controller.ts:175-182`

```ts
@Get('average/:studentId/:subjectInstanceId')
…
async getAverage(…) {
  this.ensureTenant(req);
  return { average: 0 };           // always zero
}
```

This is wired up in Swagger and called from the frontend (`api/index.ts:78`). Either implement it or remove it; right now it's a silent correctness bug.

---

## 🔵 Low / informational

- **L1** — `SECURITY-AUDIT.md` claims "Global guard via APP_GUARD" — outdated and misleading given C1/H1/H2. Update or delete after C1 is fixed.
- **L2** — `crypto.service.ts` uses a deterministic salt for `scryptSync`. This is acceptable for a fixed-key KDF, but if the salt ever needs rotation it has to be migrated for all encrypted secrets. Document the choice in a one-line comment.
- **L3** — `bcrypt` rounds are 10 (`auth.service.ts` — confirm). In 2026 the consensus is 12. Bumping is a one-line change but invalidates no hashes; new hashes will just be slower.
- **L4** — Mixed env naming for the same key: backend uses `GOOGLE_AI_API_KEY`, the MCP server reads `GEMINI_API_KEY` (`mcp-server/src/index.ts:151`). Pick one and alias.
- **L5** — `AUDIT.md` references "Prisma" extensively, but Prisma was replaced by `DatabaseService`/`better-sqlite3`. The doc is misleading for new contributors. Either prune or annotate as historical.
- **L6** — `apps/frontend/src/api/index.ts:22-32` reads `localStorage` on every request inside the request interceptor — fine, but consider caching during the React app's lifetime to avoid `localStorage.getItem` overhead in hot paths.
- **L7** — `console.log` and `console.error` (11 occurrences in backend, more in MCP server) should route through `Logger` so logs respect the configured level and stay structured.
- **L8** — `AppModule` imports `JwtAuthGuard` and `RolesGuard` at the top but never references them (they're only used per-controller). The unused imports are a red herring suggesting global registration that doesn't exist.

---

## What's good — keep doing this

- AES-256-GCM with random IV and `scryptSync` KDF (`utils/crypto.service.ts`) — correct.
- Bcrypt password hashing + a centralized password policy (`utils/password-policy.ts`).
- Helmet with production CSP, allow-listed CORS origins, fail-fast env validation in `main.ts`.
- Audit logging on auth, login failures, sensitive reads (`@LogSensitiveRead`).
- SSO callback uses short-lived httpOnly cookies for the JWT instead of putting it in the URL — well-designed.
- `class-validator` DTOs exist for the important shapes (auth, init/setup).
- The uncommitted `getSchoolUsers` refactor (N→bulk `IN`) is exactly the right direction; clone it elsewhere.
- The recent commits (`fix(system): resolve dashboard errors, planner 404, and grid crash`, `fix(grading)…`) suggest the team is correctly fixing real bugs in small, focused commits.

---

## Recommended sequencing for fixes

1. **Today (block deploy)** — C1, C2, C3.
2. **This week** — H1, H2, H3, H4, H5, H7, H8 (all bug-class with small diffs).
3. **Next sprint** — H6 (DTO sweep; mechanical but touches ~15 controllers), M1, M2, M5.
4. **Cleanup / backlog** — everything in M3–M7 and the L items.

---

## Files inspected (representative)

```
apps/backend/src/main.ts
apps/backend/src/app.module.ts
apps/backend/src/auth/{auth.controller.ts, auth.module.ts, jwt.strategy.ts, jwt-auth.guard.ts, roles.guard.ts}
apps/backend/src/init/init.controller.ts
apps/backend/src/database/database.service.ts
apps/backend/src/registry/{registry.controller.ts, registry.service.ts}
apps/backend/src/grading/grading.controller.ts
apps/backend/src/utils/crypto.service.ts
apps/backend/src/system-admin/dto/upsert-ai-settings.dto.ts (uncommitted)
apps/backend/src/ai/ai-chat.service.ts (uncommitted)
apps/backend/src/deputy/deputy.service.ts (uncommitted)
apps/mcp-server/src/{index.ts, server.ts, db.ts}
apps/frontend/src/api/index.ts
```

Plus full diff of `feat/data-generator-completion` vs `main` (51 files) and the working-tree diff (9 files).
