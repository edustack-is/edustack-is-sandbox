import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole, SecretType } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async getSsoOptions() {
        const activeSecrets = await this.prisma.systemSecret.findMany({
            where: {
                type: SecretType.SSO,
                isActive: true,
                key: 'CLIENT_ID' // Just check for existence of basic config
            },
            select: { service: true }
        });

        // Return unique service names in lowercase
        return Array.from(new Set(activeSecrets.map((s: any) => s.service.toLowerCase())));
    }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.prisma.user.findUnique({ where: { email } });
        // Check if user exists AND has a password (SSO users might not have one)
        if (user && user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async createInvitation(userId: string, studentId?: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // If studentId is provided (parent invitation), validate the student exists
        if (studentId) {
            const student = await this.prisma.user.findUnique({ where: { id: studentId } });
            if (!student) throw new NotFoundException('Student not found');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(token, 10);
        const expires = new Date();
        expires.setHours(expires.getHours() + 48);

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                invitationToken: hashedToken,
                invitationExpires: expires,
            },
        });

        // Composite token: userId.rawToken[.studentId]
        const fullToken = studentId
            ? `${userId}.${token}.${studentId}`
            : `${userId}.${token}`;

        return { token: fullToken };
    }

    async acceptInvitation(token: string, password: string) {
        const parts = token.split('.');
        const userId = parts[0];
        const rawToken = parts[1];
        const linkedStudentId = parts[2] || null; // Optional: for parent invitations

        if (!userId || !rawToken) throw new BadRequestException('Invalid token format');

        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.invitationToken || !user.invitationExpires) {
            throw new BadRequestException('Invalid invitation');
        }

        if (new Date() > user.invitationExpires) {
            throw new BadRequestException('Invitation expired');
        }

        const isMatch = await bcrypt.compare(rawToken, user.invitationToken);
        if (!isMatch) throw new BadRequestException('Invalid token');

        // Check student self-registration permission
        const memberships = await this.prisma.schoolMembership.findMany({
            where: { userId: user.id },
            include: { school: true },
        });

        for (const membership of memberships) {
            if (membership.role === 'STUDENT' && !membership.school.allowStudentSelfRegistration) {
                throw new BadRequestException(
                    `School "${membership.school.name}" does not allow student self-registration.`
                );
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        // Update user, activate memberships, and create parent-student link in a transaction
        const updatedUser = await this.prisma.$transaction(async (tx: any) => {
            const updated = await tx.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    invitationToken: null,
                    invitationExpires: null,
                    lastLogin: new Date(),
                },
            });

            // Activate all PENDING memberships for this user
            await tx.schoolMembership.updateMany({
                where: { userId: user.id, status: 'PENDING' },
                data: { status: 'ACTIVE' },
            });

            // Auto-create ParentStudent link for parent invitations
            if (linkedStudentId) {
                const existingLink = await tx.parentStudent.findFirst({
                    where: { parentId: user.id, studentId: linkedStudentId },
                });
                if (!existingLink) {
                    await tx.parentStudent.create({
                        data: {
                            parentId: user.id,
                            studentId: linkedStudentId,
                        },
                    });
                }
            }

            return updated;
        });

        return this.login(updatedUser);
    }

    async login(user: any, ip?: string, userAgent?: string) {
        // Log successful login
        await this.logLoginAttempt(user.email, true, ip, userAgent, user.id);

        const payload = {
            sub: user.id,
            email: user.email,
            isSystemAdmin: user.isSystemAdmin,
            type: 'GLOBAL'
        };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    /**
     * Re-issue a GLOBAL token for the given user (used when frontend
     * lost the saved global_token, e.g. after page refresh in school context).
     */
    async refreshGlobalToken(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const payload = {
            sub: user.id,
            email: user.email,
            isSystemAdmin: user.isSystemAdmin,
            type: 'GLOBAL'
        };
        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async verifyToken(token: string) {
        return this.jwtService.verify(token);
    }

    async getIdentities(userId: string) {
        const identities = await this.prisma.identity.findMany({
            where: { userId },
        });
        return identities.map(id => ({
            provider: id.provider,
            providerId: id.providerId,
            createdAt: id.createdAt
        }));
    }

    async linkIdentity(userId: string, provider: string, providerId: string) {
        // Check if this identity is already linked to someone else
        const existing = await this.prisma.identity.findFirst({
            where: { provider, providerId }
        });

        if (existing) {
            if (existing.userId === userId) return; // Already linked to this user
            throw new BadRequestException('This account is already linked to another user.');
        }

        return this.prisma.identity.create({
            data: {
                userId,
                provider,
                providerId
            }
        });
    }

    async getSchools(userId: string) {
        return this.prisma.schoolMembership.findMany({
            where: { userId, status: 'ACTIVE' },
            include: { school: true },
        });
    }

    async selectSchool(userId: string, schoolId: string, role?: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new UnauthorizedException('User not found');

        // System admins can select any school without membership
        if (user.isSystemAdmin) {
            const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
            if (!school) throw new NotFoundException('School not found');

            // Check if admin actually has a membership in this school
            const membership = await this.prisma.schoolMembership.findFirst({
                where: { userId, schoolId, status: 'ACTIVE' },
            });

            const effectiveRole = role || (membership?.role as string) || 'ADMIN';
            const isSysAdminOverride = !membership; // true if admin enters school without membership

            const payload = {
                sub: userId,
                email: user.email,
                isSystemAdmin: true,
                isSysAdminOverride,
                schoolId: school.id,
                role: effectiveRole,
                type: 'TENANT'
            };

            return {
                access_token: this.jwtService.sign(payload),
            };
        }

        // Regular users need active membership
        const membership = await this.prisma.schoolMembership.findUnique({
            where: { userId_schoolId: { userId, schoolId } },
            include: { user: true }
        });

        if (!membership || membership.status !== 'ACTIVE') {
            throw new UnauthorizedException('User is not an active member of this school.');
        }

        const payload = {
            sub: userId,
            email: membership.user.email,
            schoolId: membership.schoolId,
            role: membership.role,
            type: 'TENANT'
        };

        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async logLoginAttempt(email: string, success: boolean, ip?: string, userAgent?: string, userId?: string) {
        try {
            let actorId = userId;
            if (!actorId) {
                const user = await this.prisma.user.findUnique({ where: { email } });
                actorId = user?.id;
            }

            if (!actorId && !success) {
                console.warn(`Failed login attempt for unknown user: ${email} from ${ip}`);
                return;
            }

            if (actorId) {
                await this.prisma.auditLog.create({
                    data: {
                        action: success ? 'LOGIN' : 'LOGIN_FAILED',
                        actorId: actorId,
                        entity: 'Auth',
                        entityId: email,
                        ipAddress: ip,
                        userAgent: userAgent,
                        newValues: { success },
                    }
                });
            }
        } catch (e) {
            console.error('Failed to log login attempt', e);
        }
    }

    async validateOAuthLogin(email: string, provider: string, providerId: string, firstName?: string, lastName?: string) {
        let user = await this.prisma.user.findUnique({
            where: { email },
            include: { identities: true },
        });

        if (!user) {
            // Check if we should allow auto-registration or just reject
            // For now, following the previous logic: "User not found - you must be invited by the school first."
            // But we might want to auto-create if it's the first admin setup? 
            // Let's stick to the current strict policy unless told otherwise.
            throw new UnauthorizedException('User not found - you must be invited by the school first.');
        }

        // Check if identity exists
        const existingIdentity = user.identities.find(
            (id) => id.provider === provider && id.providerId === providerId,
        );

        if (!existingIdentity) {
            await this.prisma.identity.create({
                data: {
                    provider,
                    providerId,
                    userId: user.id,
                },
            });
        }

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });

        return this.login(user); // Returns Global token
    }

    async impersonate(adminId: string, targetUserId: string) {
        const targetUser = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!targetUser) throw new NotFoundException('Target user not found');

        if (targetUser.isSystemAdmin) {
            throw new UnauthorizedException('Cannot impersonate a System Admin.');
        }

        await this.prisma.auditLog.create({
            data: {
                action: 'IMPERSONATE',
                actorId: adminId,
                entity: 'User',
                entityId: targetUserId,
                newValues: { reason: 'Support' },
            },
        });

        // Impersonation grants a Global Token for the target user
        const payload = {
            sub: targetUser.id,
            email: targetUser.email,
            isSystemAdmin: targetUser.isSystemAdmin,
            type: 'GLOBAL',
            isImpersonated: true,
            actorId: adminId,
        };

        return {
            access_token: this.jwtService.sign(payload),
        };
    }

    async updateProfile(userId: string, data: { avatarUrl?: string }) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: data.avatarUrl },
        });

        const { passwordHash, ...result } = updated;
        return result;
    }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                studentProfile: true,
                teacherProfile: true,
            },
        });

        if (!user) throw new NotFoundException('User not found');

        const { passwordHash, ...result } = user;
        return result;
    }
}
