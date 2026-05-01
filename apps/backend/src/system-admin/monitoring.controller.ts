import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { DatabaseService } from '../database/database.service';
import { Public } from '../auth/public.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('system')
@Controller('api')
export class MonitoringController {
  private readonly logger = new Logger(MonitoringController.name);

  constructor(private readonly db: DatabaseService) {}

  // ─── Health Check (public) ──────────────────────────────────
  @Public()
  @Get('health')
  async health() {
    let dbStatus = 'ok';
    try {
      await this.db.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    const mem = process.memoryUsage();
    return {
      status: dbStatus === 'ok' ? 'healthy' : 'degraded',
      uptime: Math.floor(process.uptime()),
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
    @Body()
    body: {
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

  // ─── System Audit Log (admin only) ──────────────────────────
  @UseGuards(JwtAuthGuard, IsSystemAdminGuard)
  @Get('system/audit-log')
  async getSystemAuditLog(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('actorId') actorId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    let whereClause = 'WHERE schoolId IS NULL';
    const params: any[] = [];
    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }
    if (entity) {
      whereClause += ' AND entity = ?';
      params.push(entity);
    }
    if (actorId) {
      whereClause += ' AND actorId = ?';
      params.push(actorId);
    }
    if (dateFrom) {
      whereClause += ' AND a.createdAt >= ?';
      params.push(new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      whereClause += ' AND a.createdAt <= ?';
      // Append end of day if only date is provided
      const to = dateTo.includes('T')
        ? new Date(dateTo).toISOString()
        : new Date(dateTo + 'T23:59:59.999Z').toISOString();
      params.push(to);
    }

    const sql = `
      SELECT a.*, u.id as actorId, u.firstName, u.lastName, u.email
      FROM AuditLog a
      LEFT JOIN User u ON a.actorId = u.id
      ${whereClause}
      ORDER BY a.createdAt DESC
      LIMIT ? OFFSET ?
    `;

    const countSql = `SELECT COUNT(*) as count FROM AuditLog a ${whereClause}`;

    const [rows, countResult] = await Promise.all([
      this.db.query(sql, [...params, take, skip]),
      this.db.queryOne<{ count: number }>(countSql, params),
    ]);

    const data = rows.map((row: any) => ({
      ...row,
      actor: row.actorId
        ? {
            id: row.actorId,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
          }
        : null,
    }));

    return {
      data,
      total: countResult?.count || 0,
      page: Number(page),
      limit: take,
    };
  }
}
