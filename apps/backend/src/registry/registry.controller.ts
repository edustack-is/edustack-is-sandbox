import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
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
import { UserRole } from '../database/types';
import { RegistryService } from './registry.service';
import { Classroom, StudentProfile, TeacherProfile } from '../database/types';
import {
  CreateClassroomDto,
  CreateStudentProfileDto,
  CreateTeacherProfileDto,
} from '../common/dto/api.dto';
import { RegistryClassroomResponseDto } from '../common/dto/response.dto';

@ApiTags('registry')
@ApiBearerAuth('JWT-auth')
@Controller('api/registry')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  private ensureTenant(req: any): string {
    if (req.user?.type !== 'TENANT' || !req.user?.schoolId) {
      throw new ForbiddenException('School context required.');
    }
    return req.user.schoolId;
  }

  @Post('classrooms')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  @ApiOperation({ summary: 'Vytvoření třídy v matrice' })
  @ApiResponse({
    status: 201,
    description: 'Třída vytvořena v matrice.',
    type: RegistryClassroomResponseDto,
  })
  async createClassroom(
    @Req() req: any,
    @Body() data: CreateClassroomDto,
  ): Promise<Classroom> {
    const schoolId = this.ensureTenant(req);
    return this.registryService.createClassroom(schoolId, data);
  }

  @Get('classrooms')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN, UserRole.TEACHER)
  async findAllClassrooms(@Req() req: any): Promise<Classroom[]> {
    const schoolId = this.ensureTenant(req);
    return this.registryService.findAllClassrooms(schoolId);
  }

  @Post('students')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  async createStudentProfile(
    @Req() req: any,
    @Body() data: CreateStudentProfileDto,
  ): Promise<StudentProfile> {
    const schoolId = this.ensureTenant(req);
    return this.registryService.createStudentProfile(schoolId, data);
  }

  @Post('teachers')
  @Roles(UserRole.PRINCIPAL, UserRole.DEPUTY, UserRole.ADMIN)
  async createTeacherProfile(
    @Req() req: any,
    @Body() data: CreateTeacherProfileDto,
  ): Promise<TeacherProfile> {
    const schoolId = this.ensureTenant(req);
    return this.registryService.createTeacherProfile(schoolId, data);
  }
}
