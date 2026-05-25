import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  User,
  School,
  SchoolMembership,
  Identity,
  SystemSecret,
} from '../database/types';
import { validatePasswordStrength } from '../utils/password-policy';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface LoginHelperMembership {
  schoolName: string;
  role: string;
}

export interface LoginHelperUser {
  email: string;
  firstName: string;
  lastName: string;
  memberships: LoginHelperMembership[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async getSsoOptions(): Promise<string[]> {
    const activeSecrets = await this.db.query<SystemSecret>(
      'SELECT service FROM "SystemSecret" WHERE type = ? AND isActive = 1 AND key = ?',
      ['SSO', 'CLIENT_ID'],
    );

    return Array.from(
      new Set(activeSecrets.map((s) => s.service.toLowerCase())),
    );
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<Partial<User> | null> {
    const user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE email = ?',
      [email],
    );
    if (!user || !user.passwordHash) {
      return null;
    }

    const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      const remainingMs = lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      throw new BadRequestException(`account_locked_until:${remainingMin}`);
    }

    const isPasswordValid = await bcrypt.compare(pass, user.passwordHash);

    if (!isPasswordValid) {
      const newAttempts = user.failedLoginAttempts + 1;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntilDate = new Date();
        lockedUntilDate.setMinutes(
          lockedUntilDate.getMinutes() + LOCKOUT_MINUTES,
        );

        await this.db.execute(
          'UPDATE "User" SET failedLoginAttempts = ?, lockedUntil = ? WHERE id = ?',
          [newAttempts, lockedUntilDate.toISOString(), user.id],
        );
        throw new BadRequestException(
          `account_locked_until:${LOCKOUT_MINUTES}`,
        );
      } else {
        await this.db.execute(
          'UPDATE "User" SET failedLoginAttempts = ? WHERE id = ?',
          [newAttempts, user.id],
        );
      }

      return null;
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.db.execute(
        'UPDATE "User" SET failedLoginAttempts = 0, lockedUntil = NULL WHERE id = ?',
        [user.id],
      );
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async createInvitation(userId: string, studentId?: string) {
    const user = await this.db.queryOne<User>(
      'SELECT id FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    if (studentId) {
      const student = await this.db.queryOne<User>(
        'SELECT id FROM "User" WHERE id = ?',
        [studentId],
      );
      if (!student) throw new NotFoundException('Student not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(token, 12);
    const expires = new Date();
    expires.setHours(expires.getHours() + 48);

    await this.db.execute(
      'UPDATE "User" SET invitationToken = ?, invitationExpires = ? WHERE id = ?',
      [hashedToken, expires.toISOString(), userId],
    );

    const fullToken = studentId
      ? `${userId}.${token}.${studentId}`
      : `${userId}.${token}`;

    return { token: fullToken };
  }

  async acceptInvitation(token: string, password: string) {
    const parts = token.split('.');
    const userId = parts[0];
    const rawToken = parts[1];
    const linkedStudentId = parts[2] || null;

    if (!userId || !rawToken)
      throw new BadRequestException('Invalid token format');

    const user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user || !user.invitationToken || !user.invitationExpires) {
      throw new BadRequestException('Invalid invitation');
    }

    const invitationExpires = new Date(user.invitationExpires);
    if (new Date() > invitationExpires) {
      throw new BadRequestException('Invitation expired');
    }

    const isMatch = await bcrypt.compare(rawToken, user.invitationToken);
    if (!isMatch) throw new BadRequestException('Invalid token');

    const memberships = await this.db.query<
      SchoolMembership & { schoolName: string; allowSelfReg: boolean }
    >(
      `SELECT m.*, s.name as schoolName, s.allowStudentSelfRegistration as allowSelfReg 
       FROM "SchoolMembership" m 
       JOIN "School" s ON m.schoolId = s.id 
       WHERE m.userId = ?`,
      [user.id],
    );

    for (const membership of memberships) {
      if (membership.role === 'STUDENT' && !membership.allowSelfReg) {
        throw new BadRequestException(
          `School "${membership.schoolName}" does not allow student self-registration.`,
        );
      }
    }

    validatePasswordStrength(password);
    const passwordHash = await bcrypt.hash(password, 12);

    const updatedUser = await this.db.transaction(async (db) => {
      await db.execute(
        'UPDATE "User" SET passwordHash = ?, invitationToken = NULL, invitationExpires = NULL, lastLogin = ? WHERE id = ?',
        [passwordHash, new Date().toISOString(), user.id],
      );

      await db.execute(
        "UPDATE \"SchoolMembership\" SET status = 'ACTIVE' WHERE userId = ? AND status = 'PENDING'",
        [user.id],
      );

      if (linkedStudentId) {
        const existingLink = await db.queryOne(
          'SELECT id FROM "ParentStudent" WHERE parentId = ? AND studentId = ?',
          [user.id, linkedStudentId],
        );
        if (!existingLink) {
          await db.execute(
            'INSERT INTO "ParentStudent" (id, parentId, studentId, createdAt) VALUES (?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              user.id,
              linkedStudentId,
              new Date().toISOString(),
            ],
          );
        }
      }

      return await db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
        user.id,
      ]);
    });

    return this.login(updatedUser!);
  }

  async acceptInvitationViaSso(
    token: string,
    provider: string,
    providerId: string,
    ssoEmail: string,
  ) {
    const parts = token.split('.');
    const userId = parts[0];
    const rawToken = parts[1];
    const linkedStudentId = parts[2] || null;

    if (!userId || !rawToken)
      throw new BadRequestException('Invalid token format');

    const user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user || !user.invitationToken || !user.invitationExpires) {
      throw new BadRequestException('Invalid invitation');
    }

    const invitationExpires = new Date(user.invitationExpires);
    if (new Date() > invitationExpires) {
      throw new BadRequestException('Invitation expired');
    }

    const isMatch = await bcrypt.compare(rawToken, user.invitationToken);
    if (!isMatch) throw new BadRequestException('Invalid token');

    const memberships = await this.db.query<
      SchoolMembership & {
        schoolName: string;
        allowSelfReg: boolean;
        requireSsoMatch: boolean;
      }
    >(
      `SELECT m.*, s.name as schoolName, s.allowStudentSelfRegistration as allowSelfReg, s.requireSsoEmailMatch as requireSsoMatch
       FROM "SchoolMembership" m 
       JOIN "School" s ON m.schoolId = s.id 
       WHERE m.userId = ?`,
      [user.id],
    );

    for (const membership of memberships) {
      if (membership.role === 'STUDENT' && !membership.allowSelfReg) {
        throw new BadRequestException(
          `School "${membership.schoolName}" does not allow student self-registration.`,
        );
      }
      if (
        membership.requireSsoMatch &&
        ssoEmail.toLowerCase() !== user.email.toLowerCase()
      ) {
        throw new BadRequestException(
          `School "${membership.schoolName}" requires the SSO email to match your account email (${user.email}).`,
        );
      }
    }

    const updatedUser = await this.db.transaction(async (db) => {
      await db.execute(
        'UPDATE "User" SET invitationToken = NULL, invitationExpires = NULL, lastLogin = ? WHERE id = ?',
        [new Date().toISOString(), user.id],
      );

      await db.execute(
        "UPDATE \"SchoolMembership\" SET status = 'ACTIVE' WHERE userId = ? AND status = 'PENDING'",
        [user.id],
      );

      const existingIdentity = await db.queryOne(
        'SELECT id FROM "Identity" WHERE provider = ? AND providerId = ?',
        [provider, providerId],
      );
      if (!existingIdentity) {
        await db.execute(
          'INSERT INTO "Identity" (id, provider, providerId, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            provider,
            providerId,
            user.id,
            new Date().toISOString(),
          ],
        );
      }

      if (linkedStudentId) {
        const existingLink = await db.queryOne(
          'SELECT id FROM "ParentStudent" WHERE parentId = ? AND studentId = ?',
          [user.id, linkedStudentId],
        );
        if (!existingLink) {
          await db.execute(
            'INSERT INTO "ParentStudent" (id, parentId, studentId, createdAt) VALUES (?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              user.id,
              linkedStudentId,
              new Date().toISOString(),
            ],
          );
        }
      }

      return await db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
        user.id,
      ]);
    });

    return this.login(updatedUser!);
  }

  async login(user: Partial<User>, ip?: string, userAgent?: string) {
    await this.logLoginAttempt(user.email!, true, ip, userAgent, user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      isSystemAdmin: !!user.isSystemAdmin,
      type: 'GLOBAL',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async refreshGlobalToken(userId: string) {
    const user = await this.db.queryOne<User>(
      'SELECT id, email, isSystemAdmin FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const payload = {
      sub: user.id,
      email: user.email,
      isSystemAdmin: !!user.isSystemAdmin,
      type: 'GLOBAL',
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async verifyToken(token: string) {
    return this.jwtService.verify(token);
  }

  async getIdentities(userId: string) {
    return this.db.query<Identity>(
      'SELECT provider, providerId, createdAt FROM "Identity" WHERE userId = ?',
      [userId],
    );
  }

  async linkIdentity(userId: string, provider: string, providerId: string) {
    const existing = await this.db.queryOne<Identity>(
      'SELECT id, userId FROM "Identity" WHERE provider = ? AND providerId = ?',
      [provider, providerId],
    );

    if (existing) {
      if (existing.userId === userId) return;
      throw new BadRequestException(
        'This account is already linked to another user.',
      );
    }

    return this.db.execute(
      'INSERT INTO "Identity" (id, provider, providerId, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        provider,
        providerId,
        userId,
        new Date().toISOString(),
      ],
    );
  }

  async getSchools(userId: string) {
    const raw = await this.db.query(
      `SELECT m.*, s.name as sName, s.address as sAddress
       FROM "SchoolMembership" m
       JOIN "School" s ON m.schoolId = s.id
       WHERE m.userId = ? AND m.status = ?`,
      [userId, 'ACTIVE'],
    );
    return raw.map((r: any) => ({
      ...r,
      id: r.id, // membership ID
      schoolId: r.schoolId,
      role: r.role,
      school: {
        id: r.schoolId,
        name: r.sName,
        address: r.sAddress,
      },
    }));
  }
  async selectSchool(userId: string, schoolId: string, role?: string) {
    const user = await this.db.queryOne<User>(
      'SELECT id, email, isSystemAdmin FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user) throw new UnauthorizedException('User not found');

    if (user.isSystemAdmin) {
      const school = await this.db.queryOne<School>(
        'SELECT id, name FROM "School" WHERE id = ?',
        [schoolId],
      );
      if (!school) throw new NotFoundException('School not found');

      const membership = await this.db.queryOne<{ role: string }>(
        'SELECT role FROM "SchoolMembership" WHERE userId = ? AND schoolId = ? AND status = \'ACTIVE\'',
        [userId, schoolId],
      );

      const isSysAdminOverride = !membership;

      const payload = {
        sub: userId,
        email: user.email,
        isSystemAdmin: true,
        isSysAdminOverride,
        schoolId: school.id,
        role: role || membership?.role || 'ADMIN',
        type: 'TENANT',
      };

      return { access_token: this.jwtService.sign(payload) };
    }

    const membership = await this.db.queryOne<
      SchoolMembership & { email: string }
    >(
      `SELECT m.*, u.email
       FROM "SchoolMembership" m
       JOIN "User" u ON m.userId = u.id
       WHERE m.userId = ? AND m.schoolId = ? AND m.status = ?`,
      [userId, schoolId, 'ACTIVE'],
    );
    if (!membership) {
      throw new UnauthorizedException(
        'User is not an active member of this school.',
      );
    }

    const payload = {
      sub: userId,
      email: membership.email,
      schoolId: membership.schoolId,
      role: membership.role,
      type: 'TENANT',
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  async logLoginAttempt(
    email: string,
    success: boolean,
    ip?: string,
    userAgent?: string,
    userId?: string,
  ) {
    try {
      let actorId = userId;
      if (!actorId) {
        const user = await this.db.queryOne<User>(
          'SELECT id FROM "User" WHERE email = ?',
          [email],
        );
        actorId = user?.id;
      }

      if (!actorId && !success) {
        this.logger.warn(
          `Failed login attempt for unknown user: ${email} from ${ip}`,
        );
        return;
      }

      if (actorId) {
        await this.db.execute(
          'INSERT INTO "AuditLog" (id, action, actorId, entity, entityId, ipAddress, userAgent, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            crypto.randomUUID(),
            success ? 'LOGIN' : 'LOGIN_FAILED',
            actorId,
            'Auth',
            email,
            ip || null,
            userAgent || null,
            JSON.stringify({ success }),
            new Date().toISOString(),
          ],
        );
      }
    } catch (e) {
      this.logger.error('Failed to log login attempt', e as Error);
    }
  }

  async validateOAuthLogin(
    email: string,
    provider: string,
    providerId: string,
  ) {
    // Match by linked SSO identity first — the user may have linked this
    // provider while logged in under a different email (e.g. their Google
    // address differs from the school-issued mailbox). Falling back to email
    // covers the legacy case where a user was created with an email matching
    // their SSO provider but never explicitly linked it.
    const identity = await this.db.queryOne<{ userId: string }>(
      'SELECT userId FROM "Identity" WHERE provider = ? AND providerId = ?',
      [provider, providerId],
    );

    let user: User | null = null;
    if (identity) {
      user = await this.db.queryOne<User>('SELECT * FROM "User" WHERE id = ?', [
        identity.userId,
      ]);
    }

    if (!user) {
      user = await this.db.queryOne<User>(
        'SELECT * FROM "User" WHERE email = ?',
        [email],
      );
    }

    if (!user) {
      throw new UnauthorizedException(
        'User not found - you must be invited by the school first.',
      );
    }

    const existingIdentity = await this.db.queryOne(
      'SELECT id FROM "Identity" WHERE provider = ? AND providerId = ? AND userId = ?',
      [provider, providerId, user.id],
    );

    if (!existingIdentity) {
      await this.db.execute(
        'INSERT INTO "Identity" (id, provider, providerId, userId, createdAt) VALUES (?, ?, ?, ?, ?)',
        [
          crypto.randomUUID(),
          provider,
          providerId,
          user.id,
          new Date().toISOString(),
        ],
      );
    }

    await this.db.execute('UPDATE "User" SET lastLogin = ? WHERE id = ?', [
      new Date().toISOString(),
      user.id,
    ]);

    return this.login(user);
  }

  async impersonate(adminId: string, targetUserId: string) {
    const targetUser = await this.db.queryOne<User>(
      'SELECT id, email, isSystemAdmin FROM "User" WHERE id = ?',
      [targetUserId],
    );
    if (!targetUser) throw new NotFoundException('Target user not found');
    if (targetUser.isSystemAdmin)
      throw new UnauthorizedException('Cannot impersonate a System Admin.');

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, action, actorId, entity, entityId, newValues, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        crypto.randomUUID(),
        'IMPERSONATE',
        adminId,
        'User',
        targetUserId,
        JSON.stringify({ reason: 'Support' }),
        new Date().toISOString(),
      ],
    );

    const payload = {
      sub: targetUser.id,
      email: targetUser.email,
      isSystemAdmin: !!targetUser.isSystemAdmin,
      type: 'GLOBAL',
      isImpersonated: true,
      actorId: adminId,
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  /**
   * End an impersonation session: mints a fresh GLOBAL token for the
   * impersonator (stored as `actorId` on the impersonation JWT).
   */
  async leaveImpersonation(currentUser: any) {
    if (!currentUser?.isImpersonated || !currentUser?.actorId) {
      throw new BadRequestException(
        'Current session is not an impersonation session.',
      );
    }
    const admin = await this.db.queryOne<User>(
      'SELECT id, email, isSystemAdmin FROM "User" WHERE id = ?',
      [currentUser.actorId],
    );
    if (!admin) {
      throw new UnauthorizedException('Impersonator no longer exists.');
    }
    const payload = {
      sub: admin.id,
      email: admin.email,
      isSystemAdmin: !!admin.isSystemAdmin,
      type: 'GLOBAL',
    };
    return { access_token: this.jwtService.sign(payload) };
  }

  async updateProfile(userId: string, data: { avatarUrl?: string }) {
    const user = await this.db.queryOne<User>(
      'SELECT id FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    await this.db.execute('UPDATE "User" SET avatarUrl = ? WHERE id = ?', [
      data.avatarUrl || null,
      userId,
    ]);
    return await this.db.queryOne<User>(
      'SELECT id, email, firstName, lastName, avatarUrl FROM "User" WHERE id = ?',
      [userId],
    );
  }

  async changePassword(
    userId: string,
    oldPass: string,
    newPass: string,
  ): Promise<{ message: string }> {
    const user = await this.db.queryOne<User>(
      'SELECT id, passwordHash FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user || !user.passwordHash) {
      throw new NotFoundException('User not found or has no password set.');
    }

    const isMatch = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('invalid_current_password');
    }

    validatePasswordStrength(newPass);
    const newHash = await bcrypt.hash(newPass, 12);

    await this.db.execute('UPDATE "User" SET passwordHash = ? WHERE id = ?', [
      newHash,
      userId,
    ]);

    return { message: 'password_changed_success' };
  }

  async getMe(userId: string) {
    const user = await this.db.queryOne<User>(
      'SELECT * FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const studentProfile = await this.db.queryOne(
      `SELECT sp.*, c.name as classroomName, c.grade as classroomGrade 
       FROM "StudentProfile" sp 
       LEFT JOIN "Classroom" c ON sp.classroomId = c.id 
       WHERE sp.userId = ?`,
      [userId],
    );

    const teacherProfile = await this.db.queryOne(
      `SELECT tp.*, c.name as homeroomClassName 
       FROM "TeacherProfile" tp 
       LEFT JOIN "Classroom" c ON tp.homeroomClassId = c.id 
       WHERE tp.userId = ?`,
      [userId],
    );

    const { passwordHash, ...result } = user;
    return {
      ...result,
      studentProfile,
      teacherProfile,
    };
  }

  async getCallerManagementSchools(userId: string): Promise<string[]> {
    const memberships = await this.db.query<{ schoolId: string }>(
      "SELECT schoolId FROM \"SchoolMembership\" WHERE userId = ? AND role IN ('ADMIN', 'DEPUTY', 'PRINCIPAL') AND status = 'ACTIVE'",
      [userId],
    );
    return memberships.map((m: any) => m.schoolId);
  }

  async getUserSchoolIds(userId: string): Promise<string[]> {
    const memberships = await this.db.query<{ schoolId: string }>(
      'SELECT schoolId FROM "SchoolMembership" WHERE userId = ?',
      [userId],
    );
    return memberships.map((m) => m.schoolId);
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail) return { message: 'ok' };

    const user = await this.db.queryOne<User>(
      'SELECT id, email, firstName, lastName FROM "User" WHERE LOWER(email) = ?',
      [normalizedEmail],
    );
    if (!user) {
      this.logger.warn(
        `Password reset requested for unknown email: ${normalizedEmail}`,
      );
      return { message: 'ok' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(token, 12);
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await this.db.execute(
      'UPDATE "User" SET passwordResetToken = ?, passwordResetExpires = ? WHERE id = ?',
      [hashedToken, expires.toISOString(), user.id],
    );

    const fullToken = `${user.id}.${token}`;
    const displayName = `${user.firstName} ${user.lastName}`;

    try {
      await this.mailService.sendPasswordReset(
        user.email,
        displayName,
        fullToken,
      );
    } catch (e) {
      this.logger.error('Failed to send password reset email', e as Error);
    }

    return { message: 'ok' };
  }

  async resetPassword(token: string, newPassword: string) {
    const parts = token.split('.');
    const userId = parts[0];
    const rawToken = parts[1];

    if (!userId || !rawToken)
      throw new BadRequestException('Invalid token format');

    const user = await this.db.queryOne<User>(
      'SELECT id, passwordResetToken, passwordResetExpires FROM "User" WHERE id = ?',
      [userId],
    );
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordResetExpires = new Date(user.passwordResetExpires);
    if (new Date() > passwordResetExpires)
      throw new BadRequestException('Reset link has expired');

    const isMatch = await bcrypt.compare(rawToken, user.passwordResetToken);
    if (!isMatch) throw new BadRequestException('Invalid reset link');

    validatePasswordStrength(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.db.execute(
      'UPDATE "User" SET passwordHash = ?, passwordResetToken = NULL, passwordResetExpires = NULL, failedLoginAttempts = 0, lockedUntil = NULL WHERE id = ?',
      [passwordHash, userId],
    );

    return { message: 'Password has been reset successfully' };
  }

  getLoginHelperConfig() {
    return {
      enabled: process.env.ENABLE_LOGIN_HELPER === 'true',
      defaultPassword: process.env.DEMO_PASSWORD || 'Demo1234!',
      // Adminer (SQLite DB viewer) link + its gate password, surfaced in the
      // login-helper card. Only meaningful in the demo/sandbox builds where the
      // login helper itself is enabled, so it lives behind the same flag.
      adminerUrl: process.env.ADMINER_PUBLIC_URL || '',
      adminerPassword: process.env.ADMINER_PASSWORD || '',
    };
  }

  async getLoginHelperUsers(): Promise<LoginHelperUser[]> {
    if (process.env.ENABLE_LOGIN_HELPER !== 'true') return [];

    const allowedRoles = (
      process.env.LOGIN_HELPER_ROLES ||
      'SYSTEM_ADMIN,ADMIN,TEACHER,DEPUTY,PRINCIPAL,STUDENT,PARENT'
    )
      .split(',')
      .map((r) => r.trim().toUpperCase());

    // 1. Get system admins
    const sysAdmins = await this.db.query<User>(
      'SELECT email, firstName, lastName FROM "User" WHERE isSystemAdmin = 1 AND deletedAt IS NULL LIMIT 5',
    );

    const helperUsers: LoginHelperUser[] = [];
    const seenEmails = new Set<string>();

    for (const user of sysAdmins) {
      helperUsers.push({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        memberships: [{ schoolName: 'System', role: 'SYSTEM_ADMIN' }],
      });
      seenEmails.add(user.email);
    }

    // 2. Get representatives from all schools
    // We want a good mix of roles per school to demonstrate functionality.
    const representatives = await this.db.query<any>(
      `SELECT u.email, u.firstName, u.lastName, m.role, s.name as schoolName
       FROM "SchoolMembership" m
       JOIN "User" u ON m.userId = u.id
       JOIN "School" s ON m.schoolId = s.id
       WHERE m.status = 'ACTIVE' 
       AND u.deletedAt IS NULL 
       AND s.deletedAt IS NULL
       AND m.role IN ('PRINCIPAL', 'DEPUTY', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT')
       ORDER BY s.name ASC, 
                CASE m.role 
                  WHEN 'PRINCIPAL' THEN 1 
                  WHEN 'DEPUTY' THEN 2 
                  WHEN 'ADMIN' THEN 3 
                  WHEN 'TEACHER' THEN 4
                  WHEN 'STUDENT' THEN 5
                  WHEN 'PARENT' THEN 6
                  ELSE 7
                END ASC`,
    );

    // Group by school AND role to ensure each school has a variety of roles
    const schoolRoleGroups = new Map<string, Map<string, any[]>>();
    for (const rep of representatives) {
      if (!schoolRoleGroups.has(rep.schoolName)) {
        schoolRoleGroups.set(rep.schoolName, new Map());
      }
      const roleMap = schoolRoleGroups.get(rep.schoolName)!;
      if (!roleMap.has(rep.role)) {
        roleMap.set(rep.role, []);
      }
      // Add up to 2 people per role per school
      if (roleMap.get(rep.role)!.length < 2) {
        roleMap.get(rep.role)!.push(rep);
      }
    }

    for (const roleMap of schoolRoleGroups.values()) {
      for (const reps of roleMap.values()) {
        for (const rep of reps) {
          if (seenEmails.has(rep.email)) continue;
          helperUsers.push({
            email: rep.email,
            firstName: rep.firstName,
            lastName: rep.lastName,
            memberships: [{ schoolName: rep.schoolName, role: rep.role }],
          });
          seenEmails.add(rep.email);
        }
      }
    }

    // Sort result: system admin first, then by school name
    return helperUsers.sort((a, b) => {
      if (a.memberships[0].role === 'SYSTEM_ADMIN') return -1;
      if (b.memberships[0].role === 'SYSTEM_ADMIN') return 1;
      return a.memberships[0].schoolName.localeCompare(
        b.memberships[0].schoolName,
      );
    });
  }
}
