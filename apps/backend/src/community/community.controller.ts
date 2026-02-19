import {
    Controller, Get, Post, Put, Delete, Body, Param,
    UseGuards, Req, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { CommunityService } from './community.service';

@Controller('api/community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
    constructor(private readonly communityService: CommunityService) { }

    private ensureTenant(req: any) {
        if (!req.user?.schoolId) throw new ForbiddenException('School context required.');
    }

    // ─── BULLETIN BOARD ─────────────────────────────────────

    @Post('bulletin')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async createBulletinPost(@Req() req: any, @Body() body: { title: string; content: string; pinned?: boolean }) {
        this.ensureTenant(req);
        return this.communityService.createBulletinPost(req.user.userId, req.user.schoolId, body);
    }

    @Get('bulletin')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    async getBulletinPosts(@Req() req: any) {
        this.ensureTenant(req);
        return this.communityService.getBulletinPosts(req.user.schoolId);
    }

    @Put('bulletin/:id')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async updateBulletinPost(@Req() req: any, @Param('id') id: string, @Body() body: { title?: string; content?: string; pinned?: boolean }) {
        this.ensureTenant(req);
        return this.communityService.updateBulletinPost(req.user.userId, req.user.schoolId, id, body);
    }

    @Delete('bulletin/:id')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async deleteBulletinPost(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.communityService.deleteBulletinPost(req.user.schoolId, id);
    }

    // ─── POLLS ──────────────────────────────────────────────

    @Post('polls')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async createPoll(@Req() req: any, @Body() body: { question: string; options: string[]; multiSelect?: boolean; endsAt?: string }) {
        this.ensureTenant(req);
        return this.communityService.createPoll(req.user.userId, req.user.schoolId, body);
    }

    @Get('polls')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    async getPolls(@Req() req: any) {
        this.ensureTenant(req);
        return this.communityService.getPolls(req.user.schoolId);
    }

    @Post('polls/:optionId/vote')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    async vote(@Req() req: any, @Param('optionId') optionId: string) {
        return this.communityService.vote(req.user.userId, optionId);
    }

    @Delete('polls/:id')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async deletePoll(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.communityService.deletePoll(req.user.schoolId, id);
    }

    // ─── CALENDAR EVENTS ────────────────────────────────────

    @Post('events')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async createCalendarEvent(@Req() req: any, @Body() body: { title: string; description?: string; startDate: string; endDate?: string; location?: string }) {
        this.ensureTenant(req);
        return this.communityService.createCalendarEvent(req.user.userId, req.user.schoolId, body);
    }

    @Get('events')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    async getCalendarEvents(@Req() req: any) {
        this.ensureTenant(req);
        return this.communityService.getCalendarEvents(req.user.schoolId);
    }

    @Post('events/:id/rsvp')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    async rsvpEvent(@Req() req: any, @Param('id') id: string, @Body() body: { status: 'YES' | 'NO' | 'MAYBE' }) {
        return this.communityService.rsvpEvent(req.user.userId, id, body.status);
    }

    @Delete('events/:id')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    async deleteCalendarEvent(@Req() req: any, @Param('id') id: string) {
        this.ensureTenant(req);
        return this.communityService.deleteCalendarEvent(req.user.schoolId, id);
    }
}
