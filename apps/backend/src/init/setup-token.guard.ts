import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard that protects setup endpoints with an optional SETUP_TOKEN.
 *
 * If SETUP_TOKEN is set in the environment, the client MUST send it
 * in the `x-setup-token` header. If SETUP_TOKEN is NOT set, the guard
 * allows the request through (backwards-compatible for development).
 *
 * This prevents race-condition attacks during deployment where an
 * attacker could call /api/init/setup before the legitimate admin.
 */
@Injectable()
export class SetupTokenGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredToken = this.configService.get<string>('SETUP_TOKEN');

    // If no SETUP_TOKEN is configured, allow (dev mode)
    if (!requiredToken) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const providedToken = request.headers['x-setup-token'];

    if (!providedToken || providedToken !== requiredToken) {
      throw new ForbiddenException(
        'Invalid or missing setup token. Provide a valid x-setup-token header.',
      );
    }

    return true;
  }
}
