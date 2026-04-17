import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeputyCurriculumService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new BadRequestException(
        `Grade level #${data.levelNumber} already exists.`,
      );
    }

    const level = await this.prisma.gradeLevel.create({
      data: {
        name: data.name,
        levelNumber: data.levelNumber,
        schoolId,
      },
    });

    await this.audit(
      actorId,
      'CREATE_GRADE_LEVEL',
      'GradeLevel',
      level.id,
      data,
    );
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

    if (
      data.levelNumber !== undefined &&
      data.levelNumber !== existing.levelNumber
    ) {
      const conflict = await this.prisma.gradeLevel.findFirst({
        where: { schoolId, levelNumber: data.levelNumber, id: { not: id } },
      });
      if (conflict) {
        throw new BadRequestException(
          `Grade level #${data.levelNumber} already exists.`,
        );
      }
    }

    const updated = await this.prisma.gradeLevel.update({
      where: { id },
      data,
    });

    await this.audit(
      actorId,
      'UPDATE_GRADE_LEVEL',
      'GradeLevel',
      id,
      data,
      existing,
    );
    return updated;
  }

  async deleteGradeLevel(actorId: string, schoolId: string, id: string) {
    const existing = await this.prisma.gradeLevel.findFirst({
      where: { id, schoolId },
    });
    if (!existing) throw new NotFoundException('Grade level not found.');

    await this.prisma.gradeLevel.delete({ where: { id } });
    await this.audit(
      actorId,
      'DELETE_GRADE_LEVEL',
      'GradeLevel',
      id,
      null,
      existing,
    );
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
    if (!year)
      throw new NotFoundException('Academic year not found in this school.');

    return this.prisma.teacherWorkload.findMany({
      where: { academicYearId },
      include: { teacher: true },
    });
  }

  // ─── SAVE: TEACHER WORKLOAD ────────────────────────────────────

  async saveTeacherWorkload(
    actorId: string,
    schoolId: string,
    data: {
      teacherId: string;
      academicYearId: string;
      workloadPercentage: number;
    },
  ) {
    // Validate academic year belongs to school
    const year = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId },
    });
    if (!year)
      throw new NotFoundException('Academic year not found in this school.');

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

    await this.audit(
      actorId,
      'SAVE_TEACHER_WORKLOAD',
      'TeacherWorkload',
      workload.id,
      data,
    );
    return workload;
  }

  // ─── GET: SUBJECT INSTANCES ─────────────────────────────────────

  async getSubjectInstances(schoolId: string, academicYearId: string) {
    // Validate academic year belongs to school
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!year)
      throw new NotFoundException('Academic year not found in this school.');

    return this.prisma.subjectInstance.findMany({
      where: { schoolId, academicYearId },
      include: { template: true, gradeLevel: true },
    });
  }

  // ─── CREATE: ACADEMIC YEAR ──────────────────────────────────────

  async createAcademicYear(
    actorId: string,
    schoolId: string,
    data: {
      name: string;
      startDate: string;
      endDate: string;
      isCurrent?: boolean;
      curriculumVersionId?: string;
    },
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
      if (!version)
        throw new NotFoundException(
          'Curriculum version not found in this school.',
        );
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

    await this.audit(
      actorId,
      'CREATE_ACADEMIC_YEAR',
      'AcademicYear',
      academicYear.id,
      data,
    );
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
    if (!template)
      throw new NotFoundException('Subject template not found in this school.');

    // Validate academic year belongs to this school
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId },
    });
    if (!academicYear)
      throw new NotFoundException('Academic year not found in this school.');

    // Validate grade level belongs to this school
    const gradeLevel = await this.prisma.gradeLevel.findFirst({
      where: { id: data.gradeLevelId, schoolId },
    });
    if (!gradeLevel)
      throw new NotFoundException('Grade level not found in this school.');

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

    await this.audit(
      actorId,
      'CREATE_SUBJECT_INSTANCE',
      'SubjectInstance',
      instance.id,
      {
        templateName: template.name,
        academicYear: academicYear.name,
        gradeLevel: gradeLevel.name,
        hoursPerWeek: data.hoursPerWeek,
      },
    );

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

    await this.audit(
      actorId,
      'CREATE_CURRICULUM_VERSION',
      'CurriculumVersion',
      version.id,
      data,
    );
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
    if (data.validFrom !== undefined)
      updateData.validFrom = new Date(data.validFrom);
    if (data.validTo !== undefined)
      updateData.validTo = data.validTo ? new Date(data.validTo) : null;

    const updated = await this.prisma.curriculumVersion.update({
      where: { id: versionId },
      data: updateData,
      include: this.versionIncludes(),
    });

    await this.audit(
      actorId,
      'UPDATE_CURRICULUM_VERSION',
      'CurriculumVersion',
      versionId,
      data,
    );
    return updated;
  }

  async deleteCurriculumVersion(
    actorId: string,
    schoolId: string,
    versionId: string,
  ) {
    const version = await this.prisma.curriculumVersion.findFirst({
      where: { id: versionId, schoolId },
    });
    if (!version) throw new NotFoundException('Curriculum version not found.');

    await this.prisma.curriculumVersion.delete({ where: { id: versionId } });
    await this.audit(
      actorId,
      'DELETE_CURRICULUM_VERSION',
      'CurriculumVersion',
      versionId,
      {},
    );
    return { deleted: true };
  }

  // ─── DUPLICATE VERSION ──────────────────────────────────────────

  async duplicateCurriculumVersion(
    actorId: string,
    schoolId: string,
    sourceVersionId: string,
    data: { name: string; validFrom: string; validTo?: string },
  ) {
    const source = await this.prisma.curriculumVersion.findFirst({
      where: { id: sourceVersionId, schoolId },
      include: { entries: true },
    });
    if (!source) throw new NotFoundException('Source version not found.');

    const newVersion = await this.prisma.curriculumVersion.create({
      data: {
        name: data.name,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : null,
        schoolId,
      },
    });

    // Copy all entries
    if (source.entries.length > 0) {
      await this.prisma.curriculumEntry.createMany({
        data: source.entries.map((e) => ({
          curriculumVersionId: newVersion.id,
          subjectTemplateId: e.subjectTemplateId,
          gradeLevelId: e.gradeLevelId,
          hoursPerWeek: e.hoursPerWeek,
          rvpDescription: e.rvpDescription,
          svpApproach: e.svpApproach,
          equipmentRequirements: e.equipmentRequirements as any,
          needsComputerLab: e.needsComputerLab,
        })),
      });
    }

    await this.audit(
      actorId,
      'DUPLICATE_CURRICULUM_VERSION',
      'CurriculumVersion',
      newVersion.id,
      {
        sourceVersionId,
        entriesCopied: source.entries.length,
      },
    );

    return this.getCurriculumVersion(schoolId, newVersion.id);
  }

  // ─── COMPARE VERSIONS ───────────────────────────────────────────

  async compareCurriculumVersions(
    schoolId: string,
    versionAId: string,
    versionBId: string,
  ) {
    const [versionA, versionB] = await Promise.all([
      this.prisma.curriculumVersion.findFirst({
        where: { id: versionAId, schoolId },
        include: {
          entries: { include: { subjectTemplate: true, gradeLevel: true } },
        },
      }),
      this.prisma.curriculumVersion.findFirst({
        where: { id: versionBId, schoolId },
        include: {
          entries: { include: { subjectTemplate: true, gradeLevel: true } },
        },
      }),
    ]);

    if (!versionA) throw new NotFoundException('Version A not found.');
    if (!versionB) throw new NotFoundException('Version B not found.');

    // Build maps: subjectId → { gradeLevelId → entry }
    type EntryMap = Map<
      string,
      Map<
        string,
        {
          hoursPerWeek: number;
          rvpDescription: string | null;
          svpApproach: string | null;
          needsComputerLab: boolean;
        }
      >
    >;

    const buildMap = (entries: any[]): EntryMap => {
      const map: EntryMap = new Map();
      for (const e of entries) {
        if (!map.has(e.subjectTemplateId))
          map.set(e.subjectTemplateId, new Map());
        map.get(e.subjectTemplateId)!.set(e.gradeLevelId, {
          hoursPerWeek: e.hoursPerWeek,
          rvpDescription: e.rvpDescription,
          svpApproach: e.svpApproach,
          needsComputerLab: e.needsComputerLab,
        });
      }
      return map;
    };

    const mapA = buildMap(versionA.entries);
    const mapB = buildMap(versionB.entries);

    // Collect all subject IDs and grade levels
    const allSubjectIds = new Set([...mapA.keys(), ...mapB.keys()]);

    // Subject info lookup
    const subjectInfo: Record<string, { name: string; code: string }> = {};
    const gradeInfo: Record<string, { name: string; levelNumber: number }> = {};

    for (const e of [...versionA.entries, ...versionB.entries]) {
      subjectInfo[e.subjectTemplateId] = {
        name: e.subjectTemplate.name,
        code: e.subjectTemplate.code,
      };
      gradeInfo[e.gradeLevelId] = {
        name: e.gradeLevel.name,
        levelNumber: e.gradeLevel.levelNumber,
      };
    }

    // All grade levels sorted
    const allGradeLevels = Object.entries(gradeInfo)
      .map(([id, info]) => ({ id, ...info }))
      .sort((a, b) => a.levelNumber - b.levelNumber);

    // Build comparison
    const added: any[] = [];
    const removed: any[] = [];
    const changed: any[] = [];
    const unchanged: any[] = [];

    for (const subjectId of allSubjectIds) {
      const inA = mapA.has(subjectId);
      const inB = mapB.has(subjectId);
      const info = subjectInfo[subjectId];

      if (!inA && inB) {
        // Added in B
        const grades = Array.from(mapB.get(subjectId)!.entries()).map(
          ([glId, data]) => ({
            gradeLevelId: glId,
            ...gradeInfo[glId],
            hoursPerWeek: data.hoursPerWeek,
          }),
        );
        added.push({
          subjectId,
          ...info,
          grades,
          totalHours: grades.reduce((s, g) => s + g.hoursPerWeek, 0),
        });
      } else if (inA && !inB) {
        // Removed from B
        const grades = Array.from(mapA.get(subjectId)!.entries()).map(
          ([glId, data]) => ({
            gradeLevelId: glId,
            ...gradeInfo[glId],
            hoursPerWeek: data.hoursPerWeek,
          }),
        );
        removed.push({
          subjectId,
          ...info,
          grades,
          totalHours: grades.reduce((s, g) => s + g.hoursPerWeek, 0),
        });
      } else if (inA && inB) {
        // Both exist – check for differences
        const gradesA = mapA.get(subjectId)!;
        const gradesB = mapB.get(subjectId)!;
        const allGrades = new Set([...gradesA.keys(), ...gradesB.keys()]);
        let hasChanges = false;
        const gradeDiffs: any[] = [];

        for (const glId of allGrades) {
          const a = gradesA.get(glId);
          const b = gradesB.get(glId);
          const gInfo = gradeInfo[glId];

          if (!a && b) {
            hasChanges = true;
            gradeDiffs.push({
              gradeLevelId: glId,
              ...gInfo,
              hoursA: 0,
              hoursB: b.hoursPerWeek,
              diff: b.hoursPerWeek,
              status: 'added',
            });
          } else if (a && !b) {
            hasChanges = true;
            gradeDiffs.push({
              gradeLevelId: glId,
              ...gInfo,
              hoursA: a.hoursPerWeek,
              hoursB: 0,
              diff: -a.hoursPerWeek,
              status: 'removed',
            });
          } else if (a && b) {
            const diff = b.hoursPerWeek - a.hoursPerWeek;
            if (diff !== 0) hasChanges = true;
            gradeDiffs.push({
              gradeLevelId: glId,
              ...gInfo,
              hoursA: a.hoursPerWeek,
              hoursB: b.hoursPerWeek,
              diff,
              status: diff === 0 ? 'same' : 'changed',
            });
          }
        }

        gradeDiffs.sort((a, b) => a.levelNumber - b.levelNumber);

        const totalA = gradeDiffs.reduce((s, g) => s + g.hoursA, 0);
        const totalB = gradeDiffs.reduce((s, g) => s + g.hoursB, 0);

        if (hasChanges) {
          changed.push({
            subjectId,
            ...info,
            grades: gradeDiffs,
            totalHoursA: totalA,
            totalHoursB: totalB,
            totalDiff: totalB - totalA,
          });
        } else {
          unchanged.push({
            subjectId,
            ...info,
            totalHours: totalA,
            gradeCount: gradeDiffs.length,
          });
        }
      }
    }

    // Sort all by subject name
    const sortByName = (a: any, b: any) => a.name.localeCompare(b.name);
    added.sort(sortByName);
    removed.sort(sortByName);
    changed.sort(sortByName);
    unchanged.sort(sortByName);

    return {
      versionA: {
        id: versionA.id,
        name: versionA.name,
        validFrom: versionA.validFrom,
        entryCount: versionA.entries.length,
      },
      versionB: {
        id: versionB.id,
        name: versionB.name,
        validFrom: versionB.validFrom,
        entryCount: versionB.entries.length,
      },
      gradeLevels: allGradeLevels,
      summary: {
        addedCount: added.length,
        removedCount: removed.length,
        changedCount: changed.length,
        unchangedCount: unchanged.length,
        totalHoursA: [...mapA.values()].reduce(
          (s, m) =>
            s + [...m.values()].reduce((s2, e) => s2 + e.hoursPerWeek, 0),
          0,
        ),
        totalHoursB: [...mapB.values()].reduce(
          (s, m) =>
            s + [...m.values()].reduce((s2, e) => s2 + e.hoursPerWeek, 0),
          0,
        ),
      },
      added,
      removed,
      changed,
      unchanged,
    };
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
      gradingType?: string;
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
        gradingType: data.gradingType ?? 'BOTH',
      },
      update: {
        hoursPerWeek: data.hoursPerWeek,
        rvpDescription: data.rvpDescription,
        svpApproach: data.svpApproach,
        equipmentRequirements: data.equipmentRequirements,
        needsComputerLab: data.needsComputerLab,
        ...(data.gradingType !== undefined && {
          gradingType: data.gradingType,
        }),
      },
      include: { subjectTemplate: true, gradeLevel: true },
    });

    await this.audit(
      actorId,
      'SAVE_CURRICULUM_ENTRY',
      'CurriculumEntry',
      entry.id,
      data,
    );
    return entry;
  }

  async deleteCurriculumEntry(
    actorId: string,
    schoolId: string,
    entryId: string,
  ) {
    const entry = await this.prisma.curriculumEntry.findFirst({
      where: { id: entryId, curriculumVersion: { schoolId } },
    });
    if (!entry) throw new NotFoundException('Curriculum entry not found.');

    await this.prisma.curriculumEntry.delete({ where: { id: entryId } });
    await this.audit(
      actorId,
      'DELETE_CURRICULUM_ENTRY',
      'CurriculumEntry',
      entryId,
      {},
    );
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

  async getSemesters(schoolId: string, academicYearId?: string) {
    const where: any = { academicYear: { schoolId } };
    if (academicYearId) where.academicYearId = academicYearId;
    return this.prisma.semester.findMany({
      where,
      orderBy: { number: 'asc' },
    });
  }

  async createSemesters(
    actorId: string,
    schoolId: string,
    data: {
      academicYearId: string;
      semesters: Array<{
        number: number;
        name: string;
        startDate: string;
        endDate: string;
      }>;
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

    await this.audit(
      actorId,
      'CREATE_SEMESTERS',
      'Semester',
      data.academicYearId,
      data,
    );
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
    if (!academicYear)
      throw new NotFoundException('Academic year not found in this school.');

    // Validate grade level belongs to this school
    const gradeLevel = await this.prisma.gradeLevel.findFirst({
      where: { id: data.gradeLevelId, schoolId },
    });
    if (!gradeLevel)
      throw new NotFoundException('Grade level not found in this school.');

    // Validate classroom if provided
    if (data.classroomId) {
      const classroom = await this.prisma.classroom.findFirst({
        where: { id: data.classroomId, schoolId },
      });
      if (!classroom)
        throw new NotFoundException('Classroom not found in this school.');
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
    const invalidIds = data.studentIds.filter(
      (id) => !validStudentIds.includes(id),
    );
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

    await this.audit(
      actorId,
      'BATCH_ENROLL_STUDENTS',
      'StudentEnrollment',
      'batch',
      {
        count: enrollments.length,
        academicYear: academicYear.name,
        gradeLevel: gradeLevel.name,
        studentIds: data.studentIds,
      },
    );

    return { enrolled: enrollments.length, enrollments };
  }

  // ─── GET: SUBJECT TEMPLATES ─────────────────────────────────────

  async getSubjectTemplates(schoolId: string) {
    return this.prisma.subjectTemplate.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });
  }

  // ─── STAFF WORKLOADS (versioned) ────────────────────────────────

  async getSchoolStaff(schoolId: string) {
    const memberships = await this.prisma.schoolMembership.findMany({
      where: {
        schoolId,
        status: 'ACTIVE',
        role: { notIn: ['STUDENT', 'PARENT'] },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
    return memberships.map((m) => ({
      id: m.userId,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
    }));
  }

  async getStaffWorkloads(schoolId: string, academicYearId: string) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId },
    });
    if (!year)
      throw new NotFoundException('Academic year not found in this school.');

    return this.prisma.staffWorkload.findMany({
      where: { academicYearId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subjectAssignments: {
          include: { subjectTemplate: true },
          orderBy: { subjectTemplate: { name: 'asc' } },
        },
      },
      orderBy: [{ validFrom: 'desc' }, { user: { lastName: 'asc' } }],
    });
  }

  async createStaffWorkload(
    actorId: string,
    schoolId: string,
    data: {
      userId: string;
      academicYearId: string;
      versionLabel: string;
      validFrom: string;
      teachingLoad: number;
      adminLoad: number;
      note?: string;
    },
  ) {
    const year = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId },
    });
    if (!year)
      throw new NotFoundException('Academic year not found in this school.');

    // Validate user is a staff member of this school
    const membership = await this.prisma.schoolMembership.findFirst({
      where: {
        userId: data.userId,
        schoolId,
        status: 'ACTIVE',
        role: { notIn: ['STUDENT', 'PARENT'] },
      },
    });
    if (!membership)
      throw new NotFoundException(
        'User is not an active staff member of this school.',
      );

    const workload = await this.prisma.staffWorkload.create({
      data: {
        userId: data.userId,
        academicYearId: data.academicYearId,
        versionLabel: data.versionLabel,
        validFrom: new Date(data.validFrom),
        teachingLoad: data.teachingLoad,
        adminLoad: data.adminLoad,
        note: data.note,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subjectAssignments: { include: { subjectTemplate: true } },
      },
    });

    await this.audit(
      actorId,
      'CREATE_STAFF_WORKLOAD',
      'StaffWorkload',
      workload.id,
      data,
    );
    return workload;
  }

  async updateStaffWorkload(
    actorId: string,
    schoolId: string,
    workloadId: string,
    data: {
      versionLabel?: string;
      validFrom?: string;
      teachingLoad?: number;
      adminLoad?: number;
      note?: string | null;
    },
  ) {
    const workload = await this.prisma.staffWorkload.findFirst({
      where: { id: workloadId, academicYear: { schoolId } },
    });
    if (!workload) throw new NotFoundException('Staff workload not found.');

    const updateData: any = {};
    if (data.versionLabel !== undefined)
      updateData.versionLabel = data.versionLabel;
    if (data.validFrom !== undefined)
      updateData.validFrom = new Date(data.validFrom);
    if (data.teachingLoad !== undefined)
      updateData.teachingLoad = data.teachingLoad;
    if (data.adminLoad !== undefined) updateData.adminLoad = data.adminLoad;
    if (data.note !== undefined) updateData.note = data.note;

    const updated = await this.prisma.staffWorkload.update({
      where: { id: workloadId },
      data: updateData,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subjectAssignments: { include: { subjectTemplate: true } },
      },
    });

    await this.audit(
      actorId,
      'UPDATE_STAFF_WORKLOAD',
      'StaffWorkload',
      workloadId,
      data,
      workload,
    );
    return updated;
  }

  async deleteStaffWorkload(
    actorId: string,
    schoolId: string,
    workloadId: string,
  ) {
    const workload = await this.prisma.staffWorkload.findFirst({
      where: { id: workloadId, academicYear: { schoolId } },
    });
    if (!workload) throw new NotFoundException('Staff workload not found.');

    await this.prisma.staffWorkload.delete({ where: { id: workloadId } });
    await this.audit(
      actorId,
      'DELETE_STAFF_WORKLOAD',
      'StaffWorkload',
      workloadId,
      {},
      workload,
    );
    return { deleted: true };
  }

  async saveStaffSubjectAssignments(
    actorId: string,
    schoolId: string,
    workloadId: string,
    assignments: Array<{
      subjectTemplateId: string;
      gradeLevelIds: string[];
      canSubstitute: boolean;
    }>,
  ) {
    const workload = await this.prisma.staffWorkload.findFirst({
      where: { id: workloadId, academicYear: { schoolId } },
    });
    if (!workload) throw new NotFoundException('Staff workload not found.');

    // Delete existing and recreate (simpler than diffing)
    await this.prisma.staffSubjectAssignment.deleteMany({
      where: { staffWorkloadId: workloadId },
    });

    if (assignments.length > 0) {
      await this.prisma.staffSubjectAssignment.createMany({
        data: assignments.map((a) => ({
          staffWorkloadId: workloadId,
          subjectTemplateId: a.subjectTemplateId,
          gradeLevelIds: a.gradeLevelIds,
          canSubstitute: a.canSubstitute,
        })),
      });
    }

    // Return full workload with assignments
    const result = await this.prisma.staffWorkload.findUnique({
      where: { id: workloadId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subjectAssignments: { include: { subjectTemplate: true } },
      },
    });

    await this.audit(
      actorId,
      'SAVE_STAFF_SUBJECT_ASSIGNMENTS',
      'StaffWorkload',
      workloadId,
      { assignments },
    );
    return result;
  }

  // ─── AUDIT HELPER ───────────────────────────────────────────────

  private async audit(
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    newValues?: any,
    oldValues?: any,
  ) {
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
