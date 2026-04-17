import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  
  // The actual Prisma client instance
  private readonly _baseClient: PrismaClient;
  
  // The extended client instance
  private _extendedClient: any;

  constructor(
    private readonly cls: ClsService,
    @Inject('CLOUDFLARE_DB') private readonly d1: any,
  ) {
    const options = PrismaService.getOptions(d1);
    this._baseClient = new PrismaClient(options);
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
    await this._baseClient.$connect();
    this.setupExtensions();
  }

  private setupExtensions() {
    const self = this;
    
    this._extendedClient = this._baseClient.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // 1. Bypass for logs
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
  }

  private async logAudit(actorId: string, action: string, entity: string, entityId: string, args: any) {
    const scrub = (data: any) => {
      if (!data) return null;
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
      // Use the internal extended client directly to avoid re-triggering middleware
      await this._extendedClient.auditLog.create({
        data: {
          action,
          entity,
          entityId,
          actorId,
          newValues: scrub(args?.data || args),
        },
      });
    } catch (e) {
      // Fail silently
    }
  }

  // Delegate all Prisma model accessors to the extended client
  get user() { return this._extendedClient.user; }
  get school() { return this._extendedClient.school; }
  get schoolMembership() { return this._extendedClient.schoolMembership; }
  get classroom() { return this._extendedClient.classroom; }
  get subject() { return this._extendedClient.subject; }
  get subjectInstance() { return this._extendedClient.subjectInstance; }
  get grade() { return this._extendedClient.grade; }
  get studentProfile() { return this._extendedClient.studentProfile; }
  get studentEnrollment() { return this._extendedClient.studentEnrollment; }
  get teacherProfile() { return this._extendedClient.teacherProfile; }
  get academicYear() { return this._extendedClient.academicYear; }
  get semester() { return this._extendedClient.semester; }
  get scheduleEvent() { return this._extendedClient.scheduleEvent; }
  get substitution() { return this._extendedClient.substitution; }
  get message() { return this._extendedClient.message; }
  get conversation() { return this._extendedClient.conversation; }
  get notification() { return this._extendedClient.notification; }
  get auditLog() { return this._extendedClient.auditLog; }
  get systemSecret() { return this._extendedClient.systemSecret; }
  get systemLog() { return this._extendedClient.systemLog; }
  get aiTokenUsage() { return this._extendedClient.aiTokenUsage; }
  get timeSlot() { return this._extendedClient.timeSlot; }
  get thematicPlan() { return this._extendedClient.thematicPlan; }
  get teachingMaterial() { return this._extendedClient.teachingMaterial; }
  get lessonPlan() { return this._extendedClient.lessonPlan; }
  get schoolEvent() { return this._extendedClient.schoolEvent; }
  get behaviorGrade() { return this._extendedClient.behaviorGrade; }
  get competencyGrade() { return this._extendedClient.competencyGrade; }
  get competency() { return this._extendedClient.competency; }
  get educationalMeasure() { return this._extendedClient.educationalMeasure; }
  get commissionExam() { return this._extendedClient.commissionExam; }
  get gradingDeadline() { return this._extendedClient.gradingDeadline; }
  get reportCard() { return this._extendedClient.reportCard; }
  get classBookEntry() { return this._extendedClient.classBookEntry; }
  get teacherSignature() { return this._extendedClient.teacherSignature; }
  get room() { return this._extendedClient.room; }
  get building() { return this._extendedClient.building; }
  get scheduleSnapshot() { return this._extendedClient.scheduleSnapshot; }
  get absenceExcuse() { return this._extendedClient.absenceExcuse; }

  // Global methods
  get $transaction() { return this._extendedClient.$transaction; }
  async $queryRaw(query: any, ...values: any[]) { return this._extendedClient.$queryRaw(query, ...values); }
  async $executeRaw(query: any, ...values: any[]) { return this._extendedClient.$executeRaw(query, ...values); }
  async $connect() { return this._baseClient.$connect(); }
  async $disconnect() { return this._baseClient.$disconnect(); }
}
