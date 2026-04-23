import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
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
import { CommunityService } from './community.service';
import {
  CreateBulletinPostDto,
  CreateCalendarEventDto,
  CreatePollDto,
  RsvpDto,
  SuccessResponseDto,
} from '../common/dto/api.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

import {
  BulletinPostResponseDto,
  CommunityEventResponseDto,
  PollResponseDto,
} from '../common/dto/response.dto';
@ApiTags('community')
@ApiBearerAuth('JWT-auth')
@Controller('api/community')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  private ensureTenant(req: any) {
    if (!req.user?.schoolId)
      throw new ForbiddenException('School context required.');
  }

  // ─── BULLETIN BOARD ─────────────────────────────────────

  @Post('bulletin')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Vytvoření příspěvku na nástěnku' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořený příspěvek.',
    type: BulletinPostResponseDto,
  })
  @ApiBody({ type: CreateBulletinPostDto })
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
  async createBulletinPost(
    @Req() req: any,
    @Body() body: { title: string; content: string; pinned?: boolean },
  ) {
    this.ensureTenant(req);
    return this.communityService.createBulletinPost(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Get('bulletin')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Seznam příspěvků na nástěnce' })
  @ApiResponse({
    status: 200,
    description: 'Příspěvky na nástěnce – pole.',
    type: BulletinPostResponseDto,
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
  async getBulletinPosts(@Req() req: any) {
    this.ensureTenant(req);
    return this.communityService.getBulletinPosts(req.user.schoolId);
  }

  @Put('bulletin/:id')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Úprava příspěvku na nástěnce' })
  @ApiResponse({
    status: 200,
    description: 'Aktualizovaný příspěvek.',
    type: BulletinPostResponseDto,
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
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async updateBulletinPost(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { title?: string; content?: string; pinned?: boolean },
  ) {
    this.ensureTenant(req);
    return this.communityService.updateBulletinPost(
      req.user.userId,
      req.user.schoolId,
      id,
      body,
    );
  }

  @Delete('bulletin/:id')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazání příspěvku z nástěnky' })
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
  async deleteBulletinPost(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.communityService.deleteBulletinPost(req.user.schoolId, id);
  }

  // ─── POLLS ──────────────────────────────────────────────

  @Post('polls')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Vytvoření ankety' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořená anketa.',
    type: PollResponseDto,
  })
  @ApiBody({ type: CreatePollDto })
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
  async createPoll(
    @Req() req: any,
    @Body()
    body: {
      question: string;
      options: string[];
      multiSelect?: boolean;
      endsAt?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.communityService.createPoll(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Get('polls')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Seznam anket' })
  @ApiResponse({
    status: 200,
    description: 'Ankety – pole.',
    type: PollResponseDto,
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
  async getPolls(@Req() req: any) {
    this.ensureTenant(req);
    return this.communityService.getPolls(req.user.schoolId);
  }

  @Post('polls/:optionId/vote')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Hlasování v anketě' })
  @ApiResponse({
    status: 200,
    description: 'Hlas zaznamenán.',
    type: SuccessResponseDto,
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
  @ApiResponse({
    status: 404,
    description: 'Záznam nebyl nalezen.',
    type: ErrorResponseDto,
  })
  async vote(@Req() req: any, @Param('optionId') optionId: string) {
    return this.communityService.vote(req.user.userId, optionId);
  }

  @Delete('polls/:id')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazání ankety' })
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
  async deletePoll(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.communityService.deletePoll(req.user.schoolId, id);
  }

  // ─── CALENDAR EVENTS ────────────────────────────────────

  @Post('events')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Vytvoření události v kalendáři' })
  @ApiResponse({
    status: 201,
    description: 'Vytvořená událost.',
    type: CommunityEventResponseDto,
  })
  @ApiBody({ type: CreateCalendarEventDto })
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
  async createCalendarEvent(
    @Req() req: any,
    @Body()
    body: {
      title: string;
      description?: string;
      startDate: string;
      endDate?: string;
      location?: string;
    },
  ) {
    this.ensureTenant(req);
    return this.communityService.createCalendarEvent(
      req.user.userId,
      req.user.schoolId,
      body,
    );
  }

  @Get('events')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'Události v kalendáři' })
  @ApiResponse({
    status: 200,
    description: 'Události – pole.',
    type: CommunityEventResponseDto,
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
  async getCalendarEvents(@Req() req: any) {
    this.ensureTenant(req);
    return this.communityService.getCalendarEvents(req.user.schoolId);
  }

  @Post('events/:id/rsvp')
  @Roles(
    UserRole.TEACHER,
    UserRole.PRINCIPAL,
    UserRole.DEPUTY,
    UserRole.ADMIN,
    UserRole.STUDENT,
    UserRole.PARENT,
    UserRole.DIRECTOR,
  )
  @ApiOperation({ summary: 'RSVP na událost' })
  @ApiBody({ type: RsvpDto })
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
  async rsvpEvent(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { status: 'YES' | 'NO' | 'MAYBE' },
  ) {
    return this.communityService.rsvpEvent(req.user.userId, id, body.status);
  }

  @Delete('events/:id')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.DIRECTOR)
  @ApiOperation({ summary: 'Smazání události' })
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
  async deleteCalendarEvent(@Req() req: any, @Param('id') id: string) {
    this.ensureTenant(req);
    return this.communityService.deleteCalendarEvent(req.user.schoolId, id);
  }
}
