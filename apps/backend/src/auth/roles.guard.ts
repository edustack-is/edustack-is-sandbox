import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../database/types';
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

    if (user.isSystemAdmin) {
      return true;
    }

    if (user.type === 'TENANT') {
      if (!user.schoolId) {
        throw new ForbiddenException('Tenant token is missing schoolId.');
      }
      return requiredRoles.some((role) => user.role === role);
    }

    if (user.type === 'GLOBAL') {
      throw new ForbiddenException(
        'This endpoint requires a school-scoped token. Please select a school first.',
      );
    }

    return requiredRoles.some((role) => user.role === role);
  }
}
