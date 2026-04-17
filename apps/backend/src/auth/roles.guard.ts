import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();

    // System admins bypass role checks — they can access everything
    if (user.isSystemAdmin) {
      return true;
    }

    // For Tenant JWTs, verify the role matches AND the schoolId is present
    if (user.type === 'TENANT') {
      if (!user.schoolId) {
        throw new ForbiddenException('Tenant token is missing schoolId.');
      }
      // The role in the JWT must match one of the required roles
      return requiredRoles.some((role) => user.role === role);
    }

    // For GLOBAL tokens, the user.role may not be set (it's per-school).
    // Global token users that are not system admins cannot pass role-gated endpoints.
    if (user.type === 'GLOBAL') {
      // Global tokens don't carry a school-specific role — deny role-gated access
      throw new ForbiddenException(
        'This endpoint requires a school-scoped token. Please select a school first.',
      );
    }

    // Fallback: check role as before (backwards compatibility)
    return requiredRoles.some((role) => user.role === role);
  }
}
