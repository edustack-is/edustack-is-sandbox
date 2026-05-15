import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  BadRequestException,
  ForbiddenException,
  Req,
  Res,
  UseGuards,
  Patch,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { parse as parseCookieHeader } from 'cookie';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { UserRole } from '../database/types';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import passport from 'passport';
import {
  AcceptInviteDto,
  ForgotPasswordDto,
  InviteUserBodyDto,
  LoginDto,
  LoginResponseDto,
  ResetPasswordDto,
  SchoolListItemDto,
  SelectSchoolResponseDto,
  SsoOptionDto,
  UpdateProfileDto,
  UserProfileDto,
  SuccessResponseDto,
  LoginHelperConfigDto,
  LoginHelperUserDto,
  ChangePasswordDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  SsoIdentityResponseDto,
  UploadResultDto,
} from '../common/dto/response.dto';
@ApiTags('auth')
@Controller('api/auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Parse cookies from the raw Cookie header using the `cookie` package. */
  private parseCookies(req: Request): Record<string, string> {
    try {
      return parseCookieHeader(req.headers.cookie || '');
    } catch {
      // Malformed cookie header — treat as empty rather than 500-ing.
      return {};
    }
  }

  @Public()
  @Get('sso-options')
  @ApiOperation({ summary: 'Dostupní SSO poskytovatelé' })
  @ApiResponse({
    status: 302,
    description: 'Přesměrování na SSO poskytovatele.',
  })
  @ApiResponse({ status: 200, type: SsoOptionDto, isArray: true })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getSsoOptions() {
    return this.authService.getSsoOptions();
  }

  @Public()
  @Get('login-helper-config')
  @ApiOperation({ summary: 'Konfigurace login helperu' })
  @ApiResponse({ status: 200, type: LoginHelperConfigDto })
  getLoginHelperConfig() {
    return this.authService.getLoginHelperConfig();
  }

  @Public()
  @Get('login-helper-users')
  @ApiOperation({ summary: 'Seznam demo uživatelů pro login helper' })
  @ApiResponse({ status: 200, type: LoginHelperUserDto, isArray: true })
  async getLoginHelperUsers() {
    return this.authService.getLoginHelperUsers();
  }

  @Public()
  @Get('sso/:provider')
  ssoAuth(
    @Param('provider') provider: string,
    @Query('invitationToken') invitationToken: string | undefined,
    @Query('token') linkToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      // Store tokens in short-lived httpOnly cookies so they survive the OAuth redirect
      const cookieOpts = {
        httpOnly: true,
        maxAge: 5 * 60 * 1000,
        sameSite: 'lax' as const,
        path: '/',
      };
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
          res.redirect(
            `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=${encodeURIComponent(err.message || 'sso_failed')}`,
          );
        }
      });
    } catch (err: any) {
      throw new BadRequestException(
        `SSO provider "${provider}" is not configured or not available.`,
      );
    }
  }

  @Public()
  @Get('callback/:provider')
  @ApiOperation({ summary: 'Callback z SSO poskytovatele' })
  @ApiResponse({ status: 302, description: 'Přesměrování s SSO tokenem.' })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  ssoCallback(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    passport.authenticate(
      provider,
      { session: false },
      async (err: any, profile: any) => {
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
                await this.authService.linkIdentity(
                  existingUser.id,
                  provider,
                  profile.id,
                );
                return res.redirect(`${FRONTEND_URL}/profile?linked=success`);
              }
            } catch {
              /* token invalid, fall through to normal login */
            }
          }

          // Normal Login
          const result = await this.authService.validateOAuthLogin(
            email,
            provider,
            profile.id,
          );
          // Set token as httpOnly cookie, redirect without token in URL
          setTokenCookie(result.access_token);
          return res.redirect(`${FRONTEND_URL}/login?sso=ok`);
        } catch (err: any) {
          return res.redirect(
            `${FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`,
          );
        }
      },
    )(req, res);
  }

  /**
   * POST /api/auth/sso/exchange-token
   * Exchanges the httpOnly __edu_sso_token cookie for a JSON response.
   * This avoids exposing the JWT in the URL during SSO redirects.
   */
  @Public()
  @Post('sso/exchange-token')
  @ApiOperation({ summary: 'Výměna SSO cookie za JWT' })
  @ApiResponse({
    status: 200,
    description: 'JWT token po SSO přihlášení.',
    type: LoginResponseDto,
  })
  exchangeSsoToken(@Req() req: Request, @Res() res: Response) {
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
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Odeslání pozvánky uživateli' })
  @ApiBody({ type: InviteUserBodyDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async inviteUser(
    @Param('userId') userId: string,
    @Body('studentId') studentId?: string,
  ) {
    return this.authService.createInvitation(userId, studentId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('accept-invite')
  @ApiOperation({ summary: 'Přijetí pozvánky a nastavení hesla' })
  @ApiResponse({
    status: 200,
    description: 'Účet aktivován.',
    type: SuccessResponseDto,
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiBody({ type: AcceptInviteDto })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async acceptInvite(@Body() body: { token: string; password: string }) {
    return this.authService.acceptInvitation(body.token, body.password);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Žádost o reset hesla' })
  @ApiResponse({
    status: 200,
    description: 'E-mail s odkazem odeslán.',
    type: SuccessResponseDto,
  })
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Get('identities')
  @ApiOperation({ summary: 'Propojené SSO identity uživatele' })
  @ApiResponse({
    status: 200,
    description: 'Seznam propojených SSO identit.',
    type: SsoIdentityResponseDto,
    isArray: true,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getIdentities(@Req() req: any) {
    return this.authService.getIdentities(req.user.userId);
  }

  @Post('impersonate/:id')
  @ApiOperation({ summary: 'Impersonace jiného uživatele (admin)' })
  @ApiResponse({
    status: 200,
    description: 'JWT token impersonovaného uživatele.',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async impersonate(@Param('id') targetUserId: string, @Req() req: any) {
    const adminId = req.user.userId;

    // Only system admins or school admins/deputies/principals can impersonate
    if (!req.user.isSystemAdmin) {
      // Verify the caller has a management role in at least one school
      // that the target user also belongs to
      const callerMemberships =
        await this.authService.getCallerManagementSchools(adminId);
      if (callerMemberships.length === 0) {
        throw new ForbiddenException(
          'Only administrators can impersonate users.',
        );
      }

      // Verify target user shares at least one school with the caller
      const targetMemberships =
        await this.authService.getUserSchoolIds(targetUserId);
      const sharedSchool = callerMemberships.some((schoolId: string) =>
        targetMemberships.includes(schoolId),
      );
      if (!sharedSchool) {
        throw new ForbiddenException(
          'You can only impersonate users within your managed schools.',
        );
      }
    }

    return this.authService.impersonate(adminId, targetUserId);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Přihlášení e-mailem a heslem' })
  @ApiResponse({
    status: 200,
    description: 'Přihlášení úspěšné.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiBody({ type: LoginDto })
  async login(@Body() body: LoginDto, @Req() req: Request) {
    // Extract IP and User-Agent
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      // Log failed attempt
      await this.authService.logLoginAttempt(
        body.email,
        false,
        ip as string,
        userAgent,
      );
      throw new BadRequestException('Invalid credentials');
    }
    return this.authService.login(user, ip as string, userAgent);
  }

  @Get('schools')
  @ApiOperation({ summary: 'Seznam škol uživatele' })
  @ApiResponse({ status: 200, type: SchoolListItemDto, isArray: true })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async getSchools(@Req() req: any) {
    return this.authService.getSchools(req.user.userId);
  }

  @Post('select-school/:schoolId')
  @ApiOperation({ summary: 'Výběr školy a role' })
  @ApiResponse({ status: 200, type: SelectSchoolResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async selectSchool(
    @Param('schoolId') schoolId: string,
    @Req() req: any,
    @Query('role') role?: string,
  ) {
    return this.authService.selectSchool(req.user.userId, schoolId, role);
  }

  @Post('refresh-global')
  @ApiOperation({ summary: 'Obnovení globálního JWT tokenu' })
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async refreshGlobal(@Req() req: any) {
    return this.authService.refreshGlobalToken(req.user.userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Profil přihlášeného uživatele' })
  @ApiResponse({ status: 200, type: UserProfileDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Aktualizace profilu' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaný profil.',
    type: UserProfileDto,
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async updateProfile(@Req() req: any, @Body() body: { avatarUrl?: string }) {
    return this.authService.updateProfile(req.user.userId, {
      avatarUrl: body.avatarUrl,
    });
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Změna hesla' })
  @ApiResponse({
    status: 200,
    description: 'Heslo bylo změněno.',
    type: SuccessResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatné stávající heslo nebo slabé nové heslo.',
    type: ErrorResponseDto,
  })
  async changePassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.userId,
      body.oldPassword,
      body.newPassword,
    );
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Nahrání avataru' })
  @ApiResponse({
    status: 200,
    description: 'URL nahraného avataru.',
    type: UploadResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
    type: ErrorResponseDto,
  })
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No file uploaded');

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Use JPEG, PNG, WebP, or GIF.',
      );
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large. Maximum 2MB.');
    }

    // Convert to base64 data URL for simple storage (no external file service needed)
    const base64 = file.buffer.toString('base64');
    const dataUrl = `data:${file.mimetype};base64,${base64}`;

    return this.authService.updateProfile(req.user.userId, {
      avatarUrl: dataUrl,
    });
  }
}
