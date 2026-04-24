import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../database/types';
import { MessagingService } from './messaging.service';
import { NotificationService } from './notification.service';
import { DatabaseService } from '../database/database.service';
import {
  ClassBroadcastDto,
  CountResponseDto,
  CreateConversationDto,
  SchoolBroadcastDto,
  SendMessageDto,
  SuccessResponseDto,
  ToggleResponseDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  ClassroomResponseDto,
  ConversationResponseDto,
  MessageResponseDto,
  NotificationResponseDto,
  RecipientResponseDto,
} from '../common/dto/response.dto';
@ApiTags('messaging')
@ApiBearerAuth('JWT-auth')
@Controller('api/messaging')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessagingController {
  constructor(
    private messagingService: MessagingService,
    private notificationService: NotificationService,
    private db: DatabaseService,
  ) {}

  private ensureTenant(req: any) {
    if (!req.user?.schoolId)
      throw new ForbiddenException('School context required.');
  }

  // ─── CONVERSATIONS ──────────────────────────────────────

  @Get('conversations')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Seznam konverzací' })
  @ApiResponse({
    status: 200,
    description: 'Konverzace uživatele – pole.',
    type: ConversationResponseDto,
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
  async getConversations(@Req() req: any) {
    this.ensureTenant(req);
    return this.messagingService.getConversations(
      req.user.userId,
      req.user.schoolId,
    );
  }

  @Get('conversations/:id/messages')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Zprávy v konverzaci' })
  @ApiResponse({
    status: 200,
    description: 'Zprávy v konverzaci s paginací.',
    type: MessageResponseDto,
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
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Odeslání zprávy' })
  @ApiBody({ type: SendMessageDto })
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
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.messagingService.sendMessage(id, req.user.userId, body.content);
  }

  @Post('conversations')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Vytvoření konverzace' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořená konverzace.',
    type: ConversationResponseDto,
  })
  @ApiBody({ type: CreateConversationDto })
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
  async createConversation(
    @Req() req: any,
    @Body()
    body: {
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
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Dostupní příjemci' })
  @ApiResponse({
    status: 200,
    description: 'Dostupní příjemci – pole.',
    type: RecipientResponseDto,
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
  async getAvailableRecipients(@Req() req: any) {
    this.ensureTenant(req);
    return this.messagingService.getAvailableRecipients(
      req.user.userId,
      req.user.schoolId,
    );
  }

  @Get('classrooms')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Dostupné třídy pro broadcast' })
  @ApiResponse({
    status: 200,
    description: 'Třídy pro broadcast – pole.',
    type: ClassroomResponseDto,
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
  async getAvailableClassrooms(@Req() req: any) {
    this.ensureTenant(req);
    return this.messagingService.getAvailableClassrooms(
      req.user.userId,
      req.user.schoolId,
    );
  }

  // ─── BROADCASTS ─────────────────────────────────────────

  @Post('broadcast/class')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Hromadná zpráva třídě' })
  @ApiResponse({
    status: 201,
    description: 'Hromadná zpráva odeslána.',
    type: SuccessResponseDto,
  })
  @ApiBody({ type: ClassBroadcastDto })
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
  async createClassBroadcast(
    @Req() req: any,
    @Body() body: { classroomId: string; subject: string; message: string },
  ) {
    this.ensureTenant(req);
    return this.messagingService.createClassBroadcast(
      req.user.userId,
      req.user.schoolId,
      body.classroomId,
      body.subject,
      body.message,
    );
  }

  @Post('broadcast/school')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Hromadná zpráva škole' })
  @ApiResponse({
    status: 201,
    description: 'Školní broadcast odeslán.',
    type: SuccessResponseDto,
  })
  @ApiBody({ type: SchoolBroadcastDto })
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
  async createSchoolBroadcast(
    @Req() req: any,
    @Body() body: { subject: string; message: string },
  ) {
    this.ensureTenant(req);
    return this.messagingService.createSchoolBroadcast(
      req.user.userId,
      req.user.schoolId,
      body.subject,
      body.message,
    );
  }

  // ─── NOTIFICATIONS ──────────────────────────────────────

  @Get('notifications')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Seznam notifikací' })
  @ApiResponse({
    status: 200,
    description: 'Notifikace s paginací.',
    type: NotificationResponseDto,
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
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Počet nepřečtených notifikací' })
  @ApiResponse({ status: 200, type: CountResponseDto })
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
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationService.getUnreadCount(
      req.user.userId,
    );
    return { count };
  }

  @Put('notifications/:id/read')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Označení notifikace jako přečtené' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
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
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationService.markAsRead(id, req.user.userId);
  }

  @Put('notifications/read-all')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Označení všech notifikací jako přečtených' })
  @ApiResponse({ status: 200, type: SuccessResponseDto })
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
  async markAllRead(@Req() req: any) {
    return this.notificationService.markAllRead(req.user.userId);
  }

  // ─── EMAIL NOTIFICATION TOGGLE ──────────────────────────

  @Put('email-notifications')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.ADMIN,
  )
  @ApiOperation({ summary: 'Zapnutí/vypnutí e-mailových notifikací' })
  @ApiResponse({ status: 200, type: ToggleResponseDto })
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
  async toggleEmailNotifications(
    @Req() req: any,
    @Body() body: { enabled: boolean },
  ) {
    await this.db.execute(
      'UPDATE "User" SET emailNotificationsEnabled = ? WHERE id = ?',
      [body.enabled ? 1 : 0, req.user.userId],
    );
    return { success: true, enabled: body.enabled };
  }
}
