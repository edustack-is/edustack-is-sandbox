import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
