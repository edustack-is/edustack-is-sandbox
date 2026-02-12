import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.prisma.user.findUnique({ where: { email } });
        // Check if user exists AND has a password (SSO users might not have one)
        if (user && user.passwordHash && (await bcrypt.compare(pass, user.passwordHash))) {
            const { passwordHash, ...result } = user;
            return result;
        }
        return null;
    }

    async createInvitation(userId: string) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = await bcrypt.hash(token, 10);
        const expires = new Date();
        expires.setHours(expires.getHours() + 48);

        await this.prisma.user.update({
            where: { id: userId },
            data: {
                invitationToken: hashedToken,
                invitationExpires: expires,
                // status: 'PENDING', // Removed from User model
            },
        });

        return { token }; // Send this via email
    }

    async acceptInvitation(token: string, password: string) {
        const [userId, rawToken] = token.split('.');
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

        const passwordHash = await bcrypt.hash(password, 10);

        const updatedUser = await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash,
                // status: 'ACTIVE', // Removed from User model
                invitationToken: null,
                invitationExpires: null,
                lastLogin: new Date(),
            },
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

    async getSchools(userId: string) {
        return this.prisma.schoolMembership.findMany({
            where: { userId, status: 'ACTIVE' },
            include: { school: true },
        });
    }

    async selectSchool(userId: string, schoolId: string) {
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
        const user = await this.prisma.user.findUnique({
            where: { email },
            include: { identities: true },
        });

        if (!user) {
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

        // Removed status check/update on User
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
