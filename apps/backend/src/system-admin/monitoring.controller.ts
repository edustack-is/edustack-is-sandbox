import { Controller, Get, Post, Body, Query, UseGuards, Req, Logger } from '@nestjs/common';
import { ApiTags , ApiOperation , ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';
import { Throttle } from '@nestjs/throttler';

import { HealthCheckResponseDto, MetricsResponseDto } from '../common/dto/response.dto';
// ─── In-memory Prometheus-style metrics ─────────────────────────
const metrics = {
    httpRequestsTotal: 0,
    httpErrorsTotal: 0,
    loginAttemptsSuccess: 0,
    loginAttemptsFailed: 0,
    startTime: Date.now(),
};

/** Call from middleware or interceptors to increment counters */
export function incrementMetric(key: keyof typeof metrics) {
    (metrics as any)[key]++;
}

@ApiTags('system')
@Controller('api')
export class MonitoringController {
    private readonly logger = new Logger(MonitoringController.name);

    constructor(private readonly prisma: PrismaService) { }

    // ─── Health Check (public) ──────────────────────────────────
    @Public()
    @Get('health')
    async health() {
        let dbStatus = 'ok';
        try {
            await this.prisma.$queryRaw`SELECT 1`;
        } catch {
            dbStatus = 'error';
        }

        const mem = process.memoryUsage();
        return {
            status: dbStatus === 'ok' ? 'healthy' : 'degraded',
            uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
            database: dbStatus,
            memory: {
                rss: Math.round(mem.rss / 1024 / 1024),
                heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
                heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
            },
            version: process.env.npm_package_version || '1.0.0',
            timestamp: new Date().toISOString(),
        };
    }

    // ─── Frontend log relay (public, rate-limited) ──────────────
    @Public()
    @Post('logs')
    @Throttle({ default: { ttl: 60000, limit: 20 } })
    receiveFrontendLog(
        @Body() body: {
            level: string;
            message: string;
            stack?: string;
            url?: string;
            userAgent?: string;
            userId?: string;
            timestamp?: string;
        },
    ) {
        const logEntry = {
            source: 'frontend',
            level: body.level || 'error',
            message: body.message,
            stack: body.stack,
            url: body.url,
            userAgent: body.userAgent,
            userId: body.userId,
            timestamp: body.timestamp || new Date().toISOString(),
        };

        // Output as structured JSON to stdout → Logstash picks it up
        if (body.level === 'error') {
            this.logger.error(JSON.stringify(logEntry));
        } else if (body.level === 'warn') {
            this.logger.warn(JSON.stringify(logEntry));
        } else {
            this.logger.log(JSON.stringify(logEntry));
        }

        return { received: true };
    }

    // ─── Prometheus-style metrics (admin only) ──────────────────
    @UseGuards(JwtAuthGuard, IsSystemAdminGuard)
    @Get('metrics')
    getMetrics() {
        const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
        const mem = process.memoryUsage();

        // Prometheus text format
        const lines = [
            '# HELP edustack_uptime_seconds Backend uptime in seconds',
            '# TYPE edustack_uptime_seconds gauge',
            `edustack_uptime_seconds ${uptimeSeconds}`,
            '',
            '# HELP edustack_http_requests_total Total HTTP requests',
            '# TYPE edustack_http_requests_total counter',
            `edustack_http_requests_total ${metrics.httpRequestsTotal}`,
            '',
            '# HELP edustack_http_errors_total Total HTTP errors',
            '# TYPE edustack_http_errors_total counter',
            `edustack_http_errors_total ${metrics.httpErrorsTotal}`,
            '',
            '# HELP edustack_login_attempts_total Login attempts',
            '# TYPE edustack_login_attempts_total counter',
            `edustack_login_attempts_total{result="success"} ${metrics.loginAttemptsSuccess}`,
            `edustack_login_attempts_total{result="failed"} ${metrics.loginAttemptsFailed}`,
            '',
            '# HELP edustack_memory_rss_bytes Process RSS memory',
            '# TYPE edustack_memory_rss_bytes gauge',
            `edustack_memory_rss_bytes ${mem.rss}`,
            '',
            '# HELP edustack_memory_heap_used_bytes Heap used',
            '# TYPE edustack_memory_heap_used_bytes gauge',
            `edustack_memory_heap_used_bytes ${mem.heapUsed}`,
        ];

        return lines.join('\n');
    }

    // ─── System Audit Log (admin only) ──────────────────────────
    @UseGuards(JwtAuthGuard, IsSystemAdminGuard)
    @Get('system/audit-log')
    async getSystemAuditLog(
        @Query('page') page = '1',
        @Query('limit') limit = '50',
        @Query('action') action?: string,
    ) {
        const take = Math.min(Number(limit) || 50, 100);
        const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

        const where: any = { schoolId: null }; // system-level only
        if (action) where.action = action;

        const [data, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                include: {
                    actor: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                take,
                skip,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return { data, total, page: Number(page), limit: take };
    }

    // ─── Settings CRUD (admin only) ─────────────────────────────
    // These are handled separately because they share the /api prefix
    // but the actual settings endpoints are on the SystemAdminController
}
