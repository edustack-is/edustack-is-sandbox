import {
    Controller, Get, Post, Put, Body, Param, Query,
    Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth , ApiOperation , ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { MessagingService } from './messaging.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('messaging')
@ApiBearerAuth('JWT-auth')
@Controller('api/messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
    constructor(
        private messagingService: MessagingService,
        private notificationService: NotificationService,
        private prisma: PrismaService,
    ) { }

    private ensureTenant(req: any) {
        if (!req.user?.schoolId) throw new ForbiddenException('School context required.');
    }

    // ─── CONVERSATIONS ──────────────────────────────────────

    @Get('conversations')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Seznam konverzací' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getConversations(@Req() req: any) {
        this.ensureTenant(req);
        return this.messagingService.getConversations(req.user.userId, req.user.schoolId);
    }

    @Get('conversations/:id/messages')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Zprávy v konverzaci' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getMessages(
        @Req() req: any,
        @Param('id') id: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.messagingService.getMessages(
            id,
            req.user.userId,
            limit ? parseInt(limit) : 50,
            offset ? parseInt(offset) : 0,
        );
    }

    @Post('conversations/:id/messages')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Odeslání zprávy' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async sendMessage(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: { content: string },
    ) {
        return this.messagingService.sendMessage(id, req.user.userId, body.content);
    }

    @Post('conversations')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Vytvoření konverzace' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createConversation(
        @Req() req: any,
        @Body() body: {
            recipientIds: string[];
            subject?: string;
            type?: string;
            classroomId?: string;
            initialMessage?: string;
        },
    ) {
        this.ensureTenant(req);
        return this.messagingService.createConversation(
            req.user.userId,
            req.user.schoolId,
            body.recipientIds,
            body.subject,
            body.type || 'DIRECT',
            body.classroomId,
            body.initialMessage,
        );
    }

    // ─── RECIPIENTS ─────────────────────────────────────────

    @Get('recipients')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Dostupní příjemci' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async getAvailableRecipients(@Req() req: any) {
        this.ensureTenant(req);
        return this.messagingService.getAvailableRecipients(req.user.userId, req.user.schoolId);
    }

    @Get('classrooms')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Dostupné třídy pro broadcast' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async getAvailableClassrooms(@Req() req: any) {
        this.ensureTenant(req);
        return this.messagingService.getAvailableClassrooms(req.user.userId, req.user.schoolId);
    }

    // ─── BROADCASTS ─────────────────────────────────────────

    @Post('broadcast/class')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Hromadná zpráva třídě' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createClassBroadcast(
        @Req() req: any,
        @Body() body: { classroomId: string; subject: string; message: string },
    ) {
        this.ensureTenant(req);
        return this.messagingService.createClassBroadcast(
            req.user.userId, req.user.schoolId,
            body.classroomId, body.subject, body.message,
        );
    }

    @Post('broadcast/school')
    @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Hromadná zpráva škole' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async createSchoolBroadcast(
        @Req() req: any,
        @Body() body: { subject: string; message: string },
    ) {
        this.ensureTenant(req);
        return this.messagingService.createSchoolBroadcast(
            req.user.userId, req.user.schoolId,
            body.subject, body.message,
        );
    }

    // ─── NOTIFICATIONS ──────────────────────────────────────

    @Get('notifications')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Seznam notifikací' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async getNotifications(
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.notificationService.getNotifications(
            req.user.userId,
            limit ? parseInt(limit) : 20,
            offset ? parseInt(offset) : 0,
        );
    }

    @Get('notifications/unread-count')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Počet nepřečtených notifikací' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async getUnreadCount(@Req() req: any) {
        const count = await this.notificationService.getUnreadCount(req.user.userId);
        return { count };
    }

    @Put('notifications/:id/read')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Označení notifikace jako přečtené' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

    async markAsRead(@Req() req: any, @Param('id') id: string) {
        return this.notificationService.markAsRead(id, req.user.userId);
    }

    @Put('notifications/read-all')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Označení všech notifikací jako přečtených' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    async markAllRead(@Req() req: any) {
        return this.notificationService.markAllRead(req.user.userId);
    }

    // ─── EMAIL NOTIFICATION TOGGLE ──────────────────────────

    @Put('email-notifications')
    @Roles(UserRole.TEACHER, UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.STUDENT, UserRole.PARENT, UserRole.DIRECTOR)
    @ApiOperation({ summary: 'Zapnutí/vypnutí e-mailových notifikací' })

    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })

    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })

    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })

    async toggleEmailNotifications(
        @Req() req: any,
        @Body() body: { enabled: boolean },
    ) {
        await this.prisma.user.update({
            where: { id: req.user.userId },
            data: { emailNotificationsEnabled: body.enabled },
        });
        return { success: true, enabled: body.enabled };
    }
}
