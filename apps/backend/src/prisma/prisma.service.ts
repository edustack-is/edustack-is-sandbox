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
    this.client = this; // Default to base client until extended
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
      if (
        !dbPath ||
        (fs.existsSync(dbPath) && fs.statSync(dbPath).size === 0)
      ) {
        // Auto-detect Wrangler hashed DB
        let currentPath = process.cwd();
        // Scan up to 4 levels up to find the apps/backend/.wrangler state (monorepo root context)
        for (let i = 0; i < 4; i++) {
          const dir = path.join(
            currentPath,
            'apps/backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
          );
          const dirDirect = path.join(
            currentPath,
            '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
          );

          for (const d of [dir, dirDirect]) {
            if (fs.existsSync(d)) {
              const dbFile = fs
                .readdirSync(d)
                .find(
                  (f: string) =>
                    f.endsWith('.sqlite') && f !== 'metadata.sqlite',
                );
              if (dbFile) {
                dbPath = path.join(d, dbFile);
                break;
              }
            }
          }
          if (dbPath) break;
          currentPath = path.join(currentPath, '..');
        }
      }

      if (!dbPath) {
        throw new Error(
          '❌ Wrangler D1 local database not found. Please run "npm run db:init" first.',
        );
      }

      const finalPath = path.isAbsolute(dbPath)
        ? dbPath
        : path.resolve(process.cwd(), dbPath);
      options.adapter = new PrismaBetterSqlite3({ url: finalPath });
    }
    return options;
  }

  async onModuleInit() {
    await this.$connect();
    this.setupExtensions();
  }

  private setupExtensions() {
    const self = this;
    this.client = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            try {
              // 1. Bypass for logs
              if (
                model === 'AuditLog' ||
                model === 'SystemLog' ||
                model === 'AiTokenUsage'
              ) {
                return query(args);
              }

              // 2. Tenant Isolation
              const isolatedModels = [
                'Classroom',
                'Subject',
                'Grade',
                'ScheduleEvent',
              ];
              const schoolId = self.cls.get('schoolId');
              const user = self.cls.get('user');
              const isSystemAdmin = user?.isSystemAdmin;

              const unsafeArgs = (args as any) || {};

              if (
                isolatedModels.includes(model) &&
                schoolId &&
                !isSystemAdmin
              ) {
                if (operation === 'create') {
                  unsafeArgs.data = { ...unsafeArgs.data, schoolId };
                } else if (
                  [
                    'findFirst',
                    'findMany',
                    'update',
                    'updateMany',
                    'delete',
                    'deleteMany',
                    'count',
                  ].includes(operation)
                ) {
                  unsafeArgs.where = { ...unsafeArgs.where, schoolId };
                }
              }

              // 3. Execute Query
              let result;
              try {
                result = await query(unsafeArgs);
              } catch (err: any) {
                if (err.message?.includes('parameter values')) {
                   console.error(`❌ PRISMA PARAMETER OVERFLOW in ${model}.${operation}`);
                }
                throw err;
              }

              // 4. Async Audit Log (Non-blocking)
              if (
                ['create', 'update', 'delete', 'upsert'].includes(operation) &&
                user?.id
              ) {
                const entityId = (result as any)?.id || (unsafeArgs as any)?.where?.id || 'unknown';
                self.logAudit(
                  user.id,
                  operation.toUpperCase(),
                  model,
                  String(entityId),
                  null,
                  operation === 'update' ? null : unsafeArgs,
                ).catch(e => self.logger.warn(`Audit log async task failed: ${e.message}`));
              }

              return result;
            } catch (error) {
              throw error;
            }
          },
        },
      },
    });

    // Replace methods on this instance to use the extended client
    const clientProto = Object.getPrototypeOf(this.client);
    for (const key of Object.keys(this.client)) {
      if (typeof this.client[key] === 'object' && key !== 'constructor') {
        (this as any)[key] = this.client[key];
      }
    }
  }

  private async logAudit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    oldValues: any,
    newValues: any,
  ) {
    const scrub = (data: any) => {
      if (!data) return null;

      // Handle massive data objects
      if (typeof data === 'object' && !Array.isArray(data)) {
        const keys = Object.keys(data);
        if (keys.length > 100) {
          return { _summary: `Object too large to log (${keys.length} keys)`, _keys: keys.slice(0, 10) };
        }
      }

      const sensitive = ['passwordHash', 'token', 'invitationToken'];
      const copy = Array.isArray(data) ? [...data.slice(0, 5)] : { ...data };
      if (!Array.isArray(copy)) {
        sensitive.forEach((field) => {
          if (field in copy) delete copy[field];
        });
      }
      return copy;
    };

    try {
      await (this as any).auditLog.create({
        data: {
          action,
          entity,
          entityId: String(entityId || 'unknown'),
          actorId,
          oldValues: scrub(oldValues),
          newValues: scrub(newValues),
        },
      });
    } catch (e) {
      this.logger.warn(`Audit log failed: ${e.message}`);
    }
  }
}
