import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  public client: any;

  constructor(
    private readonly cls: ClsService,
    @Inject('CLOUDFLARE_DB') private readonly d1: any,
  ) {
    super(PrismaService.getOptions(d1));
    this.client = this; // Default
  }

  private static getOptions(d1: any) {
    const dbAdapter = process.env.DB_ADAPTER || 'sqlite';
    const options: any = { log: ['warn', 'error'] };

    if (d1 || dbAdapter === 'd1') {
      const { PrismaD1 } = require('@prisma/adapter-d1');
      options.adapter = new PrismaD1(d1 || (globalThis as any).DB);
    } else if (dbAdapter === 'sqlite') {
      const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
      const fs = require('fs');
      const path = require('path');

      let dbPath = process.env.DATABASE_URL?.replace('file:', '');
      if (!dbPath || (fs.existsSync(dbPath) && fs.statSync(dbPath).size === 0)) {
        let currentPath = process.cwd();
        for (let i = 0; i < 4; i++) {
          const dir = path.join(currentPath, 'apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
          const dirDirect = path.join(currentPath, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
          for (const d of [dir, dirDirect]) {
            if (fs.existsSync(d)) {
              const dbFile = fs.readdirSync(d).find((f: string) => f.endsWith('.sqlite') && f !== 'metadata.sqlite');
              if (dbFile) { dbPath = path.join(d, dbFile); break; }
            }
          }
          if (dbPath) break;
          currentPath = path.join(currentPath, '..');
        }
      }

      if (!dbPath) throw new Error('❌ Wrangler D1 database not found.');
      options.adapter = new PrismaBetterSqlite3({ url: path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath) });
    }
    return options;
  }

  async onModuleInit() {
    await this.$connect();
    this.setupExtensions();
  }

  private setupExtensions() {
    const self = this;
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // 1. Bypass for logs to avoid recursion and overhead
            if (['AuditLog', 'SystemLog', 'AiTokenUsage'].includes(model)) {
              return query(args);
            }

            // 2. Tenant Isolation
            const isolatedModels = ['Classroom', 'Subject', 'Grade', 'ScheduleEvent'];
            const schoolId = self.cls.get('schoolId');
            const user = self.cls.get('user');
            const isSystemAdmin = user?.isSystemAdmin;

            const unsafeArgs = (args as any) || {};
            if (isolatedModels.includes(model) && schoolId && !isSystemAdmin) {
              if (operation === 'create') unsafeArgs.data = { ...unsafeArgs.data, schoolId };
              else if (['findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {
                unsafeArgs.where = { ...unsafeArgs.where, schoolId };
              }
            }

            // 3. Execute main query
            const result = await query(unsafeArgs);

            // 4. Async Audit Log
            if (['create', 'update', 'delete', 'upsert'].includes(operation) && user?.id) {
              const entityId = (result as any)?.id || (unsafeArgs as any)?.where?.id || 'unknown';
              self.logAudit(user.id, operation.toUpperCase(), model, String(entityId), unsafeArgs)
                  .catch(e => self.logger.warn(`Audit log failed: ${e.message}`));
            }

            return result;
          },
        },
      },
    });

    // Correctly proxy ALL methods from the extended client to THIS instance
    this.client = extended;
    const keys = Object.keys(extended).concat(Object.getOwnPropertyNames(Object.getPrototypeOf(extended)));
    for (const key of keys) {
      if (typeof (extended as any)[key] === 'function' && key !== 'constructor') {
        (this as any)[key] = (extended as any)[key].bind(extended);
      } else if (typeof (extended as any)[key] === 'object' && key !== 'constructor') {
        (this as any)[key] = (extended as any)[key];
      }
    }
  }

  private async logAudit(actorId: string, action: string, entity: string, entityId: string, args: any) {
    const scrub = (data: any) => {
      if (!data) return null;
      // Stricter scrubbing for audit logs to prevent SQLite parameter overflow
      if (typeof data === 'object') {
        const keys = Object.keys(data);
        if (keys.length > 50) return { _summary: `Object too large (${keys.length} keys)`, _keys: keys.slice(0, 5) };
        const copy = Array.isArray(data) ? data.slice(0, 3) : { ...data };
        const sensitive = ['passwordHash', 'token', 'invitationToken'];
        if (!Array.isArray(copy)) {
            sensitive.forEach(f => delete (copy as any)[f]);
        }
        return copy;
      }
      return data;
    };

    try {
      await (this as any).auditLog.create({
        data: {
          action,
          entity,
          entityId,
          actorId,
          newValues: scrub(args?.data || args),
        },
      });
    } catch (e) {
      // Fail silently for audit logs
    }
  }
}
