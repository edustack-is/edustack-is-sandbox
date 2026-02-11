import { Controller, Post, Body, Param, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
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
}
