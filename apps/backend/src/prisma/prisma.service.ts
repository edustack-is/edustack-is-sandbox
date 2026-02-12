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
                        if (model === 'AuditLog' || model === 'SystemLog') {
                            return query(args);
                        }
                        return self.handleAudit({ model, operation, args, query });
                    },
                },
            },
        });
    }

    async handleAudit({ model, operation, args, query }: any) {
        const user = this.cls.get('user');
        const actorId = user ? user.id : 'system';

        // CREATE
        if (operation === 'create') {
            const result = await query(args);
            await this.logAudit(actorId, 'CREATE', model, result.id, null, result);
            return result;
        }

        // UPDATE
        if (operation === 'update') {
            let oldData = null;
            try {
                oldData = await (this as any)[model].findUnique({ where: args.where });
            } catch (e) { }

            const result = await query(args);
            await this.logAudit(actorId, 'UPDATE', model, result.id, oldData, result);
            return result;
        }

        // DELETE
        if (operation === 'delete') {
            let oldData = null;
            try {
                oldData = await (this as any)[model].findUnique({ where: args.where });
            } catch (e) { }

            const result = await query(args);
            await this.logAudit(actorId, 'DELETE', model, result.id, oldData, null);
            return result;
        }

        return query(args);
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
