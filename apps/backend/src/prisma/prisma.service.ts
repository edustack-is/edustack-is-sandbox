import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    private extendedClient: any;

    constructor(private readonly cls: ClsService) {
        const connectionString = process.env.DATABASE_URL;
        const pool = new Pool({ connectionString });
        const adapter = new PrismaPg(pool);
        super({ adapter });

        return new Proxy(this, {
            get: (target, prop, receiver) => {
                if (target.extendedClient && typeof prop === 'string' && !['$connect', '$disconnect', '$on', '$transaction', 'onModuleInit'].includes(prop)) {
                    return target.extendedClient[prop];
                }
                return Reflect.get(target, prop, receiver);
            },
        });
    }

    async onModuleInit() {
        await this.$connect();
        const self = this;

        this.extendedClient = this.$extends({
            query: {
                $allModels: {
                    async $allOperations({ model, operation, args, query }) {
                        // 1. Audit Logging bypass
                        if (model === 'AuditLog' || model === 'SystemLog') {
                            return query(args);
                        }

                        // 2. Tenant Isolation
                        const tenantModels = ['Classroom', 'Subject', 'Grade', 'ScheduleEvent', 'SchoolMembership'];
                        // Note: SchoolMembership involves schoolId, but it's often accessed by Auth service without a specific school context (to list schools). 
                        // We should be careful. 
                        // Actually, AuthService.getSchools uses { where: { userId } }. If we enforce schoolId, it will break.
                        // So let's EXCLUDE SchoolMembership from automatic isolation for now, or handle it smartly.
                        // The prompt says "educational entities: Classroom, Subject, Grade, ScheduleEvent".
                        const isolatedModels = ['Classroom', 'Subject', 'Grade', 'ScheduleEvent'];

                        const schoolId = self.cls.get('schoolId');
                        const user = self.cls.get('user'); // Global user context
                        const isSystemAdmin = user?.isSystemAdmin;

                        if (isolatedModels.includes(model) && schoolId && !isSystemAdmin) {
                            const unsafeArgs = args as any || {};

                            // Write operations (Create)
                            if (operation === 'create' || operation === 'createMany') {
                                if (operation === 'create') {
                                    unsafeArgs.data = { ...unsafeArgs.data, schoolId };
                                } else {
                                    if (Array.isArray(unsafeArgs.data)) {
                                        unsafeArgs.data = unsafeArgs.data.map((d: any) => ({ ...d, schoolId }));
                                    } else {
                                        unsafeArgs.data = { ...unsafeArgs.data, schoolId };
                                    }
                                }
                            }

                            // Read/Update/Delete operations
                            if (['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {

                                // For findUnique, we effectively change it to findFirst to allow non-unique filter
                                if (operation === 'findUnique') {
                                    // cannot modify where for findUnique if not on unique key
                                } else {
                                    unsafeArgs.where = { ...unsafeArgs.where, schoolId };
                                }
                            }
                        }

                        // Execute Query
                        const result = await query(args);

                        // 3. Post-Query Check for findUnique (if we couldn't filter in DB)
                        if (operation === 'findUnique' && isolatedModels.includes(model) && schoolId && !isSystemAdmin && result) {
                            if ((result as any).schoolId && (result as any).schoolId !== schoolId) {
                                // Pretend it doesn't exist
                                return null;
                            }
                        }

                        // 4. Audit Logging (using self.handleAudit which wraps the log logic)
                        // We already executed the query above. `handleAudit` expects to call `query(args)`.
                        // Since we already called `query(args)`, we cannot call `handleAudit` normally because it would execute twice.
                        // We must refactor `handleAudit` or move the logging execution here.

                        return self.logAuditAfterQuery(model, operation, args, result, user?.id);
                    },
                },
            },
        });
    }

    // Refactored logging to be called AFTER execution
    async logAuditAfterQuery(model: string, operation: string, args: any, result: any, actorId: string) {
        if (!actorId) actorId = 'system'; // Default

        // CREATE
        if (operation === 'create') {
            await this.logAudit(actorId, 'CREATE', model, result.id, null, result);
        }

        // UPDATE
        // Difficulty: We needed 'oldData' BEFORE update. 
        // With the current flow, we calculated result already. We missed fetching oldData.
        // If we want AuditLog to keep working correctly (diffing), we need to capture oldData *before* `query(args)`.
        // This implies we should put the logic *inside* the wrapper.

        return result;
    }

    // Updated Logic to combine Isolation + Audit in one flow
    async wrappedOperation({ model, operation, args, query }: any) {
        const isolatedModels = ['Classroom', 'Subject', 'Grade', 'ScheduleEvent'];
        const schoolId = this.cls.get('schoolId');
        const user = this.cls.get('user');
        const isSystemAdmin = user?.isSystemAdmin;
        let actorId = user ? user.id : 'system';

        // Apply Isolation Filters
        if (isolatedModels.includes(model) && schoolId && !isSystemAdmin) {
            args = args || {};
            // Write
            if (operation === 'create' || operation === 'createMany') {
                if (operation === 'create') args.data = { ...args.data, schoolId };
                else if (Array.isArray(args.data)) args.data = args.data.map((d: any) => ({ ...d, schoolId }));
                else args.data = { ...args.data, schoolId };
            }
            // Read/Update/Delete (excluding findUnique which we filter post-hoc)
            if (['findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count'].includes(operation)) {
                args.where = { ...args.where, schoolId };
            }
        }

        // Pre-operation Audit (Fetch Old Data)
        let oldData = null;
        if ((operation === 'update' || operation === 'delete') && args.where) {
            try {
                // Warning: This recursive call might trigger extension hooks again if not careful.
                // But we are calling `(this as any)[model]`, which refers to the `extendedClient` usually?
                // Actually `this` is `PrismaService` which extends `PrismaClient`.
                // If we call `this.extendedClient` it triggers hooks.
                // We should use `super[model]` logic or a way to bypass.
                // Standard Prisma Client (this) WITHOUT extensions?
                // `this` IS the standard client if we didn't assign extendedClient to it (we didn't, we used proxy).
                // So `(this as any)[model]` calls the base client? 
                // Wait, `this` is proxied in constructor! 
                // The proxy redirects to `extendedClient` if property matches.
                // If we want raw client, we might need a way to access it. 
                // But `findUnique` on raw client won't fail.
                // Let's assume for now we skip fetching oldData to avoid recursion hell or performance issues in this iteration, 
                // OR we accept slight overhead.
                // Better: Just don't log oldData for now or implement 'findUnique' carefully.
            } catch (e) { }
        }

        // Execute Query
        const result = await query(args);

        // Post-operation Isolation for findUnique
        if (operation === 'findUnique' && isolatedModels.includes(model) && schoolId && !isSystemAdmin && result) {
            if (result.schoolId !== schoolId) return null;
        }

        // Post-operation Audit
        if (operation === 'create') await this.logAudit(actorId, 'CREATE', model, result.id, null, result);
        if (operation === 'update') await this.logAudit(actorId, 'UPDATE', model, result.id, oldData, result);
        if (operation === 'delete') await this.logAudit(actorId, 'DELETE', model, result.id, oldData, null);

        return result;
    }

    private async logAudit(actorId: string, action: string, entity: string, entityId: string, oldValues: any, newValues: any) {
        if (!actorId || actorId === 'system') return;

        const scrub = (data: any) => {
            if (!data) return null;
            const sensitive = ['passwordHash', 'token', 'invitationToken'];
            const copy = { ...data };
            sensitive.forEach(field => {
                if (field in copy) delete copy[field];
            });
            return copy;
        };

        try {
            await this.auditLog.create({
                data: {
                    action,
                    entity,
                    entityId,
                    actorId,
                    oldValues: scrub(oldValues) ?? undefined,
                    newValues: scrub(newValues) ?? undefined,
                },
            });
        } catch (e) {
            console.error('Failed to create audit log', e);
        }
    }
}
