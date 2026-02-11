import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Classroom, StudentProfile, TeacherProfile } from '@prisma/client';

@Injectable()
export class RegistryService {
    constructor(private prisma: PrismaService) { }

    async createClassroom(data: Prisma.ClassroomCreateInput): Promise<Classroom> {
        return this.prisma.classroom.create({
            data,
        });
    }

    async findAllClassrooms(): Promise<Classroom[]> {
        return this.prisma.classroom.findMany({
            include: {
                homeroomTeacher: true,
                students: true,
            },
        });
    }

    async createStudentProfile(data: Prisma.StudentProfileCreateInput): Promise<StudentProfile> {
        return this.prisma.studentProfile.create({
            data,
        });
    }

    async createTeacherProfile(data: Prisma.TeacherProfileCreateInput): Promise<TeacherProfile> {
        return this.prisma.teacherProfile.create({
            data,
        });
    }
}
