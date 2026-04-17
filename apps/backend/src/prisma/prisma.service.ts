import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  
  // Use a dedicated property for the extended client to avoid cyclic prototype issues
  public client: any;

  constructor(
    private readonly cls: ClsService,
    @Inject('CLOUDFLARE_DB') private readonly d1: any,
  ) {
    super(PrismaService.getOptions(d1));
    this.client = this; // Default to base client
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
    
    // Create the extended client
    this.client = this.$extends({
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

    // We MUST NOT try to copy properties from the Proxy back to the instance
    // Instead, we ensure this service instance proxies key methods to the extended client
    // For specific models, NestJS uses property access (e.g. this.prisma.user)
    // We can use a Proxy on the service itself or manually map models.
  }

  // Model accessors that use the extended client
  get user() { return this.client.user; }
  get school() { return this.client.school; }
  get schoolMembership() { return this.client.schoolMembership; }
  get classroom() { return this.client.classroom; }
  get subject() { return this.client.subject; }
  get subjectInstance() { return this.client.subjectInstance; }
  get grade() { return this.client.grade; }
  get studentProfile() { return this.client.studentProfile; }
  get studentEnrollment() { return this.client.studentEnrollment; }
  get teacherProfile() { return this.client.teacherProfile; }
  get academicYear() { return this.client.academicYear; }
  get semester() { return this.client.semester; }
  get scheduleEvent() { return this.client.scheduleEvent; }
  get substitution() { return this.client.substitution; }
  get message() { return this.client.message; }
  get conversation() { return this.client.conversation; }
  get notification() { return this.client.notification; }
  get auditLog() { return this.client.auditLog; }
  get systemSecret() { return this.client.systemSecret; }
  get systemLog() { return this.client.systemLog; }
  get aiTokenUsage() { return this.client.aiTokenUsage; }
  get timeSlot() { return this.client.timeSlot; }
  get thematicPlan() { return this.client.thematicPlan; }
  get teachingMaterial() { return this.client.teachingMaterial; }
  get lessonPlan() { return this.client.lessonPlan; }
  get schoolEvent() { return this.client.schoolEvent; }
  get behaviorGrade() { return this.client.behaviorGrade; }
  get competencyGrade() { return this.client.competencyGrade; }
  get competency() { return this.client.competency; }
  get educationalMeasure() { return this.client.educationalMeasure; }
  get commissionExam() { return this.client.commissionExam; }
  get gradingDeadline() { return this.client.gradingDeadline; }
  get reportCard() { return this.client.reportCard; }
  get classBookEntry() { return this.client.classBookEntry; }
  get teacherSignature() { return this.client.teacherSignature; }
  get room() { return this.client.room; }
  get building() { return this.client.building; }
  get scheduleSnapshot() { return this.client.scheduleSnapshot; }
  get absenceExcuse() { return this.client.absenceExcuse; }

  // Global methods
  override $queryRaw(query: any, ...values: any[]) { return this.client.$queryRaw(query, ...values); }
  override $executeRaw(query: any, ...values: any[]) { return this.client.$executeRaw(query, ...values); }
  override $transaction(arg: any, options?: any) { return this.client.$transaction(arg, options); }

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
      await this.client.auditLog.create({
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
}
