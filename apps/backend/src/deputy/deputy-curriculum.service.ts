import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeputyCurriculumService {
    constructor(private readonly prisma: PrismaService) { }

    // ─── GET: ACADEMIC YEARS ─────────────────────────────────────────

    async getAcademicYears(schoolId: string) {
        return this.prisma.academicYear.findMany({
            where: { schoolId },
            orderBy: { startDate: 'desc' },
        });
    }

    // ─── GET: GRADE LEVELS ─────────────────────────────────────────

    async getGradeLevels(schoolId: string) {
        return this.prisma.gradeLevel.findMany({
            where: { schoolId },
            orderBy: { levelNumber: 'asc' },
        });
    }

    // ─── CREATE: GRADE LEVEL ────────────────────────────────────────

    async createGradeLevel(
        actorId: string,
        schoolId: string,
        data: { name: string; levelNumber: number },
    ) {
        const existing = await this.prisma.gradeLevel.findFirst({
            where: { schoolId, levelNumber: data.levelNumber },
        });
        if (existing) {
            throw new BadRequestException(`Grade level #${data.levelNumber} already exists.`);
        }

        const level = await this.prisma.gradeLevel.create({
            data: {
                name: data.name,
                levelNumber: data.levelNumber,
                schoolId,
            },
        });

        await this.audit(actorId, 'CREATE_GRADE_LEVEL', 'GradeLevel', level.id, data);
        return level;
    }

    async updateGradeLevel(
        actorId: string,
        schoolId: string,
        id: string,
        data: { name?: string; levelNumber?: number },
    ) {
        const existing = await this.prisma.gradeLevel.findFirst({
            where: { id, schoolId },
        });
        if (!existing) throw new NotFoundException('Grade level not found.');

        if (data.levelNumber !== undefined && data.levelNumber !== existing.levelNumber) {
            const conflict = await this.prisma.gradeLevel.findFirst({
                where: { schoolId, levelNumber: data.levelNumber, id: { not: id } },
            });
            if (conflict) {
                throw new BadRequestException(`Grade level #${data.levelNumber} already exists.`);
            }
        }

        const updated = await this.prisma.gradeLevel.update({
            where: { id },
            data,
        });

        await this.audit(actorId, 'UPDATE_GRADE_LEVEL', 'GradeLevel', id, data, existing);
        return updated;
    }

    async deleteGradeLevel(
        actorId: string,
        schoolId: string,
        id: string,
    ) {
        const existing = await this.prisma.gradeLevel.findFirst({
            where: { id, schoolId },
        });
        if (!existing) throw new NotFoundException('Grade level not found.');

        await this.prisma.gradeLevel.delete({ where: { id } });
        await this.audit(actorId, 'DELETE_GRADE_LEVEL', 'GradeLevel', id, null, existing);
        return { deleted: true };
    }
    // ─── GET: TEACHERS (school members with TEACHER role) ──────────

    async getTeachers(schoolId: string) {
        const memberships = await this.prisma.schoolMembership.findMany({
            where: { schoolId, role: 'TEACHER', status: 'ACTIVE' },
            include: {
                user: {
                    include: {
                        teacherProfile: true,
                    },
                },
            },
        });
        return memberships.map((m) => ({
            id: m.userId,
            firstName: m.user.firstName,
            lastName: m.user.lastName,
            email: m.user.email,
            teacherProfile: m.user.teacherProfile,
        }));
    }

    // ─── GET: TEACHER WORKLOADS ────────────────────────────────────

    async getTeacherWorkloads(schoolId: string, academicYearId: string) {
        // Validate academic year belongs to school
        const year = await this.prisma.academicYear.findFirst({
            where: { id: academicYearId, schoolId },
        });
        if (!year) throw new NotFoundException('Academic year not found in this school.');

        return this.prisma.teacherWorkload.findMany({
            where: { academicYearId },
            include: { teacher: true },
        });
    }

    // ─── SAVE: TEACHER WORKLOAD ────────────────────────────────────

    async saveTeacherWorkload(
        actorId: string,
        schoolId: string,
        data: { teacherId: string; academicYearId: string; workloadPercentage: number },
    ) {
        // Validate academic year belongs to school
        const year = await this.prisma.academicYear.findFirst({
            where: { id: data.academicYearId, schoolId },
        });
        if (!year) throw new NotFoundException('Academic year not found in this school.');

        const workload = await this.prisma.teacherWorkload.upsert({
            where: {
                teacherId_academicYearId: {
                    teacherId: data.teacherId,
                    academicYearId: data.academicYearId,
                },
            },
            create: {
                teacherId: data.teacherId,
                academicYearId: data.academicYearId,
                workloadPercentage: data.workloadPercentage,
            },
            update: {
                workloadPercentage: data.workloadPercentage,
            },
        });

        await this.audit(actorId, 'SAVE_TEACHER_WORKLOAD', 'TeacherWorkload', workload.id, data);
        return workload;
    }

    // ─── GET: SUBJECT INSTANCES ─────────────────────────────────────

    async getSubjectInstances(schoolId: string, academicYearId: string) {
        // Validate academic year belongs to school
        const year = await this.prisma.academicYear.findFirst({
            where: { id: academicYearId, schoolId },
        });
        if (!year) throw new NotFoundException('Academic year not found in this school.');

        return this.prisma.subjectInstance.findMany({
            where: { schoolId, academicYearId },
            include: { template: true, gradeLevel: true },
        });
    }

    // ─── CREATE: ACADEMIC YEAR ──────────────────────────────────────

    async createAcademicYear(
        actorId: string,
        schoolId: string,
        data: { name: string; startDate: string; endDate: string; isCurrent?: boolean; curriculumVersionId?: string },
    ) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        if (end <= start) {
            throw new BadRequestException('endDate must be after startDate.');
        }

        // Validate curriculum version if provided
        if (data.curriculumVersionId) {
            const version = await this.prisma.curriculumVersion.findFirst({
                where: { id: data.curriculumVersionId, schoolId },
            });
            if (!version) throw new NotFoundException('Curriculum version not found in this school.');
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
                curriculumVersionId: data.curriculumVersionId ?? null,
                schoolId,
            },
            include: { curriculumVersion: true },
        });

        await this.audit(actorId, 'CREATE_ACADEMIC_YEAR', 'AcademicYear', academicYear.id, data);
        return academicYear;
    }

    // ─── SUBJECT INSTANCE ───────────────────────────────────────────

    async createSubjectInstance(
        actorId: string,
        schoolId: string,
        data: {
            templateId: string;
            academicYearId: string;
            gradeLevelId: string;
            hoursPerWeek: number;
            curriculumVersionId?: string;
        },
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
                curriculumVersionId: data.curriculumVersionId,
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

    // ─── CURRICULUM VERSIONING (ŠVP) ────────────────────────────────

    private versionIncludes() {
        return {
            entries: {
                include: { subjectTemplate: true, gradeLevel: true },
                orderBy: [
                    { subjectTemplate: { name: 'asc' as const } },
                    { gradeLevel: { levelNumber: 'asc' as const } },
                ],
            },
            subjectTemplates: {
                orderBy: { name: 'asc' as const },
            },
            academicYears: {
                orderBy: { startDate: 'desc' as const },
            },
        };
    }

    async getCurriculumVersions(schoolId: string) {
        return this.prisma.curriculumVersion.findMany({
            where: { schoolId },
            include: this.versionIncludes(),
            orderBy: { createdAt: 'desc' },
        });
    }

    async getCurriculumVersion(schoolId: string, versionId: string) {
        const version = await this.prisma.curriculumVersion.findFirst({
            where: { id: versionId, schoolId },
            include: this.versionIncludes(),
        });
        if (!version) throw new NotFoundException('Curriculum version not found.');
        return version;
    }

    async createCurriculumVersion(
        actorId: string,
        schoolId: string,
        data: {
            name: string;
            validFrom: string;
            validTo?: string;
        },
    ) {
        const version = await this.prisma.curriculumVersion.create({
            data: {
                name: data.name,
                validFrom: new Date(data.validFrom),
                validTo: data.validTo ? new Date(data.validTo) : null,
                schoolId,
            },
            include: this.versionIncludes(),
        });

        await this.audit(actorId, 'CREATE_CURRICULUM_VERSION', 'CurriculumVersion', version.id, data);
        return version;
    }

    async updateCurriculumVersion(
        actorId: string,
        schoolId: string,
        versionId: string,
        data: {
            name?: string;
            validFrom?: string;
            validTo?: string | null;
        },
    ) {
        const version = await this.prisma.curriculumVersion.findFirst({
            where: { id: versionId, schoolId },
        });
        if (!version) throw new NotFoundException('Curriculum version not found.');

        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.validFrom !== undefined) updateData.validFrom = new Date(data.validFrom);
        if (data.validTo !== undefined) updateData.validTo = data.validTo ? new Date(data.validTo) : null;

        const updated = await this.prisma.curriculumVersion.update({
            where: { id: versionId },
            data: updateData,
            include: this.versionIncludes(),
        });

        await this.audit(actorId, 'UPDATE_CURRICULUM_VERSION', 'CurriculumVersion', versionId, data);
        return updated;
    }

    async deleteCurriculumVersion(actorId: string, schoolId: string, versionId: string) {
        const version = await this.prisma.curriculumVersion.findFirst({
            where: { id: versionId, schoolId },
        });
        if (!version) throw new NotFoundException('Curriculum version not found.');

        await this.prisma.curriculumVersion.delete({ where: { id: versionId } });
        await this.audit(actorId, 'DELETE_CURRICULUM_VERSION', 'CurriculumVersion', versionId, {});
        return { deleted: true };
    }

    // ─── CURRICULUM ENTRIES (předmět × ročník) ──────────────────────

    async saveCurriculumEntry(
        actorId: string,
        schoolId: string,
        data: {
            curriculumVersionId: string;
            subjectTemplateId: string;
            gradeLevelId: string;
            hoursPerWeek: number;
            rvpDescription?: string;
            svpApproach?: string;
            equipmentRequirements?: string[];
            needsComputerLab?: boolean;
        },
    ) {
        // Validate version belongs to school
        const version = await this.prisma.curriculumVersion.findFirst({
            where: { id: data.curriculumVersionId, schoolId },
        });
        if (!version) throw new NotFoundException('Curriculum version not found.');

        // Validate subject template belongs to school
        const template = await this.prisma.subjectTemplate.findFirst({
            where: { id: data.subjectTemplateId, schoolId },
        });
        if (!template) throw new NotFoundException('Subject template not found.');

        // Validate grade level belongs to school
        const gradeLevel = await this.prisma.gradeLevel.findFirst({
            where: { id: data.gradeLevelId, schoolId },
        });
        if (!gradeLevel) throw new NotFoundException('Grade level not found.');

        if (data.hoursPerWeek < 0) {
            throw new BadRequestException('hoursPerWeek must be non-negative.');
        }

        const entry = await this.prisma.curriculumEntry.upsert({
            where: {
                curriculumVersionId_subjectTemplateId_gradeLevelId: {
                    curriculumVersionId: data.curriculumVersionId,
                    subjectTemplateId: data.subjectTemplateId,
                    gradeLevelId: data.gradeLevelId,
                },
            },
            create: {
                curriculumVersionId: data.curriculumVersionId,
                subjectTemplateId: data.subjectTemplateId,
                gradeLevelId: data.gradeLevelId,
                hoursPerWeek: data.hoursPerWeek,
                rvpDescription: data.rvpDescription,
                svpApproach: data.svpApproach,
                equipmentRequirements: data.equipmentRequirements,
                needsComputerLab: data.needsComputerLab ?? false,
            },
            update: {
                hoursPerWeek: data.hoursPerWeek,
                rvpDescription: data.rvpDescription,
                svpApproach: data.svpApproach,
                equipmentRequirements: data.equipmentRequirements,
                needsComputerLab: data.needsComputerLab,
            },
            include: { subjectTemplate: true, gradeLevel: true },
        });

        await this.audit(actorId, 'SAVE_CURRICULUM_ENTRY', 'CurriculumEntry', entry.id, data);
        return entry;
    }

    async deleteCurriculumEntry(actorId: string, schoolId: string, entryId: string) {
        const entry = await this.prisma.curriculumEntry.findFirst({
            where: { id: entryId, curriculumVersion: { schoolId } },
        });
        if (!entry) throw new NotFoundException('Curriculum entry not found.');

        await this.prisma.curriculumEntry.delete({ where: { id: entryId } });
        await this.audit(actorId, 'DELETE_CURRICULUM_ENTRY', 'CurriculumEntry', entryId, {});
        return { deleted: true };
    }

    // ─── WHITE BOOK (read-only overview) ────────────────────────────

    async getWhiteBookData(schoolId: string) {
        // Get the latest (most recent) active curriculum version
        const versions = await this.prisma.curriculumVersion.findMany({
            where: { schoolId },
            include: this.versionIncludes(),
            orderBy: { createdAt: 'desc' },
        });

        const gradeLevels = await this.prisma.gradeLevel.findMany({
            where: { schoolId },
            orderBy: { levelNumber: 'asc' },
        });

        const subjectTemplates = await this.prisma.subjectTemplate.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
        });

        const academicYears = await this.prisma.academicYear.findMany({
            where: { schoolId },
            orderBy: { startDate: 'desc' },
        });

        return { versions, gradeLevels, subjectTemplates, academicYears };
    }

    // ─── SEMESTERS ──────────────────────────────────────────────────

    async createSemesters(
        actorId: string,
        schoolId: string,
        data: {
            academicYearId: string;
            semesters: Array<{ number: number; name: string; startDate: string; endDate: string }>;
        },
    ) {
        const year = await this.prisma.academicYear.findFirst({
            where: { id: data.academicYearId, schoolId },
        });
        if (!year) throw new NotFoundException('Academic year not found.');

        const results = await this.prisma.$transaction(
            data.semesters.map((s) =>
                this.prisma.semester.upsert({
                    where: {
                        academicYearId_number: {
                            academicYearId: data.academicYearId,
                            number: s.number,
                        },
                    },
                    create: {
                        number: s.number,
                        name: s.name,
                        startDate: new Date(s.startDate),
                        endDate: new Date(s.endDate),
                        academicYearId: data.academicYearId,
                    },
                    update: {
                        name: s.name,
                        startDate: new Date(s.startDate),
                        endDate: new Date(s.endDate),
                    },
                }),
            ),
        );

        await this.audit(actorId, 'CREATE_SEMESTERS', 'Semester', data.academicYearId, data);
        return results;
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
