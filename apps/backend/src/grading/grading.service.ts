import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GradingService {
    private genAI: GoogleGenerativeAI;
    private model: any;

    constructor(private prisma: PrismaService) {
        this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    }

    // ─── GRADE CRUD ─────────────────────────────────────────────

    async createGrade(
        userId: string,
        schoolId: string,
        data: {
            studentId: string;
            subjectInstanceId: string;
            value: string;
            weight: number;
            description?: string;
            type?: string;
            verbalText?: string;
            category?: string;
            semesterId?: string;
        },
    ) {
        const teacherProfile = await this.getTeacherProfile(userId);

        // Validate: teacher teaches this subject to this student's classroom
        const student = await this.prisma.studentProfile.findUnique({
            where: { id: data.studentId },
            select: { id: true, classroomId: true },
        });
        if (!student) throw new NotFoundException('Student not found');

        const hasAuthority = await this.prisma.scheduleEvent.findFirst({
            where: {
                teacherId: teacherProfile.id,
                schoolId,
                classroomId: student.classroomId ?? undefined,
                subjectInstanceId: data.subjectInstanceId,
            },
        });

        if (!hasAuthority) {
            throw new ForbiddenException('You are not authorized to grade this student for this subject.');
        }

        // Validate grade value for NUMERIC type
        const type = data.type || 'NUMERIC';
        if (type === 'NUMERIC') {
            const numVal = parseInt(data.value);
            if (isNaN(numVal) || numVal < 1 || numVal > 5) {
                throw new BadRequestException('Numeric grade must be between 1 and 5.');
            }
        }

        const grade = await this.prisma.grade.create({
            data: {
                value: data.value,
                weight: data.weight,
                description: data.description,
                type,
                verbalText: data.verbalText,
                category: data.category,
                schoolId,
                studentId: data.studentId,
                subjectInstanceId: data.subjectInstanceId,
                teacherId: teacherProfile.id,
                semesterId: data.semesterId,
            },
            include: {
                subjectInstance: { include: { template: true } },
                studentProfile: true,
                teacherProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
        });

        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'CREATE_GRADE',
                entity: 'Grade',
                entityId: grade.id,
                newValues: {
                    value: data.value,
                    type,
                    weight: data.weight,
                    studentId: data.studentId,
                    subjectInstanceId: data.subjectInstanceId,
                    category: data.category,
                },
            },
        });

        return grade;
    }

    async updateGrade(userId: string, schoolId: string, gradeId: string, data: {
        value?: string;
        weight?: number;
        description?: string;
        verbalText?: string;
        category?: string;
    }) {
        const grade = await this.prisma.grade.findUnique({ where: { id: gradeId } });
        if (!grade) throw new NotFoundException('Grade not found');
        if (grade.schoolId !== schoolId) throw new ForbiddenException('Grade does not belong to this school.');

        // Check teacher authority: must be the teacher who created the grade or admin
        const teacherProfile = await this.getTeacherProfile(userId);
        if (grade.teacherId !== teacherProfile.id) {
            throw new ForbiddenException('You can only edit grades you created.');
        }

        if (data.value && grade.type === 'NUMERIC') {
            const numVal = parseInt(data.value);
            if (isNaN(numVal) || numVal < 1 || numVal > 5) {
                throw new BadRequestException('Numeric grade must be between 1 and 5.');
            }
        }

        const updated = await this.prisma.grade.update({
            where: { id: gradeId },
            data: {
                ...(data.value !== undefined && { value: data.value }),
                ...(data.weight !== undefined && { weight: data.weight }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.verbalText !== undefined && { verbalText: data.verbalText }),
                ...(data.category !== undefined && { category: data.category }),
            },
            include: {
                subjectInstance: { include: { template: true } },
                studentProfile: true,
            },
        });

        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'UPDATE_GRADE',
                entity: 'Grade',
                entityId: gradeId,
                newValues: data,
            },
        });

        return updated;
    }

    async deleteGrade(userId: string, schoolId: string, gradeId: string) {
        const grade = await this.prisma.grade.findUnique({ where: { id: gradeId } });
        if (!grade) throw new NotFoundException('Grade not found');
        if (grade.schoolId !== schoolId) throw new ForbiddenException('Grade does not belong to this school.');

        const teacherProfile = await this.getTeacherProfile(userId);
        if (grade.teacherId !== teacherProfile.id) {
            throw new ForbiddenException('You can only delete grades you created.');
        }

        await this.prisma.grade.delete({ where: { id: gradeId } });

        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'DELETE_GRADE',
                entity: 'Grade',
                entityId: gradeId,
                newValues: { deletedGrade: grade.value, studentId: grade.studentId },
            },
        });

        return { success: true };
    }

    // ─── GRADE QUERIES ──────────────────────────────────────────

    /**
     * Get grades for a classroom: all students × subjects.
     * Teachers see only subjects they teach. Admins see all.
     */
    async getGradesForClassroom(userId: string, schoolId: string, classroomId: string, opts?: {
        semesterId?: string;
        isAdmin?: boolean;
    }) {
        const classroom = await this.prisma.classroom.findUnique({
            where: { id: classroomId },
            include: {
                students: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } },
                    },
                },
            },
        });
        if (!classroom || classroom.schoolId !== schoolId) {
            throw new NotFoundException('Classroom not found');
        }

        // Get subjects for this classroom
        let subjectFilter: any = { schoolId, classroomId };
        if (!opts?.isAdmin) {
            const teacherProfile = await this.getTeacherProfile(userId);
            subjectFilter.teacherId = teacherProfile.id;
        }

        const events = await this.prisma.scheduleEvent.findMany({
            where: subjectFilter,
            include: {
                subject: { include: { template: true } },
            },
            distinct: ['subjectInstanceId'],
        });

        const subjectInstances = events.map(e => e.subject);
        const studentIds = classroom.students.map(s => s.id);

        // Get all grades
        const where: any = {
            schoolId,
            studentId: { in: studentIds },
            subjectInstanceId: { in: subjectInstances.map(s => s.id) },
        };
        if (opts?.semesterId) where.semesterId = opts.semesterId;

        const grades = await this.prisma.grade.findMany({
            where,
            include: {
                subjectInstance: { include: { template: true } },
                teacherProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { date: 'desc' },
        });

        return {
            classroom: { id: classroom.id, name: classroom.name, grade: classroom.grade },
            students: classroom.students.map(s => ({
                id: s.id,
                firstName: s.firstName,
                lastName: s.lastName,
            })),
            subjects: subjectInstances.map(si => ({
                id: si.id,
                name: si.template.name,
                code: si.template.code,
            })),
            grades,
        };
    }

    /**
     * Get all grades for a single student.
     */
    async getStudentGrades(schoolId: string, studentId: string, semesterId?: string) {
        const student = await this.prisma.studentProfile.findUnique({
            where: { id: studentId },
            include: { user: { select: { firstName: true, lastName: true } } },
        });
        if (!student) throw new NotFoundException('Student not found');

        const where: any = { schoolId, studentId };
        if (semesterId) where.semesterId = semesterId;

        const grades = await this.prisma.grade.findMany({
            where,
            include: {
                subjectInstance: { include: { template: true } },
                teacherProfile: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { date: 'desc' },
        });

        return { student, grades };
    }

    /**
     * Calculate weighted average for a student × subject.
     */
    async calculateWeightedAverage(studentId: string, subjectInstanceId: string): Promise<number> {
        const grades = await this.prisma.grade.findMany({
            where: { studentId, subjectInstanceId, type: 'NUMERIC' },
        });

        if (grades.length === 0) return 0;

        let totalWeightedScore = 0;
        let totalWeight = 0;

        for (const grade of grades) {
            const value = parseFloat(grade.value);
            if (!isNaN(value)) {
                totalWeightedScore += value * grade.weight;
                totalWeight += grade.weight;
            }
        }

        return totalWeight === 0 ? 0 : Math.round((totalWeightedScore / totalWeight) * 100) / 100;
    }

    // ─── REPORT CARDS ───────────────────────────────────────────

    async getReportCardsForClass(schoolId: string, classroomId: string, semesterId: string) {
        const classroom = await this.prisma.classroom.findUnique({
            where: { id: classroomId },
            include: {
                students: {
                    include: {
                        user: { select: { firstName: true, lastName: true } },
                        reportCards: {
                            where: { semesterId, schoolId },
                            include: {
                                subjectInstance: { include: { template: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!classroom || classroom.schoolId !== schoolId) {
            throw new NotFoundException('Classroom not found');
        }

        // Get all subject instances taught to this classroom
        const events = await this.prisma.scheduleEvent.findMany({
            where: { schoolId, classroomId },
            include: { subject: { include: { template: true } } },
            distinct: ['subjectInstanceId'],
        });

        const subjectInstances = events.map(e => ({
            id: e.subject.id,
            name: e.subject.template.name,
            code: e.subject.template.code,
        }));

        // Calculate averages for each student × subject
        const studentsData = await Promise.all(
            classroom.students.map(async (student) => {
                const subjectAverages = await Promise.all(
                    subjectInstances.map(async (si) => {
                        const avg = await this.calculateWeightedAverage(student.id, si.id);
                        const reportCard = student.reportCards.find(rc => rc.subjectInstanceId === si.id);
                        return {
                            subjectInstanceId: si.id,
                            average: avg,
                            reportCard: reportCard || null,
                        };
                    })
                );

                return {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    subjects: subjectAverages,
                };
            })
        );

        return {
            classroom: { id: classroom.id, name: classroom.name },
            subjects: subjectInstances,
            students: studentsData,
        };
    }

    async upsertReportCard(userId: string, schoolId: string, data: {
        studentId: string;
        subjectInstanceId: string;
        semesterId: string;
        finalGrade?: string;
        verbalEvaluation?: string;
        aiPolished?: boolean;
    }) {
        // Validate final grade
        if (data.finalGrade) {
            const validGrades = ['1', '2', '3', '4', '5', 'N'];
            if (!validGrades.includes(data.finalGrade)) {
                throw new BadRequestException('Final grade must be 1-5 or N.');
            }
        }

        const reportCard = await this.prisma.reportCard.upsert({
            where: {
                studentId_subjectInstanceId_semesterId: {
                    studentId: data.studentId,
                    subjectInstanceId: data.subjectInstanceId,
                    semesterId: data.semesterId,
                },
            },
            update: {
                ...(data.finalGrade !== undefined && { finalGrade: data.finalGrade }),
                ...(data.verbalEvaluation !== undefined && { verbalEvaluation: data.verbalEvaluation }),
                ...(data.aiPolished !== undefined && { aiPolished: data.aiPolished }),
            },
            create: {
                studentId: data.studentId,
                subjectInstanceId: data.subjectInstanceId,
                semesterId: data.semesterId,
                schoolId,
                finalGrade: data.finalGrade,
                verbalEvaluation: data.verbalEvaluation,
                aiPolished: data.aiPolished ?? false,
            },
            include: {
                subjectInstance: { include: { template: true } },
                studentProfile: true,
            },
        });

        await this.prisma.auditLog.create({
            data: {
                actorId: userId,
                action: 'UPSERT_REPORT_CARD',
                entity: 'ReportCard',
                entityId: reportCard.id,
                newValues: data,
            },
        });

        return reportCard;
    }

    // ─── AI POLISH ──────────────────────────────────────────────

    async polishVerbalEvaluation(userId: string, schoolId: string, data: {
        text: string;
        studentName: string;
        subjectName: string;
    }) {
        const prompt = `Jsi zkušený český učitel základní školy. Uprav následující slovní hodnocení žáka tak, aby bylo:
1. Přátelské a povzbuzující pro dítě i rodiče
2. Zachovávalo pravdivost a objektivitu – neodstraňuj negativní zpětnou vazbu, ale formuluj ji konstruktivně
3. Zdůrazňovalo klady a silné stránky žáka
4. Části, na kterých je potřeba zapracovat, formulovalo jako příležitosti ke zlepšení, ne jako kritiku
5. Bylo gramaticky správné a stylisticky jednotné
6. Mělo přiměřenou délku (2-4 věty)

Žák: ${data.studentName}
Předmět: ${data.subjectName}

Původní text:
${data.text}

Vrať pouze upravený text hodnocení, bez dalšího komentáře.`;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const polishedText = response.text().trim();

            // Track token usage
            await this.prisma.aiTokenUsage.create({
                data: {
                    userId,
                    schoolId,
                    provider: 'google',
                    modelName: 'gemini-pro',
                    inputTokens: prompt.length,
                    outputTokens: polishedText.length,
                    totalTokens: prompt.length + polishedText.length,
                    promptType: 'GRADE_POLISH',
                },
            });

            return { polishedText };
        } catch (error) {
            throw new BadRequestException('AI service unavailable. Please try again later.');
        }
    }

    // ─── GRADING TYPES ──────────────────────────────────────────

    /**
     * Get grading type settings for subjects in a classroom's curriculum.
     */
    async getGradingTypesForClassroom(schoolId: string, classroomId: string) {
        const classroom = await this.prisma.classroom.findUnique({
            where: { id: classroomId },
            select: { grade: true },
        });
        if (!classroom) throw new NotFoundException('Classroom not found');

        // Find the grade level matching this classroom's grade number
        const gradeLevel = await this.prisma.gradeLevel.findFirst({
            where: { schoolId, levelNumber: classroom.grade },
        });

        if (!gradeLevel) return [];

        // Get curriculum entries for this grade level from the active version
        const currentYear = await this.prisma.academicYear.findFirst({
            where: { schoolId, isCurrent: true },
            select: { curriculumVersionId: true },
        });

        if (!currentYear?.curriculumVersionId) return [];

        const entries = await this.prisma.curriculumEntry.findMany({
            where: {
                curriculumVersionId: currentYear.curriculumVersionId,
                gradeLevelId: gradeLevel.id,
            },
            include: {
                subjectTemplate: true,
            },
        });

        return entries.map(e => ({
            subjectTemplateId: e.subjectTemplateId,
            subjectCode: e.subjectTemplate.code,
            subjectName: e.subjectTemplate.name,
            gradingType: e.gradingType,
        }));
    }

    // ─── BEHAVIOR GRADES ─────────────────────────────────────────

    async upsertBehaviorGrade(schoolId: string, data: { studentId: string; semesterId: string; grade: number; note?: string }) {
        if (data.grade < 1 || data.grade > 3) throw new BadRequestException('Behavior grade must be 1-3.');
        return this.prisma.behaviorGrade.upsert({
            where: { studentId_semesterId: { studentId: data.studentId, semesterId: data.semesterId } },
            update: { grade: data.grade, note: data.note },
            create: { studentId: data.studentId, semesterId: data.semesterId, grade: data.grade, note: data.note, schoolId },
            include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        });
    }

    async getBehaviorGrades(schoolId: string, classroomId: string, semesterId: string) {
        const classroom = await this.prisma.classroom.findUnique({
            where: { id: classroomId },
            include: { students: { select: { id: true, firstName: true, lastName: true } } },
        });
        if (!classroom || classroom.schoolId !== schoolId) throw new NotFoundException('Classroom not found');

        const grades = await this.prisma.behaviorGrade.findMany({
            where: { schoolId, semesterId, studentId: { in: classroom.students.map(s => s.id) } },
        });

        return { classroom: { id: classroom.id, name: classroom.name }, students: classroom.students, grades };
    }

    // ─── COMPETENCY GRADES ──────────────────────────────────────

    async upsertCompetencyGrade(userId: string, schoolId: string, data: {
        studentId: string; competencyId: string; subjectInstanceId: string;
        semesterId: string; level: number; note?: string;
    }) {
        if (data.level < 1 || data.level > 4) throw new BadRequestException('Competency level must be 1-4.');
        const teacher = await this.getTeacherProfile(userId);
        return this.prisma.competencyGrade.upsert({
            where: {
                studentId_competencyId_subjectInstanceId_semesterId: {
                    studentId: data.studentId, competencyId: data.competencyId,
                    subjectInstanceId: data.subjectInstanceId, semesterId: data.semesterId,
                },
            },
            update: { level: data.level, note: data.note },
            create: { ...data, schoolId, teacherId: teacher.id },
            include: { competency: true, student: true, subjectInstance: { include: { template: true } } },
        });
    }

    async getCompetencyGrades(schoolId: string, studentId: string, semesterId?: string) {
        const where: any = { schoolId, studentId };
        if (semesterId) where.semesterId = semesterId;
        return this.prisma.competencyGrade.findMany({
            where,
            include: {
                competency: true,
                subjectInstance: { include: { template: true } },
                teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
        });
    }

    // ─── EDUCATIONAL MEASURES ───────────────────────────────────

    async createMeasure(userId: string, schoolId: string, data: {
        studentId: string; type: any; reason: string; semesterId?: string;
    }) {
        return this.prisma.educationalMeasure.create({
            data: { ...data, issuedById: userId, schoolId },
            include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
                issuedBy: { select: { firstName: true, lastName: true } },
            },
        });
    }

    async getMeasures(schoolId: string, filters?: { classroomId?: string; studentId?: string; semesterId?: string }) {
        const where: any = { schoolId };
        if (filters?.studentId) where.studentId = filters.studentId;
        if (filters?.semesterId) where.semesterId = filters.semesterId;
        if (filters?.classroomId) {
            const classroom = await this.prisma.classroom.findUnique({
                where: { id: filters.classroomId },
                select: { students: { select: { id: true } } },
            });
            if (classroom) where.studentId = { in: classroom.students.map(s => s.id) };
        }
        return this.prisma.educationalMeasure.findMany({
            where,
            include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
                issuedBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { date: 'desc' },
        });
    }

    async deleteMeasure(schoolId: string, id: string) {
        const measure = await this.prisma.educationalMeasure.findFirst({ where: { id, schoolId } });
        if (!measure) throw new NotFoundException('Measure not found');
        await this.prisma.educationalMeasure.delete({ where: { id } });
        return { success: true };
    }

    // ─── GRADE HISTORY (for charts) ─────────────────────────────

    async getGradeHistory(schoolId: string, studentId: string, subjectInstanceId: string) {
        return this.prisma.grade.findMany({
            where: { schoolId, studentId, subjectInstanceId, type: 'NUMERIC' },
            select: { id: true, value: true, date: true, weight: true, description: true, category: true },
            orderBy: { date: 'asc' },
        });
    }

    // ─── REPORT CARD HTML EXPORT ────────────────────────────────

    async getReportCardHtml(schoolId: string, classroomId: string, semesterId: string) {
        const data = await this.getReportCardsForClass(schoolId, classroomId, semesterId);
        const semester = await this.prisma.semester.findUnique({
            where: { id: semesterId },
            include: { academicYear: true },
        });

        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Vysvědčení – ${data.classroom.name}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11px; }
          h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
          th { background: #f0f0f0; }
          .student-name { text-align: left; font-weight: bold; }
          @media print { .page-break { page-break-before: always; } body { margin: 0; } }
        </style></head><body>`;
        html += `<h2>Vysvědčení: ${data.classroom.name} – ${semester?.academicYear?.name || ''} (${semester?.name || ''})</h2>`;
        html += '<table><thead><tr><th>Student</th>';
        for (const subj of data.subjects) html += `<th>${subj.name}</th>`;
        html += '</tr></thead><tbody>';

        for (const student of data.students) {
            html += `<tr><td class="student-name">${student.lastName} ${student.firstName}</td>`;
            for (const subj of data.subjects) {
                const subjData = student.subjects.find((s: any) => s.subjectInstanceId === subj.id);
                const grade = subjData?.reportCard?.finalGrade || '-';
                html += `<td>${grade}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table></body></html>';
        return html;
    }

    // ─── COMMISSION EXAMS ───────────────────────────────────────

    async createCommissionExam(schoolId: string, data: {
        date: string; originalGrade: string; studentId: string;
        subjectInstanceId: string; semesterId: string; note?: string;
    }) {
        return this.prisma.commissionExam.create({
            data: {
                date: new Date(data.date),
                originalGrade: data.originalGrade,
                note: data.note,
                studentId: data.studentId,
                subjectInstanceId: data.subjectInstanceId,
                semesterId: data.semesterId,
                schoolId,
            },
            include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
                subjectInstance: { include: { template: true } },
            },
        });
    }

    async getCommissionExams(schoolId: string, filters?: { classroomId?: string; semesterId?: string }) {
        const where: any = { schoolId };
        if (filters?.semesterId) where.semesterId = filters.semesterId;
        if (filters?.classroomId) {
            const classroom = await this.prisma.classroom.findUnique({
                where: { id: filters.classroomId },
                select: { students: { select: { id: true } } },
            });
            if (classroom) where.studentId = { in: classroom.students.map(s => s.id) };
        }
        return this.prisma.commissionExam.findMany({
            where,
            include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
                subjectInstance: { include: { template: true } },
            },
            orderBy: { date: 'desc' },
        });
    }

    async updateCommissionExam(schoolId: string, id: string, data: { newGrade?: string; note?: string; date?: string }) {
        const exam = await this.prisma.commissionExam.findFirst({ where: { id, schoolId } });
        if (!exam) throw new NotFoundException('Commission exam not found');
        return this.prisma.commissionExam.update({
            where: { id },
            data: {
                ...(data.newGrade !== undefined && { newGrade: data.newGrade }),
                ...(data.note !== undefined && { note: data.note }),
                ...(data.date && { date: new Date(data.date) }),
            },
            include: {
                student: { include: { user: { select: { firstName: true, lastName: true } } } },
                subjectInstance: { include: { template: true } },
            },
        });
    }

    async deleteCommissionExam(schoolId: string, id: string) {
        const exam = await this.prisma.commissionExam.findFirst({ where: { id, schoolId } });
        if (!exam) throw new NotFoundException('Commission exam not found');
        await this.prisma.commissionExam.delete({ where: { id } });
        return { success: true };
    }

    // ─── CLASSIFICATION DEADLINE ────────────────────────────────

    async getDeadline(schoolId: string, semesterId: string) {
        return this.prisma.classificationDeadline.findUnique({
            where: { semesterId_schoolId: { semesterId, schoolId } },
        });
    }

    async upsertDeadline(schoolId: string, data: { semesterId: string; deadline: string; isLocked?: boolean }) {
        return this.prisma.classificationDeadline.upsert({
            where: { semesterId_schoolId: { semesterId: data.semesterId, schoolId } },
            update: { deadline: new Date(data.deadline), ...(data.isLocked !== undefined && { isLocked: data.isLocked }) },
            create: { semesterId: data.semesterId, schoolId, deadline: new Date(data.deadline), isLocked: data.isLocked ?? false },
        });
    }

    async lockClassification(schoolId: string, semesterId: string, lock: boolean) {
        return this.prisma.classificationDeadline.upsert({
            where: { semesterId_schoolId: { semesterId, schoolId } },
            update: { isLocked: lock },
            create: { semesterId, schoolId, deadline: new Date(), isLocked: lock },
        });
    }

    // ─── HELPERS ────────────────────────────────────────────────

    private async getTeacherProfile(userId: string) {
        const profile = await this.prisma.teacherProfile.findUnique({
            where: { userId },
        });
        if (!profile) throw new NotFoundException('Teacher profile not found');
        return profile;
    }
}
