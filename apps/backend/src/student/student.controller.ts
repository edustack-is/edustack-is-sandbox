import {
  Controller,
  Get,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { StudentService } from './student.service';

import {
  ScheduleMatrixResponseDto,
  StudentDataResponseDto,
} from '../common/dto/response.dto';
@ApiTags('student')
@ApiBearerAuth('JWT-auth')
@Controller('api/student')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Get('my-data')
  @ApiOperation({ summary: 'Data přihlášeného studenta' })
  @ApiResponse({
    status: 200,
    description: 'Data studenta – profil, známky, rozvrh, docházka.',
    type: StudentDataResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  async getMyData(@Req() req: any) {
    this.ensureTenantContext(req);
    return this.studentService.getMyData(req.user.userId, req.user.schoolId);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Rozvrh studenta' })
  @ApiResponse({
    status: 200,
    description: 'Rozvrh studenta – matice.',
    type: ScheduleMatrixResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  async getSchedule(@Req() req: any) {
    this.ensureTenantContext(req);
    return this.studentService.getSchedule(req.user.userId, req.user.schoolId);
  }

  /**
   * Ensures the request has a TENANT token (school context selected).
   */
  private ensureTenantContext(req: any) {
    if (req.user.type !== 'TENANT' || !req.user.schoolId) {
      throw new ForbiddenException(
        'School context required. Please select a school first.',
      );
    }
  }
}
