import { Controller, Get, Post, Body } from '@nestjs/common';
import { RegistryService } from './registry.service';
import { Prisma, Classroom, StudentProfile, TeacherProfile } from '@prisma/client';

@Controller('api/registry')
export class RegistryController {
    constructor(private readonly registryService: RegistryService) { }

    @Post('classrooms')
    async createClassroom(@Body() data: Prisma.ClassroomCreateInput): Promise<Classroom> {
        return this.registryService.createClassroom(data);
    }

    @Get('classrooms')
    async findAllClassrooms(): Promise<Classroom[]> {
        return this.registryService.findAllClassrooms();
    }

    @Post('students')
    async createStudentProfile(@Body() data: Prisma.StudentProfileCreateInput): Promise<StudentProfile> {
        return this.registryService.createStudentProfile(data);
    }

    @Post('teachers')
    async createTeacherProfile(@Body() data: Prisma.TeacherProfileCreateInput): Promise<TeacherProfile> {
        return this.registryService.createTeacherProfile(data);
    }
}
