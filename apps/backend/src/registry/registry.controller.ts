import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegistryService } from './registry.service';
import {
  Prisma,
  Classroom,
  StudentProfile,
  TeacherProfile,
} from '@prisma/client';

import { RegistryClassroomResponseDto } from '../common/dto/response.dto';
@ApiTags('registry')
@Controller('api/registry')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Post('classrooms')
  @ApiOperation({ summary: 'Vytvoření třídy v matrice' })
  @ApiResponse({
    status: 201,
    description: 'Třída vytvořena v matrice.',
    type: RegistryClassroomResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
  })
  async createClassroom(
    @Body() data: Prisma.ClassroomCreateInput,
  ): Promise<Classroom> {
    return this.registryService.createClassroom(data);
  }

  @Get('classrooms')
  async findAllClassrooms(): Promise<Classroom[]> {
    return this.registryService.findAllClassrooms();
  }

  @Post('students')
  async createStudentProfile(
    @Body() data: Prisma.StudentProfileCreateInput,
  ): Promise<StudentProfile> {
    return this.registryService.createStudentProfile(data);
  }

  @Post('teachers')
  async createTeacherProfile(
    @Body() data: Prisma.TeacherProfileCreateInput,
  ): Promise<TeacherProfile> {
    return this.registryService.createTeacherProfile(data);
  }
}
