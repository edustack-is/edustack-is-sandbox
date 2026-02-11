import { Controller, Post, Body, Param } from '@nestjs/common';
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
}
