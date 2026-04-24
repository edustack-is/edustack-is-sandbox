import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RegistryService } from './registry.service';
import { Classroom, StudentProfile, TeacherProfile } from '../database/types';

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
  async createClassroom(@Body() data: any): Promise<Classroom> {
    return this.registryService.createClassroom(data);
  }

  @Get('classrooms')
  async findAllClassrooms(): Promise<Classroom[]> {
    return this.registryService.findAllClassrooms();
  }

  @Post('students')
  async createStudentProfile(@Body() data: any): Promise<StudentProfile> {
    return this.registryService.createStudentProfile(data);
  }

  @Post('teachers')
  async createTeacherProfile(@Body() data: any): Promise<TeacherProfile> {
    return this.registryService.createTeacherProfile(data);
  }
}
