import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeputyCurriculumService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── ACADEMIC YEAR ──────────────────────────────────────────────

    async createAcademicYear(
        actorId: string,
        schoolId: string,
        data: { name: string; startDate: string; endDate: string; isCurrent?: boolean },
    ) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        if (end <= start) {
            throw new BadRequestException('endDate must be after startDate.');
        }

        // If marking as current, unset any existing current year for this school
        if (data.isCurrent) {
            await this.prisma.academicYear.updateMany({
                where: { schoolId, isCurrent: true },
                data: { isCurrent: false },
            });
        }

        const academicYear = await this.prisma.academicYear.create({
            data: {
                name: data.name,
                startDate: start,
                endDate: end,
                isCurrent: data.isCurrent ?? false,
                schoolId,
            },
        });

        await this.audit(actorId, 'CREATE_ACADEMIC_YEAR', 'AcademicYear', academicYear.id, data);
        return academicYear;
    }

    // ─── SUBJECT INSTANCE ───────────────────────────────────────────

    async createSubjectInstance(
        actorId: string,
        schoolId: string,
        data: { templateId: string; academicYearId: string; gradeLevelId: string; hoursPerWeek: number },
    ) {
        // Validate template belongs to this school
        const template = await this.prisma.subjectTemplate.findFirst({
            where: { id: data.templateId, schoolId },
        });
        if (!template) throw new NotFoundException('Subject template not found in this school.');

        // Validate academic year belongs to this school
        const academicYear = await this.prisma.academicYear.findFirst({
            where: { id: data.academicYearId, schoolId },
        });
        if (!academicYear) throw new NotFoundException('Academic year not found in this school.');

        // Validate grade level belongs to this school
        const gradeLevel = await this.prisma.gradeLevel.findFirst({
            where: { id: data.gradeLevelId, schoolId },
        });
        if (!gradeLevel) throw new NotFoundException('Grade level not found in this school.');

        if (data.hoursPerWeek < 1) {
            throw new BadRequestException('hoursPerWeek must be at least 1.');
        }

        const instance = await this.prisma.subjectInstance.create({
            data: {
                templateId: data.templateId,
                academicYearId: data.academicYearId,
                gradeLevelId: data.gradeLevelId,
                hoursPerWeek: data.hoursPerWeek,
                schoolId,
            },
            include: { template: true, academicYear: true, gradeLevel: true },
        });

        await this.audit(actorId, 'CREATE_SUBJECT_INSTANCE', 'SubjectInstance', instance.id, {
            templateName: template.name,
            academicYear: academicYear.name,
            gradeLevel: gradeLevel.name,
            hoursPerWeek: data.hoursPerWeek,
        });

        return instance;
    }

    // ─── BATCH ENROLLMENT ───────────────────────────────────────────

    async batchEnroll(
        actorId: string,
        schoolId: string,
        data: {
            studentIds: string[];
            academicYearId: string;
            gradeLevelId: string;
            classroomId?: string;
        },
    ) {
        if (!data.studentIds.length) {
            throw new BadRequestException('studentIds must not be empty.');
        }

        // Validate academic year belongs to this school
        const academicYear = await this.prisma.academicYear.findFirst({
            where: { id: data.academicYearId, schoolId },
        });
        if (!academicYear) throw new NotFoundException('Academic year not found in this school.');

        // Validate grade level belongs to this school
        const gradeLevel = await this.prisma.gradeLevel.findFirst({
            where: { id: data.gradeLevelId, schoolId },
        });
        if (!gradeLevel) throw new NotFoundException('Grade level not found in this school.');

        // Validate classroom if provided
        if (data.classroomId) {
            const classroom = await this.prisma.classroom.findFirst({
                where: { id: data.classroomId, schoolId },
            });
            if (!classroom) throw new NotFoundException('Classroom not found in this school.');
        }

        // Validate all students are members of this school
        const memberships = await this.prisma.schoolMembership.findMany({
            where: {
                userId: { in: data.studentIds },
                schoolId,
                role: 'STUDENT',
            },
            select: { userId: true },
        });

        const validStudentIds = memberships.map((m) => m.userId);
        const invalidIds = data.studentIds.filter((id) => !validStudentIds.includes(id));
        if (invalidIds.length > 0) {
            throw new BadRequestException(
                `The following student IDs are not valid STUDENT members of this school: ${invalidIds.join(', ')}`,
            );
        }

        // Create enrollments in a transaction
        const enrollments = await this.prisma.$transaction(
            data.studentIds.map((studentId) =>
                this.prisma.studentEnrollment.upsert({
                    where: {
                        studentId_academicYearId: {
                            studentId,
                            academicYearId: data.academicYearId,
                        },
                    },
                    create: {
                        studentId,
                        academicYearId: data.academicYearId,
                        gradeLevelId: data.gradeLevelId,
                        classroomId: data.classroomId,
                    },
                    update: {
                        gradeLevelId: data.gradeLevelId,
                        classroomId: data.classroomId,
                    },
                }),
            ),
        );

        await this.audit(actorId, 'BATCH_ENROLL_STUDENTS', 'StudentEnrollment', 'batch', {
            count: enrollments.length,
            academicYear: academicYear.name,
            gradeLevel: gradeLevel.name,
            studentIds: data.studentIds,
        });

        return { enrolled: enrollments.length, enrollments };
    }

    // ─── AUDIT HELPER ───────────────────────────────────────────────

    private async audit(actorId: string, action: string, entity: string, entityId: string, newValues?: any, oldValues?: any) {
        await this.prisma.auditLog.create({
            data: {
                actorId,
                action,
                entity,
                entityId,
                newValues: newValues ?? undefined,
                oldValues: oldValues ?? undefined,
            },
        });
    }
}
