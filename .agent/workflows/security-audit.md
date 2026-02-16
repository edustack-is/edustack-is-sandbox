---
description: Run a security audit on the backend and frontend codebase
---

# Security Audit Workflow

## Steps

1. **Review authentication & authorization layer**
   - Check `apps/backend/src/auth/` — guards, strategies, decorators
   - Verify JWT secret configuration (no hardcoded fallbacks)
   - Verify impersonation is properly authorized (admin ID from JWT, not body)
   - Check all `@Public()` endpoints are intentional

2. **Review input validation**
   - Check `main.ts` for global `ValidationPipe` with `whitelist: true`
   - Verify DTOs use `class-validator` decorators
   - Check password policy enforcement (server-side, not just frontend)

3. **Review infrastructure security**
   - Check `docker-compose.yml` for exposed ports (bind to `127.0.0.1`)
   - Verify Adminer/PgAdmin only available in dev profiles
   - Check that DB credentials are not hardcoded defaults in production
   - Verify `CORS_ORIGIN` is explicitly configured

4. **Review security headers**
   - Check `main.ts` for `helmet()` middleware
   - Verify CSP is configured for production
   - Check `X-Frame-Options`, `nosniff`, HSTS headers

5. **Review secrets management**
   - Check `CryptoService` for hardcoded encryption keys
   - Verify fail-fast on missing `JWT_SECRET` and `ENCRYPTION_KEY`
   - Check `.env.example` has all required variables documented
   - Verify `SETUP_TOKEN` guard on init endpoints

6. **Review rate limiting**
   - Check `ThrottlerModule` is configured in `app.module.ts`
   - Verify critical endpoints have per-route throttle limits
   - Check login, setup, and seed endpoints

7. **Review token handling**
   - Check SSO callback does NOT expose JWT in URL query parameters
   - Verify httpOnly cookies are used for SSO token exchange
   - Check `withCredentials: true` on frontend axios instance
   - Review localStorage token storage (note: full migration to httpOnly is a future task)

8. **Review RBAC**
   - Check `RolesGuard` validates school context (schoolId in JWT)
   - Verify system admin bypass is properly handled
   - Check that Global tokens cannot access role-gated endpoints

9. **Update `SECURITY-AUDIT.md`**
   - Mark fixed findings with ✅ and the fix commit reference
   - Document any new findings
   - Update remediation priority table

10. **Commit changes**
    ```bash
    git add -A && git commit -m "security: update audit report"
    ```
