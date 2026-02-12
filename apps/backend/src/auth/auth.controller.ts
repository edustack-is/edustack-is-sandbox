import { Controller, Post, Body, Param, Get, Query, BadRequestException, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('invite/:userId')
    async inviteUser(@Param('userId') userId: string) {
        // In real app, check for Admin role here using Guards
        return this.authService.createInvitation(userId);
    }

    @Post('accept-invite')
    async acceptInvite(@Body() body: { token: string; password: string }) {
        return this.authService.acceptInvitation(body.token, body.password);
    }

    @Get('google/callback')
    async googleCallback(@Query('email') email: string, @Query('id') id: string, @Query('firstName') firstName?: string, @Query('lastName') lastName?: string) {
        // In a real app, this endpoint is protected by AuthGuard('google') which validates the token/code 
        // and populates req.user. Here we simulate it with query params for demonstration/testing logic.
        if (!email || !id) throw new Error('Missing email or id');
        return this.authService.validateOAuthLogin(email, 'google', id, firstName, lastName);
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
    @Get('me')
    async getMe(@Req() req: any) {
        return this.authService.getMe(req.user.userId);
    }
}
