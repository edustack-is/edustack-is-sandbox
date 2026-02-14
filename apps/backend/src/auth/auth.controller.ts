import { Controller, Post, Body, Param, Get, Query, BadRequestException, Req, Res, UseGuards, Patch, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import passport from 'passport';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Get('sso-options')
    async getSsoOptions() {
        return this.authService.getSsoOptions();
    }

    @Public()
    @Get('sso/:provider')
    async ssoAuth(@Param('provider') provider: string, @Req() req: Request, @Res() res: Response) {
        try {
            passport.authenticate(provider, {
                session: false,
                callbackURL: `/api/auth/callback/${provider}`,
            } as any)(req, res, (err: any) => {
                if (err) {
                    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${encodeURIComponent(err.message || 'sso_failed')}`);
                }
            });
        } catch (err: any) {
            throw new BadRequestException(`SSO provider "${provider}" is not configured or not available.`);
        }
    }

    @Public()
    @Get('callback/:provider')
    async ssoCallback(@Param('provider') provider: string, @Req() req: Request, @Res() res: Response) {
        passport.authenticate(provider, { session: false }, async (err: any, profile: any) => {
            if (err || !profile) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=sso_failed`);
            }

            try {
                const email = profile.emails?.[0]?.value || profile.email;
                if (!email) throw new Error('No email found in SSO profile');

                // Check if user is already logged in (linking scenario)
                // For simplicity, we can check for an auth header or a cookie if implemented.
                // But the user prompt says "triggers the OAuth flow while passing a secure linking state (or reading the existing auth cookie on the callback)"
                // I'll implement a basic linking check by looking at the JWT if present in cookies or header.

                let existingUser = null;
                const authHeader = req.headers.authorization;
                if (authHeader?.startsWith('Bearer ')) {
                    const token = authHeader.split(' ')[1];
                    try {
                        const payload = await this.authService.verifyToken(token);
                        existingUser = await this.authService.getMe(payload.sub);
                    } catch (e) { /* ignore */ }
                }

                if (existingUser) {
                    await this.authService.linkIdentity(existingUser.id, provider, profile.id);
                    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile?linked=success`);
                }

                // Normal Login
                const result = await this.authService.validateOAuthLogin(
                    email,
                    provider,
                    profile.id,
                    profile.name?.givenName || profile.displayName?.split(' ')[0],
                    profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ')
                );

                // Redirect to frontend with token
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?token=${result.access_token}`);
            } catch (err: any) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${encodeURIComponent(err.message)}`);
            }
        })(req, res);
    }

    @Post('invite/:userId')
    async inviteUser(
        @Param('userId') userId: string,
        @Body('studentId') studentId?: string,
    ) {
        return this.authService.createInvitation(userId, studentId);
    }

    @Post('accept-invite')
    async acceptInvite(@Body() body: { token: string; password: string }) {
        return this.authService.acceptInvitation(body.token, body.password);
    }

    @UseGuards(JwtAuthGuard)
    @Get('identities')
    async getIdentities(@Req() req: any) {
        return this.authService.getIdentities(req.user.userId);
    }

    @Post('impersonate/:id')
    async impersonate(@Param('id') targetUserId: string, @Body('adminId') adminId: string) {
        // In real app: Use @UseGuards(RolesGuard), @Roles('ADMIN', 'DIRECTOR')
        // and get adminId from req.user.id
        if (!adminId) throw new BadRequestException('Admin ID required (simulated)');

        // Evaluate if adminId is valid/has rights (mock check)
        // const admin = await this.prisma.user.findUnique(...)

        return this.authService.impersonate(adminId, targetUserId);
    }

    @Public()
    @Post('login')
    async login(@Body() body: Record<string, string>, @Req() req: Request) {
        // Extract IP and User-Agent
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const user = await this.authService.validateUser(body.email, body.password);
        if (!user) {
            // Log failed attempt
            await this.authService.logLoginAttempt(body.email, false, ip as string, userAgent);
            throw new BadRequestException('Invalid credentials');
        }
        return this.authService.login(user, ip as string, userAgent);
    }

    @UseGuards(JwtAuthGuard)
    @Get('schools')
    async getSchools(@Req() req: any) {
        return this.authService.getSchools(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('select-school/:schoolId')
    async selectSchool(
        @Param('schoolId') schoolId: string,
        @Req() req: any,
        @Query('role') role?: string
    ) {
        return this.authService.selectSchool(req.user.userId, schoolId, role);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@Req() req: any) {
        return this.authService.getMe(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    async updateProfile(@Req() req: any, @Body() body: { avatarUrl?: string }) {
        return this.authService.updateProfile(req.user.userId, { avatarUrl: body.avatarUrl });
    }

    @UseGuards(JwtAuthGuard)
    @Post('avatar')
    @UseInterceptors(FileInterceptor('file'))
    async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
        if (!file) throw new BadRequestException('No file uploaded');

        // Validate file type
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Invalid file type. Use JPEG, PNG, WebP, or GIF.');
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            throw new BadRequestException('File too large. Maximum 2MB.');
        }

        // Convert to base64 data URL for simple storage (no external file service needed)
        const base64 = file.buffer.toString('base64');
        const dataUrl = `data:${file.mimetype};base64,${base64}`;

        return this.authService.updateProfile(req.user.userId, { avatarUrl: dataUrl });
    }
}
