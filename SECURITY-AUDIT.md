# 🔒 Security Audit Report — EduStack IS Sandbox

**Date:** 2026-02-16  
**Auditor:** Antigravity Security Auditor Skill  
**Scope:** Full application (backend NestJS, frontend React/Vite, Docker Compose infrastructure)

---

## Executive Summary

The application is a **school information system** (NestJS + React) with JWT authentication, RBAC, SSO integration, and AI features. While it has a solid security foundation (JWT guards, role guards, audit logging, encrypted secrets), the audit identified **16 findings** across critical, high, medium, and low severity levels.

| Severity | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟠 High | 4 |
| 🟡 Medium | 5 |
| 🔵 Low / Info | 4 |

---

## 🔴 CRITICAL Findings

### C1. Hardcoded JWT Secret — Default `'secretKey'`

**Files:** `auth.module.ts:15`, `jwt.strategy.ts:11`

```typescript
// auth.module.ts
JwtModule.register({
  secret: process.env.JWT_SECRET || 'secretKey', // ⚠️ CRITICAL
  signOptions: { expiresIn: '60m' },
}),

// jwt.strategy.ts
secretOrKey: process.env.JWT_SECRET || 'secretKey', // ⚠️ CRITICAL
```

**Risk:** If `JWT_SECRET` is not set (and it isn't in `.env` or `docker-compose.yml`), **all JWTs are signed with `'secretKey'`**. Any attacker can forge valid tokens for any user, including system admins.

**Impact:** Complete authentication bypass. Full system compromise.

**Remediation:**
1. Generate a strong random secret: `openssl rand -base64 64`
2. Add `JWT_SECRET` to `.env` and `docker-compose.yml` environment
3. **Remove the fallback** — the app should **refuse to start** without a proper JWT_SECRET
4. Consider using asymmetric keys (RS256) for production

---

### C2. Hardcoded Encryption Key for Secrets

**File:** `utils/crypto.service.ts:11-13`

```typescript
const encryptionKey = this.configService.get<string>('ENCRYPTION_KEY') ||
    this.configService.get<string>('SETTINGS_ENCRYPTION_KEY') ||
    'edu-stack-default-key-change-me!!'; // ⚠️ CRITICAL
```

**Risk:** All `SystemSecret` records (SSO client secrets, API keys) are encrypted with AES-256-GCM using this key. The default key is publicly known from the source code.

**Impact:** If `ENCRYPTION_KEY` isn't set, all stored secrets (Google/GitHub/Microsoft OAuth secrets, AI API keys) can be decrypted by anyone with database access.

**Remediation:**
1. Add `ENCRYPTION_KEY` to `.env` with a strong random value
2. Remove the default fallback — throw an error if not configured
3. Document the key generation process

---

### C3. Impersonation Endpoint — No Authorization Guard

**File:** `auth.controller.ts:141-151`

```typescript
@Post('impersonate/:id')
async impersonate(@Param('id') targetUserId: string, @Body('adminId') adminId: string) {
    // In real app: Use @UseGuards(RolesGuard), @Roles('ADMIN', 'DIRECTOR')
    // and get adminId from req.user.id    ← THE COMMENT SAYS IT ALL
    if (!adminId) throw new BadRequestException('Admin ID required (simulated)');
    return this.authService.impersonate(adminId, targetUserId);
}
```

**Risk:** The `adminId` comes from the **request body**, not from the authenticated user's JWT. Any authenticated user can impersonate any other user by providing an arbitrary `adminId`. The comment explicitly acknowledges this is a placeholder.

**Impact:** Complete privilege escalation. Any user can become any other user (except system admins, which are checked in the service).

**Remediation:**
1. Get `adminId` from `req.user.userId` (the JWT)
2. Add `@UseGuards(RolesGuard)` and `@Roles(UserRole.ADMIN, UserRole.DIRECTOR)`
3. Verify the caller has the appropriate role in the target school context

---

## 🟠 HIGH Findings

### H1. All Init Endpoints Are Publicly Accessible

**File:** `init.controller.ts`

```typescript
@Public() @Get('status')      // OK — needed for setup flow
@Public() @Post('setup')       // Protected by "already initialized" check ✓
@Public() @Post('setup-with-seed') // ⚠️ Accepts AI keys and SSO config!
@Public() @Get('seed-files')   // ⚠️ Leaks available seed file names
```

**Risk:** While `setup()` has a guard (`status.initialized`), `setup-with-seed` accepts **AI API keys and SSO configuration** in the request body. An attacker with network access to the backend could:
- Race condition: Call `setup-with-seed` before the legitimate admin if the app is being deployed
- `seed-files` reveals internal file structure

**Impact:** Attacker could become the system admin during initial deployment. Seed files list reveals system structure.

**Remediation:**
1. Add a time-limited setup token or use an environment variable `SETUP_TOKEN`
2. Add rate limiting to setup endpoints
3. Consider making `seed-files` require authentication

---

### H2. No CORS Configuration

**Files:** `main.ts` — No `enableCors()` or CORS middleware found.

**Risk:** Without explicit CORS configuration in NestJS, the default depends on the framework version. In NestJS 11, CORS is **disabled by default** (no `Access-Control-Allow-Origin` header), which means:
- In development with Vite proxy: Works fine (same-origin)
- In production without proxy: Cross-origin requests will fail
- If someone adds `app.enableCors()` without options: **All origins are allowed**

**Impact:** Potential for CSRF-style attacks if CORS is misconfigured later. Currently, the lack of configuration may cause legitimate deployment issues.

**Remediation:**
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
```

---

### H3. No Input Validation Pipeline (ValidationPipe)

**Files:** `main.ts` — No `app.useGlobalPipes(new ValidationPipe())` found.

**Risk:** The application does not use NestJS's `ValidationPipe` with `class-validator` decorators. DTOs like `SetupDto` have no validation decorators (`@IsEmail`, `@MinLength`, etc.). Request bodies are used directly without sanitization.

**Impact:** 
- SQL injection is mitigated by Prisma's parameterized queries ✓
- But missing validation allows malformed data, potential NoSQL-like injection in JSON fields, and unexpected behavior
- No whitelist filtering — extra properties in request bodies pass through

**Remediation:**
1. Add `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))`
2. Add `class-validator` decorators to all DTOs
3. Use `@Transform()` for sanitization where needed

---

### H4. JWT Token Exposed in URL (SSO Redirect)

**File:** `auth.controller.ts:90, 115`

```typescript
return res.redirect(`${FRONTEND_URL}/login?token=${result.access_token}`);
```

**Risk:** The JWT access token is passed via URL query parameter during SSO redirect. This means:
- Token appears in browser history
- Token appears in server access logs
- Token could be leaked via Referer header
- Token could be cached by proxies

**Impact:** Token leakage leading to session hijacking.

**Remediation:**
1. Use a short-lived, single-use authorization code instead
2. Or set the token as an httpOnly cookie during redirect, then read it on the frontend
3. Or use a server-side session store with a session ID in the URL

---

## 🟡 MEDIUM Findings

### M1. No Rate Limiting on Authentication Endpoints

**Files:** `auth.controller.ts` — `/api/auth/login` has no rate limiting.

**Risk:** Brute-force attacks against the login endpoint. While failed attempts are logged to the audit log, there is no mechanism to **block** repeated attempts.

**Impact:** Password guessing attacks, credential stuffing.

**Remediation:**
1. Install `@nestjs/throttler`
2. Apply rate limiting to login, setup, and invitation endpoints
3. Consider account lockout after N failed attempts

---

### M2. No Helmet Security Headers

**Files:** No `helmet` dependency found in `package.json`.

**Risk:** Missing HTTP security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (clickjacking protection)
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `X-XSS-Protection`

**Impact:** Increased vulnerability to clickjacking, MIME sniffing, and XSS attacks.

**Remediation:**
```bash
npm install helmet
```
```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

### M3. Database Credentials Are Weak Defaults

**Files:** `.env`, `docker-compose.yml`

```
POSTGRES_USER=student
POSTGRES_PASSWORD=student
```

**Risk:** Default credentials are trivially guessable. While this is expected for local development, these values are committed to version control and could be used in production deployments.

**Impact:** Database compromise if deployed with default credentials.

**Remediation:**
1. Use `.env.example` with placeholder values (✓ already exists)
2. Document that `.env` must be configured before deployment
3. Consider generating random passwords during Docker setup

---

### M4. Adminer Database Admin Exposed on Port 8080

**File:** `docker-compose.yml:22-29`

```yaml
adminer:
  image: adminer
  ports:
    - "8080:8080"  # ⚠️ Publicly accessible
```

**Risk:** Adminer provides a web-based database administration interface. Combined with weak PostgreSQL credentials (M3), this gives full database access.

**Impact:** Full database read/write access including user records, secrets, and grades.

**Remediation:**
1. Remove Adminer from production Docker Compose
2. Or bind only to localhost: `"127.0.0.1:8080:8080"`
3. Create separate `docker-compose.dev.yml` for development tools

---

### M5. JWT Tokens Stored in localStorage

**File:** `frontend/src/api/index.ts:12`, plus ~50 other references.

**Risk:** JWT tokens stored in `localStorage` are vulnerable to XSS attacks. If an attacker can inject JavaScript (via XSS, compromised dependency, etc.), they can steal all tokens:
- `access_token` (current session)
- `global_token` (global JWT)
- `original_admin_token` (impersonation return token)

**Impact:** Session hijacking via XSS.

**Remediation:**
1. Move to `httpOnly` cookies for token storage (requires backend changes)
2. Or use `sessionStorage` (less persistent, still XSS-vulnerable)
3. Implement Content Security Policy (CSP) to mitigate XSS

---

## 🔵 LOW / INFORMATIONAL Findings

### L1. Password Policy Not Enforced

**File:** `auth.service.ts:104`, `init.service.ts:35`

Passwords are hashed with bcrypt (salt rounds = 10) ✓, but no minimum length/complexity requirements are enforced server-side. The default seed admin password is `Heslo123!` (hardcoded in `main.ts:47`).

**Remediation:** Add password validation (min 8 chars, at least 1 uppercase, 1 number, 1 special character).

---

### L2. Swagger/OpenAPI Exposed at Root `/`

**File:** `main.ts:30`

```typescript
SwaggerModule.setup('/', app, document);
```

**Risk:** API documentation is available at the root URL without authentication. This reveals all endpoints, their parameters, and data models.

**Remediation:** Move Swagger to a non-obvious path and/or protect with authentication in production:
```typescript
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('/api/docs', app, document);
}
```

---

### L3. RolesGuard Doesn't Validate School Context

**File:** `auth/roles.guard.ts`

The `RolesGuard` only checks `user.role` from the JWT. It doesn't verify that the role applies to the **current school context**. This means if a user has `ADMIN` role in School A, the JWT token for School A could potentially be used to access School B's data if the service doesn't separately validate `schoolId`.

**Remediation:** Ensure all service methods validate `schoolId` from the JWT matches the requested resource's school.

---

### L4. `scryptSync` Uses Static Salt

**File:** `utils/crypto.service.ts:16`

```typescript
this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
```

The `scrypt` key derivation uses a static salt `'salt'`. While the resulting key is still AES-256, a static salt slightly weakens the key derivation.

**Remediation:** Use a unique, random salt (can be stored alongside the configuration).

---

## ✅ Positive Security Observations

| Feature | Assessment |
|---------|-----------|
| Password hashing | ✅ bcrypt with 10 rounds |
| Parameterized queries | ✅ Prisma ORM prevents SQL injection |
| Audit logging | ✅ Login attempts, impersonation, sensitive reads logged |
| JWT-based auth | ✅ Global guard applied via `APP_GUARD` import (though not fully wired) |
| Role-based access | ✅ RolesGuard + Roles decorator on controllers |
| SystemAdmin guard | ✅ Dedicated `IsSystemAdminGuard` on system endpoints |
| Secrets encryption | ✅ AES-256-GCM for SystemSecret values |
| Invitation tokens | ✅ Cryptographically random, bcrypt-hashed, time-limited |
| File upload validation | ✅ MIME type + size limits on avatar upload |
| `.env` in `.gitignore` | ✅ Environment files excluded from version control |
| SSO cookie security | ✅ httpOnly, short-lived cookies for OAuth state |

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 🔴 | C1 — Set JWT_SECRET | 🟢 5 min |
| 2 🔴 | C3 — Fix impersonation auth | 🟢 15 min |
| 3 🔴 | C2 — Set ENCRYPTION_KEY | 🟢 5 min |
| 4 🟠 | H1 — Protect init endpoints | 🟡 30 min |
| 5 🟠 | H3 — Add ValidationPipe | 🟡 1-2 hrs |
| 6 🟠 | H4 — Fix token in URL | 🟡 1-2 hrs |
| 7 🟠 | H2 — Configure CORS | 🟢 10 min |
| 8 🟡 | M1 — Add rate limiting | 🟡 30 min |
| 9 🟡 | M2 — Add Helmet | 🟢 5 min |
| 10 🟡 | M5 — Token storage | 🔴 4+ hrs |

---

*This audit covers code review only. A full assessment would include dynamic testing (DAST), dependency vulnerability scanning (`npm audit`), and infrastructure review.*
