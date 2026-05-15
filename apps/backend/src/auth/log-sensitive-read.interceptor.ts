import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { LOG_SENSITIVE_READ_KEY } from './log-sensitive-read.decorator';
import * as crypto from 'crypto';

@Injectable()
export class LogSensitiveReadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LogSensitiveReadInterceptor.name);

  constructor(
    private reflector: Reflector,
    private db: DatabaseService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isSensitive = this.reflector.getAllAndOverride<boolean>(
      LOG_SENSITIVE_READ_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isSensitive) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ip =
      request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    const userAgent = request.headers['user-agent'];
    const method = request.method;
    const url = request.url;

    return next.handle().pipe(
      tap(async () => {
        if (user) {
          try {
            const actorId = user.userId;
            await this.db.execute(
              'INSERT INTO "AuditLog" (id, action, actorId, entity, entityId, ipAddress, userAgent, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [
                crypto.randomUUID(),
                'READ_SENSITIVE',
                actorId,
                'Endpoint',
                `${method} ${url}`,
                (ip as string) || null,
                userAgent || null,
                JSON.stringify({ userAccessed: user.email }),
                new Date().toISOString(),
              ],
            );
          } catch (e) {
            this.logger.error('Failed to log sensitive read', e as Error);
          }
        }
      }),
    );
  }
}
