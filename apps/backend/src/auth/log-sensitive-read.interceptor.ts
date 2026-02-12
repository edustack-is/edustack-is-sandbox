import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { LOG_SENSITIVE_READ_KEY } from './log-sensitive-read.decorator';

@Injectable()
export class LogSensitiveReadInterceptor implements NestInterceptor {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const isSensitive = this.reflector.getAllAndOverride<boolean>(LOG_SENSITIVE_READ_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!isSensitive) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
        const userAgent = request.headers['user-agent'];
        const method = request.method;
        const url = request.url;

        return next.handle().pipe(
            tap(async () => {
                if (user) {
                    try {
                        await this.prisma.auditLog.create({
                            data: {
                                action: 'READ_SENSITIVE',
                                actorId: user.id || user.sub, // user object from JWT strategy usually has id (if sub is mapped) or sub
                                entity: 'Endpoint',
                                entityId: `${method} ${url}`,
                                ipAddress: ip as string,
                                userAgent: userAgent,
                                newValues: { userAccessed: user.email },
                            },
                        });
                    } catch (e) {
                        console.error('Failed to log sensitive read', e);
                    }
                }
            }),
        );
    }
}
