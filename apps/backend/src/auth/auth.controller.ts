import { Controller, Post, Body, Param, Get, Query, BadRequestException, ForbiddenException, Req, Res, UseGuards, Patch, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import passport from 'passport';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    /** Parse cookies from the raw Cookie header (no cookie-parser needed) */
    private parseCookies(req: Request): Record<string, string> {
        const header = req.headers.cookie || '';
        return header.split(';').reduce((acc, part) => {
            const [key, ...val] = part.trim().split('=');
            if (key) acc[key] = decodeURIComponent(val.join('='));
            return acc;
        }, {} as Record<string, string>);
    }

    @Public()
    @Get('sso-options')
    async getSsoOptions() {
        return this.authService.getSsoOptions();
    }

    @Public()
    @Get('sso/:provider')
    async ssoAuth(
        @Param('provider') provider: string,
        @Query('invitationToken') invitationToken: string | undefined,
        @Query('token') linkToken: string | undefined,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        try {
            // Store tokens in short-lived httpOnly cookies so they survive the OAuth redirect
            const cookieOpts = { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: 'lax' as const, path: '/' };
            if (invitationToken) {
                res.cookie('__edu_inv_token', invitationToken, cookieOpts);
            }
            if (linkToken) {
                res.cookie('__edu_link_token', linkToken, cookieOpts);
            }

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
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

        passport.authenticate(provider, { session: false }, async (err: any, profile: any) => {
            if (err || !profile) {
                return res.redirect(`${FRONTEND_URL}/login?error=sso_failed`);
            }

            try {
                const email = profile.emails?.[0]?.value || profile.email;
                if (!email) throw new Error('No email found in SSO profile');

                // Read tokens from cookies set before the OAuth redirect (manual parsing)
                const cookies = this.parseCookies(req);
                const invitationToken = cookies['__edu_inv_token'];
                const linkToken = cookies['__edu_link_token'];

                // Always clear the cookies
                res.clearCookie('__edu_inv_token', { path: '/' });
                res.clearCookie('__edu_link_token', { path: '/' });

                // Helper: set token as httpOnly cookie instead of exposing in URL
                const setTokenCookie = (token: string) => {
                    res.cookie('__edu_sso_token', token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: 60 * 1000, // 60 seconds — just enough for the redirect
                        path: '/',
                    });
                };

                // Invitation activation scenario — activate account via SSO
                if (invitationToken) {
                    const result = await this.authService.acceptInvitationViaSso(
                        invitationToken,
                        provider,
                        profile.id,
                        email,
                    );
                    setTokenCookie(result.access_token);
                    return res.redirect(`${FRONTEND_URL}/login?sso=ok`);
                }

                // Identity linking scenario — user already logged in
                if (linkToken) {
                    try {
                        const payload = await this.authService.verifyToken(linkToken);
                        const existingUser = await this.authService.getMe(payload.sub);
                        if (existingUser) {
                            await this.authService.linkIdentity(existingUser.id, provider, profile.id);
                            return res.redirect(`${FRONTEND_URL}/profile?linked=success`);
                        }
                    } catch { /* token invalid, fall through to normal login */ }
                }

                // Normal Login
                const result = await this.authService.validateOAuthLogin(
                    email,
                    provider,
                    profile.id,
                    profile.name?.givenName || profile.displayName?.split(' ')[0],
                    profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ')
                );

                // Set token as httpOnly cookie, redirect without token in URL
                setTokenCookie(result.access_token);
                return res.redirect(`${FRONTEND_URL}/login?sso=ok`);
            } catch (err: any) {
                return res.redirect(`${FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`);
            }
        })(req, res);
    }

    /**
     * POST /api/auth/sso/exchange-token
     * Exchanges the httpOnly __edu_sso_token cookie for a JSON response.
     * This avoids exposing the JWT in the URL during SSO redirects.
     */
    @Public()
    @Post('sso/exchange-token')
    async exchangeSsoToken(@Req() req: Request, @Res() res: Response) {
        const cookies = this.parseCookies(req);
        const token = cookies['__edu_sso_token'];

        // Always clear the cookie
        res.clearCookie('__edu_sso_token', { path: '/' });

        if (!token) {
            return res.status(400).json({ message: 'No SSO token cookie found.' });
        }

        // Verify the token is valid before returning it
        try {
            this.authService.verifyToken(token);
        } catch {
            return res.status(401).json({ message: 'Invalid or expired SSO token.' });
        }

        return res.json({ access_token: token });
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

    @Public()
    @Post('forgot-password')
    async forgotPassword(@Body() body: { email: string }) {
        return this.authService.requestPasswordReset(body.email);
    }

    @Public()
    @Post('reset-password')
    async resetPassword(@Body() body: { token: string; password: string }) {
        return this.authService.resetPassword(body.token, body.password);
    }

    @UseGuards(JwtAuthGuard)
    @Get('identities')
    async getIdentities(@Req() req: any) {
        return this.authService.getIdentities(req.user.userId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('impersonate/:id')
    async impersonate(@Param('id') targetUserId: string, @Req() req: any) {
        const adminId = req.user.userId;

        // Only system admins or school admins/deputies/principals can impersonate
        if (!req.user.isSystemAdmin) {
            // Verify the caller has a management role in at least one school
            // that the target user also belongs to
            const callerMemberships = await this.authService.getCallerManagementSchools(adminId);
            if (callerMemberships.length === 0) {
                throw new ForbiddenException('Only administrators can impersonate users.');
            }

            // Verify target user shares at least one school with the caller
            const targetMemberships = await this.authService.getUserSchoolIds(targetUserId);
            const sharedSchool = callerMemberships.some(
                (schoolId: string) => targetMemberships.includes(schoolId),
            );
            if (!sharedSchool) {
                throw new ForbiddenException('You can only impersonate users within your managed schools.');
            }
        }

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
    @Post('refresh-global')
    async refreshGlobal(@Req() req: any) {
        return this.authService.refreshGlobalToken(req.user.userId);
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
