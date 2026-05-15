import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  UserRole,
  UserStatus,
  School,
  AuditLog,
  User,
} from '../database/types';
import { CreateSchoolDto } from './dto/create-school.dto';
import * as crypto from 'crypto';
import * as os from 'os';
import { MailService } from '../mail/mail.service';
import { SystemAdminAiService } from './system-admin-ai.service';
import { BackupService } from './backup.service';

export interface DashboardStats {
  schoolCount: number;
  userCount: number;
  activeUserCount: number;
  recentLogins: Array<AuditLog & { actor: Partial<User> }>;
  aiUsage: any;
  backups: {
    total: number;
    lastBackup: string | null;
  };
  system: {
    uptime: number;
    memory: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
    os: {
      platform: string;
      release: string;
      cpuCount: number;
      totalMemory: number;
      freeMemory: number;
    };
  };
}

@Injectable()
export class SystemAdminService {
  private readonly logger = new Logger(SystemAdminService.name);

  constructor(
    private db: DatabaseService,
    private mailService: MailService,
    private aiService: SystemAdminAiService,
    private backupService: BackupService,
  ) {}

  async createSchool(dto: CreateSchoolDto) {
    const { schoolName, address, admin } = dto;

    const existing = await this.db.queryOne<School>(
      'SELECT id FROM "School" WHERE name = ? AND deletedAt IS NULL',
      [schoolName],
    );
    if (existing) {
      throw new BadRequestException(
        `Škola s názvem '${schoolName}' již existuje.`,
      );
    }

    if (admin.type === 'EXISTING') {
      const user = await this.db.queryOne<User>(
        'SELECT id FROM "User" WHERE id = ?',
        [admin.userId],
      );
      if (!user)
        throw new NotFoundException(`User with id ${admin.userId} not found`);

      return this.db.transaction(async (db) => {
        const schoolId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "School" (id, name, address, updatedAt) VALUES (?, ?, ?, ?)',
          [schoolId, schoolName, address || null, new Date().toISOString()],
        );

        await db.execute(
          'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            user.id,
            schoolId,
            UserRole.PRINCIPAL,
            UserStatus.ACTIVE,
            new Date().toISOString(),
          ],
        );

        return await db.queryOne<School>(
          'SELECT * FROM "School" WHERE id = ?',
          [schoolId],
        );
      });
    }

    if (admin.type === 'NEW') {
      const existingUser = await this.db.queryOne(
        'SELECT id FROM "User" WHERE email = ?',
        [admin.email],
      );
      if (existingUser) {
        throw new BadRequestException(
          `User with email ${admin.email} already exists. Use type EXISTING instead.`,
        );
      }

      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitationExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return this.db.transaction(async (db) => {
        const userId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "User" (id, email, firstName, lastName, invitationToken, invitationExpires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            userId,
            admin.email,
            admin.firstName,
            admin.lastName,
            invitationToken,
            invitationExpires.toISOString(),
            new Date().toISOString(),
          ],
        );

        const schoolId = crypto.randomUUID();
        await db.execute(
          'INSERT INTO "School" (id, name, address, updatedAt) VALUES (?, ?, ?, ?)',
          [schoolId, schoolName, address || null, new Date().toISOString()],
        );

        await db.execute(
          'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            userId,
            schoolId,
            UserRole.PRINCIPAL,
            UserStatus.PENDING,
            new Date().toISOString(),
          ],
        );

        this.mailService
          .sendInvitation(
            admin.email,
            `${admin.firstName} ${admin.lastName}`,
            invitationToken,
          )
          .catch((e) =>
            this.logger.error('Failed to send invitation email', e as Error),
          );

        return {
          school: await db.queryOne<School>(
            'SELECT * FROM "School" WHERE id = ?',
            [schoolId],
          ),
          invitationToken,
        };
      });
    }

    throw new BadRequestException('Invalid admin type');
  }

  async getSchools() {
    // Get schools with their principals/deputies — single query for members
    // across all schools, then group in memory.
    const schools = await this.db.query<School>(
      'SELECT * FROM "School" WHERE deletedAt IS NULL',
    );
    if (schools.length === 0) return [];

    const schoolIds = schools.map((s) => s.id);
    const placeholders = schoolIds.map(() => '?').join(',');

    const members = await this.db.query<any>(
      `SELECT m.*, u.email, u.firstName, u.lastName
       FROM "SchoolMembership" m
       JOIN "User" u ON m.userId = u.id
       WHERE m.schoolId IN (${placeholders}) AND m.role IN (?, ?)`,
      [...schoolIds, UserRole.PRINCIPAL, UserRole.DEPUTY],
    );

    const membersBySchool = new Map<string, any[]>();
    for (const m of members) {
      const arr = membersBySchool.get(m.schoolId) ?? [];
      arr.push({
        ...m,
        user: {
          id: m.userId,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
        },
      });
      membersBySchool.set(m.schoolId, arr);
    }

    return schools.map((school) => ({
      ...school,
      members: membersBySchool.get(school.id) ?? [],
    }));
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [
      schoolCountResult,
      userCountResult,
      activeMemberCountResult,
      recentLogins,
      aiUsage,
      backups,
    ] = await Promise.all([
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "School" WHERE deletedAt IS NULL',
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "User" WHERE deletedAt IS NULL',
      ),
      this.db.queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM "SchoolMembership" WHERE status = ?',
        [UserStatus.ACTIVE],
      ),
      this.db.query<
        AuditLog & { email: string; firstName: string; lastName: string }
      >(
        `SELECT a.*, u.email, u.firstName, u.lastName 
         FROM "AuditLog" a 
         JOIN "User" u ON a.actorId = u.id 
         WHERE a.action = 'LOGIN_SUCCESS' 
         ORDER BY a.createdAt DESC LIMIT 10`,
      ),
      this.aiService.getAiUsage(),
      this.backupService.listBackups(),
    ]);

    const mem = process.memoryUsage();

    return {
      schoolCount: schoolCountResult?.count || 0,
      userCount: userCountResult?.count || 0,
      activeUserCount: activeMemberCountResult?.count || 0,
      recentLogins: recentLogins.map((l) => ({
        ...l,
        actor: {
          id: l.actorId,
          email: l.email,
          firstName: l.firstName,
          lastName: l.lastName,
        },
      })),
      aiUsage,
      backups: {
        total: backups.length,
        lastBackup: backups.length > 0 ? backups[0].createdAt : null,
      },
      system: {
        uptime: Math.floor(process.uptime()),
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        },
        os: {
          platform: os.platform(),
          release: os.release(),
          cpuCount: os.cpus().length,
          totalMemory: Math.round(os.totalmem() / 1024 / 1024),
          freeMemory: Math.round(os.freemem() / 1024 / 1024),
        },
      },
    };
  }

  async updateSchool(
    schoolId: string,
    data: {
      name?: string;
      address?: string;
      requireSsoEmailMatch?: boolean;
      admin?:
        | { type: 'EXISTING'; userId: string }
        | { type: 'NEW'; firstName: string; lastName: string; email: string };
    },
    actorId: string,
  ) {
    const school = await this.db.queryOne<School>(
      'SELECT * FROM "School" WHERE id = ?',
      [schoolId],
    );
    if (!school) throw new NotFoundException('School not found');

    const primaryAdminRow = await this.db.queryOne<{ email: string }>(
      `SELECT u.email FROM "User" u 
       JOIN "SchoolMembership" m ON u.id = m.userId 
       WHERE m.schoolId = ? AND m.role = ? LIMIT 1`,
      [schoolId, UserRole.ADMIN],
    );

    const oldValues = {
      name: school.name,
      address: school.address,
      requireSsoEmailMatch: school.requireSsoEmailMatch,
      primaryAdmin: primaryAdminRow?.email || null,
    };

    const newValues: any = {};
    if (data.name !== undefined && data.name !== school.name)
      newValues.name = data.name;
    if (data.address !== undefined && data.address !== school.address)
      newValues.address = data.address;
    if (
      data.requireSsoEmailMatch !== undefined &&
      data.requireSsoEmailMatch !== school.requireSsoEmailMatch
    )
      newValues.requireSsoEmailMatch = data.requireSsoEmailMatch;

    return this.db.transaction(async (db) => {
      if (Object.keys(newValues).length > 0) {
        const sets = Object.keys(newValues)
          .map((k) => `"${k}" = ?`)
          .join(', ');
        await db.execute(
          `UPDATE "School" SET ${sets}, updatedAt = ? WHERE id = ?`,
          [...Object.values(newValues), new Date().toISOString(), schoolId],
        );
      }

      if (data.admin) {
        let adminUser;
        if (data.admin.type === 'EXISTING') {
          adminUser = await db.queryOne<User>(
            'SELECT * FROM "User" WHERE id = ?',
            [data.admin.userId],
          );
          if (!adminUser) throw new NotFoundException('Admin user not found');
        } else {
          const existing = await db.queryOne<User>(
            'SELECT * FROM "User" WHERE email = ?',
            [data.admin.email],
          );
          if (existing) {
            adminUser = existing;
          } else {
            const invitationToken = crypto.randomBytes(32).toString('hex');
            const invitationExpires = new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000,
            );
            const userId = crypto.randomUUID();
            await db.execute(
              'INSERT INTO "User" (id, email, firstName, lastName, invitationToken, invitationExpires, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                userId,
                data.admin.email,
                data.admin.firstName,
                data.admin.lastName,
                invitationToken,
                invitationExpires.toISOString(),
                new Date().toISOString(),
              ],
            );
            adminUser = await db.queryOne<User>(
              'SELECT * FROM "User" WHERE id = ?',
              [userId],
            );

            this.mailService
              .sendInvitation(
                adminUser!.email,
                `${adminUser!.firstName} ${adminUser!.lastName}`,
                invitationToken,
              )
              .catch((e) =>
                this.logger.error(
                  'Failed to send invitation email',
                  e as Error,
                ),
              );
          }
        }

        const existingMembership = await db.queryOne(
          'SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
          [adminUser!.id, schoolId],
        );
        if (existingMembership) {
          await db.execute(
            'UPDATE "SchoolMembership" SET role = ?, status = ?, updatedAt = ? WHERE id = ?',
            [
              UserRole.ADMIN,
              adminUser!.passwordHash ? UserStatus.ACTIVE : UserStatus.PENDING,
              new Date().toISOString(),
              existingMembership.id,
            ],
          );
        } else {
          await db.execute(
            'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              adminUser!.id,
              schoolId,
              UserRole.ADMIN,
              adminUser!.passwordHash ? UserStatus.ACTIVE : UserStatus.PENDING,
              new Date().toISOString(),
            ],
          );
        }
        newValues.primaryAdmin = adminUser!.email;
      }

      if (Object.keys(newValues).length > 0) {
        await db.execute(
          'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, oldValues, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            actorId,
            'UPDATE_SCHOOL_INFO',
            'School',
            schoolId,
            JSON.stringify(oldValues),
            JSON.stringify(newValues),
            new Date().toISOString(),
          ],
        );
      }

      return await db.queryOne<School>('SELECT * FROM "School" WHERE id = ?', [
        schoolId,
      ]);
    });
  }

  async updateSchoolSettings(
    schoolId: string,
    aiConfig?: any,
    ssoConfig?: any,
  ) {
    const school = await this.db.queryOne(
      'SELECT id FROM "School" WHERE id = ?',
      [schoolId],
    );
    if (!school) throw new NotFoundException('School not found');

    await this.db.execute(
      'UPDATE "School" SET aiConfig = ?, ssoConfig = ?, updatedAt = ? WHERE id = ?',
      [
        aiConfig ? JSON.stringify(aiConfig) : null,
        ssoConfig ? JSON.stringify(ssoConfig) : null,
        new Date().toISOString(),
        schoolId,
      ],
    );
    return await this.db.queryOne('SELECT * FROM "School" WHERE id = ?', [
      schoolId,
    ]);
  }

  async deleteSchool(schoolId: string) {
    const school = await this.db.queryOne<School>(
      'SELECT id, name FROM "School" WHERE id = ?',
      [schoolId],
    );
    if (!school) throw new NotFoundException('School not found');
    if (school.deletedAt)
      throw new BadRequestException('School is already deleted');

    await this.db.execute('UPDATE "School" SET deletedAt = ? WHERE id = ?', [
      new Date().toISOString(),
      schoolId,
    ]);
    return { message: `Škola '${school.name}' byla úspěšně smazána.` };
  }

  async assignSchoolAdmin(schoolId: string, userId: string, actorId: string) {
    const school = await this.db.queryOne<School>(
      'SELECT * FROM "School" WHERE id = ?',
      [schoolId],
    );
    if (!school) throw new NotFoundException('School not found');

    const user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    await this.db.transaction(async (db) => {
      // Demote current admin
      await db.execute(
        'UPDATE "SchoolMembership" SET role = ?, updatedAt = ? WHERE schoolId = ? AND role = ?',
        [UserRole.TEACHER, new Date().toISOString(), schoolId, UserRole.ADMIN],
      );

      const existing = await db.queryOne(
        'SELECT id FROM "SchoolMembership" WHERE userId = ? AND schoolId = ?',
        [userId, schoolId],
      );
      if (existing) {
        await db.execute(
          'UPDATE "SchoolMembership" SET role = ?, status = ?, updatedAt = ? WHERE id = ?',
          [
            UserRole.ADMIN,
            UserStatus.ACTIVE,
            new Date().toISOString(),
            (existing as any).id,
          ],
        );
      } else {
        await db.execute(
          'INSERT INTO "SchoolMembership" (id, userId, schoolId, role, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            userId,
            schoolId,
            UserRole.ADMIN,
            UserStatus.ACTIVE,
            new Date().toISOString(),
          ],
        );
      }
    });

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        actorId,
        'ASSIGN_SCHOOL_ADMIN',
        'School',
        schoolId,
        JSON.stringify({ userId }),
        new Date().toISOString(),
      ],
    );

    return { success: true };
  }

  async getSystemAdmins() {
    return this.db.query(
      'SELECT id, email, firstName, lastName, lastLogin, createdAt FROM "User" WHERE (isSystemAdmin = 1 OR isSystemAdmin = \'true\') AND deletedAt IS NULL ORDER BY lastName ASC',
    );
  }

  async promoteToSysAdmin(
    actorId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ) {
    let user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE email = ?',
      [email],
    );

    if (user && user.isSystemAdmin) {
      throw new BadRequestException('User is already a system admin.');
    }

    if (!user) {
      if (!firstName || !lastName)
        throw new BadRequestException(
          'firstName and lastName are required for new users.',
        );
      const id = crypto.randomUUID();
      await this.db.execute(
        'INSERT INTO "User" (id, email, firstName, lastName, isSystemAdmin, createdAt) VALUES (?, ?, ?, ?, 1, ?)',
        [id, email, firstName, lastName, new Date().toISOString()],
      );
      user = await this.db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
        id,
      ]);
    } else {
      await this.db.execute(
        'UPDATE "User" SET isSystemAdmin = 1 WHERE id = ?',
        [user.id],
      );
      user.isSystemAdmin = true;
    }

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        actorId,
        'PROMOTE_SYS_ADMIN',
        'User',
        user!.id,
        JSON.stringify({ email: user!.email, isSystemAdmin: true }),
        new Date().toISOString(),
      ],
    );

    return {
      id: user!.id,
      email: user!.email,
      firstName: user!.firstName,
      lastName: user!.lastName,
    };
  }

  async removeSystemAdmin(actorId: string, targetUserId: string) {
    if (actorId === targetUserId)
      throw new BadRequestException('Cannot remove yourself.');
    const target = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE id = ?',
      [targetUserId],
    );
    if (!target) throw new NotFoundException('User not found.');
    if (target.deletedAt)
      throw new BadRequestException('User is already removed.');

    await this.db.execute('UPDATE "User" SET deletedAt = ? WHERE id = ?', [
      new Date().toISOString(),
      targetUserId,
    ]);

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        actorId,
        'REMOVE_SYS_ADMIN',
        'User',
        targetUserId,
        JSON.stringify({ email: target.email, deletedAt: true }),
        new Date().toISOString(),
      ],
    );

    return { message: `User ${target.email} has been removed.` };
  }
}
