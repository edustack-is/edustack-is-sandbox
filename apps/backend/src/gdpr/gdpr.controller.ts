import { Controller, Get, Delete, UseGuards, Req, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DatabaseService } from '../database/database.service';
import { SuccessResponseDto } from '../common/dto/api.dto';
import { GdprDataResponseDto } from '../common/dto/response.dto';
import {
  User,
  StudentProfile,
  TeacherProfile,
  SchoolMembership,
  Grade,
  Attendance,
  Message,
  AuditLog,
} from '../database/types';

@ApiTags('gdpr')
@ApiBearerAuth('JWT-auth')
@Controller('api/gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly db: DatabaseService) {}

  @Get('my-data')
  @ApiOperation({
    summary: 'Export osobních dat (čl. 15 GDPR)',
    description:
      'Vrátí veškerá osobní data přihlášeného uživatele: profil, známky, docházku, zprávy, audit log.',
  })
  @ApiResponse({
    status: 200,
    description: 'JSON objekt se všemi osobními daty uživatele.',
    type: GdprDataResponseDto,
  })
  async getMyData(@Req() req: any) {
    const userId = req.user.userId;

    const user = await this.db.queryOne<Partial<User>>(
      'SELECT id, email, firstName, lastName, isSystemAdmin, createdAt, lastLogin FROM "User" WHERE id = ?',
      [userId],
    );

    const studentProfile = await this.db.queryOne<StudentProfile>(
      'SELECT id, firstName, lastName, rc FROM "StudentProfile" WHERE userId = ?',
      [userId],
    );

    const teacherProfile = await this.db.queryOne<TeacherProfile>(
      'SELECT id FROM "TeacherProfile" WHERE userId = ?',
      [userId],
    );

    const memberships = await this.db.query<any>(
      `SELECT m.*, s.name as schoolName 
       FROM "SchoolMembership" m 
       JOIN "School" s ON m.schoolId = s.id 
       WHERE m.userId = ?`,
      [userId],
    );

    const grades = studentProfile
      ? await this.db.query<Partial<Grade>>(
          'SELECT value, weight, description, date, createdAt FROM "Grade" WHERE studentId = ? ORDER BY createdAt DESC',
          [studentProfile.id],
        )
      : [];

    const attendance = studentProfile
      ? await this.db.query<Partial<Attendance>>(
          'SELECT date, status, note FROM "Attendance" WHERE studentId = ? ORDER BY date DESC',
          [studentProfile.id],
        )
      : [];

    const messages = await this.db.query<Partial<Message>>(
      'SELECT content, createdAt FROM "Message" WHERE senderId = ? ORDER BY createdAt DESC LIMIT 500',
      [userId],
    );

    const auditLogs = await this.db.query<Partial<AuditLog>>(
      'SELECT action, entity, ipAddress, createdAt FROM "AuditLog" WHERE actorId = ? ORDER BY createdAt DESC LIMIT 200',
      [userId],
    );

    return {
      exportDate: new Date().toISOString(),
      gdprArticle: 'Článek 15 GDPR — Právo na přístup',
      user,
      studentProfile,
      teacherProfile: teacherProfile ? { id: teacherProfile.id } : null,
      memberships: memberships.map((m: any) => ({
        school: m.schoolName,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      grades,
      attendance,
      messages: messages.map((m: any) => ({
        content: m.content,
        sentAt: m.createdAt,
      })),
      auditLogs,
    };
  }

  @Get('my-data/download')
  @ApiOperation({
    summary: 'Stáhnout osobní data jako JSON',
    description:
      'Stáhne JSON soubor se všemi osobními daty (Content-Disposition: attachment).',
  })
  @ApiProduces('application/json')
  @ApiResponse({ status: 200, description: 'JSON soubor ke stažení.' })
  async downloadMyData(@Req() req: any, @Res() res: Response) {
    const data = await this.getMyData(req);
    const json = JSON.stringify(data, null, 2);
    const filename = `gdpr-export-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(json);
  }

  @Delete('my-data')
  @ApiOperation({
    summary: 'Smazání osobních dat (čl. 17 GDPR)',
    description:
      'Anonymizuje PII uživatele. Školní záznamy (známky, docházka) zůstanou, ale bez identifikace.',
  })
  @ApiResponse({
    status: 200,
    type: SuccessResponseDto,
    description: 'Potvrzení anonymizace.',
  })
  async deleteMyData(@Req() req: any) {
    const userId = req.user.userId;

    await this.db.execute(
      `UPDATE "User" SET 
         email = ?, 
         firstName = ?, 
         lastName = ?, 
         passwordHash = ?, 
         deletedAt = ? 
       WHERE id = ?`,
      [
        `deleted-${userId.slice(0, 8)}@anonymized.local`,
        'Smazaný',
        'Uživatel',
        '',
        new Date().toISOString(),
        userId,
      ],
    );

    const studentProfile = await this.db.queryOne<StudentProfile>(
      'SELECT id FROM "StudentProfile" WHERE userId = ?',
      [userId],
    );
    if (studentProfile) {
      await this.db.execute(
        'UPDATE "StudentProfile" SET firstName = ?, lastName = ?, rc = ? WHERE id = ?',
        ['Smazaný', 'Žák', null, studentProfile.id],
      );
    }

    await this.db.execute('DELETE FROM "Message" WHERE senderId = ?', [userId]);
    await this.db.execute('DELETE FROM "Identity" WHERE userId = ?', [userId]);

    await this.db.execute(
      'INSERT INTO "AuditLog" (id, actorId, action, entity, entityId, ipAddress, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        require('crypto').randomUUID(),
        userId,
        'GDPR_DATA_DELETION',
        'User',
        userId,
        req.ip,
        new Date().toISOString(),
      ],
    );

    return {
      success: true,
      message: 'Osobní údaje byly anonymizovány v souladu s čl. 17 GDPR.',
    };
  }
}
