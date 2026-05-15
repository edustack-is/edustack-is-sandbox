import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Cookie name used for the JWT. Kept short and obviously-EDU-scoped.
export const JWT_COOKIE_NAME = '__edu_session';

/**
 * Extract the JWT from the httpOnly session cookie if present.
 * Falls back to the Authorization header (Bearer) so that API clients,
 * E2E tests and the MCP integration keep working during the transition.
 */
function extractJwt(req: Request): string | null {
  // Prefer the cookie — that's the path the browser uses now.
  const cookieToken =
    (req as any).cookies?.[JWT_COOKIE_NAME] ??
    (req as any).signedCookies?.[JWT_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }
  // Bearer fallback for non-browser callers.
  const bearer = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  return bearer || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error(
        '❌ JWT_SECRET is not set! The application cannot start without a valid JWT secret. ' +
          'Generate one with: openssl rand -base64 64',
      );
    }
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role, // Only present in Tenant JWT
      schoolId: payload.schoolId, // Only present in Tenant JWT
      isSystemAdmin: payload.isSystemAdmin,
      type: payload.type, // 'GLOBAL' or 'TENANT'
    };
  }
}
