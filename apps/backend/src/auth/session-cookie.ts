import type { Response } from 'express';
import { JWT_COOKIE_NAME } from './jwt.strategy';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Attach the JWT to the response as an httpOnly cookie.
 * - httpOnly: JS cannot read it → XSS can't exfiltrate the token.
 * - Secure: only sent over HTTPS in production.
 * - SameSite=Lax: blocks third-party POSTs that would otherwise carry
 *   the cookie (sufficient CSRF defence for most flows; sensitive
 *   endpoints still benefit from explicit CSRF tokens in future).
 * - Path=/: the cookie is used by /api/* endpoints, but the cookie is
 *   not exposed to the static frontend either way.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_DAY_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(JWT_COOKIE_NAME, { path: '/' });
}
