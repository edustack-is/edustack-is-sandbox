import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ════════════════════════════════════════════════════════
// RESPONSE DTOs matching actual DatabaseService returns
// Examples use realistic UUID and ISO date formats
// ════════════════════════════════════════════════════════

// ─── CLASSROOM ──────────────────────────────────────────
export class ClassroomResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: '5.A' }) name: string;
  @ApiProperty({ example: 5 }) grade: number;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  homeroomTeacherId?: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) updatedAt: string;
  @ApiPropertyOptional({
    description: 'Studenti (include)',
    example: [
      {
        id: 'sp-uuid',
        userId: 'u-uuid',
        classroomId: 'cr-uuid',
        user: { firstName: 'Jan', lastName: 'Novák' },
      },
    ],
  })
  students?: Array<{
    id: string;
    userId: string;
    classroomId: string;
    user: { firstName: string; lastName: string };
  }>;
  @ApiPropertyOptional({
    description: 'Třídní učitel (include)',
    example: {
      id: 'tp-uuid',
      userId: 'u-uuid',
      user: { firstName: 'Marie', lastName: 'Svobodová' },
    },
  })
  homeroomTeacher?: {
    id: string;
    userId: string;
    user: { firstName: string; lastName: string };
  };
}

// ─── SUBJECT TEMPLATE ───────────────────────────────────
export class SubjectResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Matematika' }) name: string;
  @ApiProperty({ example: 'MAT' }) code: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiPropertyOptional({ example: 'Rozvoj matematických kompetencí' })
  svpDescription?: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── ROOM ───────────────────────────────────────────────
export class RoomResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Učebna 101' }) name: string;
  @ApiPropertyOptional({ example: 30 }) capacity?: number;
  @ApiPropertyOptional({ example: false }) isComputerLab?: boolean;
  @ApiPropertyOptional({ example: ['projektor', 'interaktivní tabule'] })
  specialEquipment?: string[];
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  buildingId?: string;
  @ApiPropertyOptional({ example: 1 }) floor?: number;
}

// ─── BUILDING ───────────────────────────────────────────
export class BuildingResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Hlavní budova' }) name: string;
  @ApiPropertyOptional({ example: 'Školní 123, Praha' }) address?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── EVENT ──────────────────────────────────────────────
export class SchoolEventResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Pedagogická rada' }) title: string;
  @ApiPropertyOptional({ example: 'Čtvrtletní hodnocení' })
  description?: string;
  @ApiProperty({ example: '2024-03-20T14:00:00.000Z' }) date: string;
  @ApiPropertyOptional({ example: '2024-03-20T16:00:00.000Z' })
  endDate?: string;
  @ApiPropertyOptional({ example: 'MEETING' }) type?: string;
  @ApiPropertyOptional({ example: false }) allDay?: boolean;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── SCHOOL USER ────────────────────────────────────────
export class SchoolUserResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'jan.novak@example.com' }) email: string;
  @ApiProperty({ example: 'Jan' }) firstName: string;
  @ApiProperty({ example: 'Novák' }) lastName: string;
  @ApiProperty({ example: false }) isSystemAdmin: boolean;
  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── STUDENT WITH FAMILY ────────────────────────────────
export class StudentFamilyResponseDto {
  @ApiProperty({
    description: 'Vytvořený student',
    example: {
      id: 'u-uuid',
      email: 'student@example.com',
      firstName: 'Jan',
      lastName: 'Novák',
    },
  })
  student: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  @ApiPropertyOptional({
    description: 'Vytvořený rodič',
    example: {
      id: 'u-uuid',
      email: 'rodic@example.com',
      firstName: 'Jana',
      lastName: 'Nováková',
    },
  })
  parent?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// ─── AUDIT LOG ENTRY ────────────────────────────────────
export class AuditLogEntryDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'UPDATE_USER' }) action: string;
  @ApiPropertyOptional({ example: 'User' }) entityType?: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  entityId?: string;
  @ApiPropertyOptional({ example: '{ "role": "TEACHER" }' }) details?: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  actorId?: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── SCHOOL SETTINGS ────────────────────────────────────
export class SchoolSettingsResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'ZŠ Příkladná' }) name: string;
  @ApiPropertyOptional({ example: 'Školní 123, Praha' }) address?: string;
  @ApiPropertyOptional({ example: 'NUMERIC' }) gradingSystem?: string;
  @ApiPropertyOptional({ example: false }) requireSsoEmailMatch?: boolean;
  @ApiProperty({ example: true }) isActive: boolean;
}

// ─── ACADEMIC YEAR ──────────────────────────────────────
export class AcademicYearResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: '2024/2025' }) name: string;
  @ApiProperty({ example: '2024-09-01T00:00:00.000Z' }) startDate: string;
  @ApiProperty({ example: '2025-06-30T00:00:00.000Z' }) endDate: string;
  @ApiProperty({ example: true }) isCurrent: boolean;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
}

// ─── GRADE LEVEL ────────────────────────────────────────
export class GradeLevelResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: '5. ročník' }) name: string;
  @ApiProperty({ example: 5 }) levelNumber: number;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
}

// ─── SUBJECT INSTANCE ───────────────────────────────────
export class SubjectInstanceResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 2 }) hoursPerWeek: number;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  templateId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  gradeLevelId: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  academicYearId: string;
  @ApiPropertyOptional({ example: 'NUMERIC' }) gradingType?: string;
}

// ─── TEACHER WORKLOAD ───────────────────────────────────
export class TeacherWorkloadResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 100 }) workloadPercentage: number;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  teacherProfileId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  academicYearId: string;
}

// ─── CURRICULUM VERSION ─────────────────────────────────
export class CurriculumVersionResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'ŠVP 2024 v1' }) name: string;
  @ApiProperty({ example: '2024-09-01T00:00:00.000Z' }) validFrom: string;
  @ApiPropertyOptional({ example: '2025-06-30T00:00:00.000Z' })
  validTo?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── CURRICULUM ENTRY ───────────────────────────────────
export class CurriculumEntryResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 2 }) hoursPerWeek: number;
  @ApiPropertyOptional({ example: 'NUMERIC' }) gradingType?: string;
  @ApiPropertyOptional({ example: 'Žák řeší matematické problémy...' })
  rvpDescription?: string;
  @ApiPropertyOptional({ example: 'Důraz na praktické úlohy' })
  svpApproach?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  versionId: string;
}

// ─── COMPETENCY ─────────────────────────────────────────
export class CompetencyResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Kompetence k učení' }) name: string;
  @ApiPropertyOptional({ example: 'Žák se učí efektivním strategiím...' })
  description?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
}

// ─── SEMESTER ───────────────────────────────────────────
export class SemesterResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 1 }) number: number;
  @ApiProperty({ example: '1. pololetí' }) name: string;
  @ApiProperty({ example: '2024-09-01T00:00:00.000Z' }) startDate: string;
  @ApiProperty({ example: '2025-01-31T00:00:00.000Z' }) endDate: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  academicYearId: string;
}

// ─── THEMATIC PLAN ──────────────────────────────────────
export class ThematicPlanResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiPropertyOptional({ example: 3 }) weekNumber?: number;
  @ApiPropertyOptional({ example: 'Lineární rovnice' }) topic?: string;
  @ApiPropertyOptional({ example: 'Žák řeší jednoduché rovnice' })
  objectives?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  subjectInstanceId: string;
}

// ─── TEACHING MATERIAL ──────────────────────────────────
export class TeachingMaterialResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Pracovní list – rovnice' }) title: string;
  @ApiPropertyOptional({ example: 'WORKSHEET' }) type?: string;
  @ApiPropertyOptional({ example: 'https://example.com/worksheet.pdf' })
  url?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  subjectInstanceId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── LESSON PLAN ────────────────────────────────────────
export class LessonPlanResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiPropertyOptional({ example: 'Úvod do zlomků' }) title?: string;
  @ApiPropertyOptional({ example: 'Žák pochopí pojem zlomek' })
  objectives?: string;
  @ApiPropertyOptional({ example: 'Skupinová práce, kvíz' })
  activities?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  subjectInstanceId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── ENROLLMENT ─────────────────────────────────────────
export class EnrollmentResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentProfileId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  gradeLevelId: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  classroomId: string;
  @ApiProperty({ example: 'c3a1f2d4-3333-3333-3333-1a2b3c4d5e6f' })
  academicYearId: string;
}

// ─── SCHEDULE EVENT ─────────────────────────────────────
export class ScheduleEventResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 1, description: '1=Po, 5=Pá' }) dayOfWeek: number;
  @ApiProperty({ example: 3 }) lessonNumber: number;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  subjectInstanceId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  classroomId: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  teacherId: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-3333-3333-3333-1a2b3c4d5e6f' })
  roomId?: string;
  @ApiProperty({ example: 'c3a1f2d4-4444-4444-4444-1a2b3c4d5e6f' })
  academicYearId: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── SCHEDULE MATRIX ────────────────────────────────────
export class ScheduleMatrixResponseDto {
  @ApiProperty({
    description: 'Pole rozvrhových událostí',
    type: [ScheduleEventResponseDto],
  })
  events: ScheduleEventResponseDto[];
  @ApiProperty({
    description: 'Časové sloty (zvonění)',
    example: [{ lessonNumber: 1, startTime: '08:00', endTime: '08:45' }],
  })
  timeSlots: Array<{
    lessonNumber: number;
    startTime: string;
    endTime: string;
  }>;
}

// ─── SUBSTITUTION ───────────────────────────────────────
export class SubstitutionResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: '2024-03-15T00:00:00.000Z' }) date: string;
  @ApiProperty({ example: 'SUBSTITUTION' }) type: string;
  @ApiPropertyOptional({ example: 'Učitel nemocen' }) note?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  originalEventId: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  substituteTeacherId?: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── COLLISION RESULT ──────────────────────────────────
export class CollisionResultDto {
  @ApiProperty({ example: false }) hasCollision: boolean;
  @ApiPropertyOptional({
    example: ['Učitel Novák má ve stejnou dobu jinou hodinu'],
    type: [String],
  })
  collisions?: string[];
}

// ─── SNAPSHOT ───────────────────────────────────────────
export class SnapshotResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Snapshot před změnami 15.3.' }) name: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── RECURRING EVENT ────────────────────────────────────
export class RecurringEventResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Kroužek robotiky' }) title: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── ATTENDANCE RECORD ──────────────────────────────────
export class AttendanceRecordResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  classroomId: string;
  @ApiProperty({ example: 'PRESENT' }) status: string;
  @ApiProperty({ example: '2024-03-15T00:00:00.000Z' }) date: string;
  @ApiProperty({ example: 3 }) lessonNumber: number;
  @ApiPropertyOptional({ example: 'Přišel pozdě 5 minut' }) note?: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── EXCUSE ─────────────────────────────────────────────
export class ExcuseResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'Nemoc' }) reason: string;
  @ApiProperty({ example: 'PENDING' }) status: string;
  @ApiProperty({ example: '2024-03-15T00:00:00.000Z' }) dateFrom: string;
  @ApiProperty({ example: '2024-03-17T00:00:00.000Z' }) dateTo: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  createdByUserId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── ATTENDANCE STATS ───────────────────────────────────
export class AttendanceStatsResponseDto {
  @ApiProperty({ example: 25 }) totalStudents: number;
  @ApiProperty({ example: 450 }) totalLessons: number;
  @ApiProperty({ example: 95.2 }) averageAttendancePercent: number;
  @ApiProperty({
    description: 'Statistiky per student',
    example: [
      {
        studentId: 'sp-uuid',
        name: 'Jan Novák',
        present: 43,
        absent: 2,
        late: 1,
        excused: 1,
        unexcused: 1,
      },
    ],
  })
  students: Array<{
    studentId: string;
    name: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    unexcused: number;
  }>;
}

// ─── UNEXCUSED ALERT ────────────────────────────────────
export class UnexcusedAlertDto {
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'Jan Novák' }) studentName: string;
  @ApiProperty({ example: 7 }) unexcusedCount: number;
}

// ─── CONVERSATION ───────────────────────────────────────
export class ConversationResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiPropertyOptional({ example: 'Dotaz k domácímu úkolu' }) subject?: string;
  @ApiProperty({ example: 'DIRECT' }) type: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
  @ApiProperty({
    description: 'Účastníci',
    example: [{ id: 'p-uuid', userId: 'u-uuid', conversationId: 'c-uuid' }],
  })
  participants: Array<{
    id: string;
    userId: string;
    conversationId: string;
    user?: { firstName: string; lastName: string };
  }>;
  @ApiPropertyOptional({
    description: 'Zprávy (include)',
    example: [
      {
        id: 'm-uuid',
        content: 'Dobrý den...',
        senderId: 'u-uuid',
        createdAt: '2024-03-15T10:30:00.000Z',
      },
    ],
  })
  messages?: Array<{
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  }>;
}

// ─── MESSAGE ────────────────────────────────────────────
export class MessageResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Dobrý den, mám dotaz k domácímu úkolu.' })
  content: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  senderId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  conversationId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── NOTIFICATION ───────────────────────────────────────
export class NotificationResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Nová zpráva' }) title: string;
  @ApiPropertyOptional({ example: 'Jan Novák vám poslal zprávu.' })
  body?: string;
  @ApiProperty({ example: false }) read: boolean;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  userId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── RECIPIENT ──────────────────────────────────────────
export class RecipientResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'jan.novak@example.com' }) email: string;
  @ApiProperty({ example: 'Jan' }) firstName: string;
  @ApiProperty({ example: 'Novák' }) lastName: string;
  @ApiProperty({ example: 'TEACHER' }) role: string;
}

// ─── BULLETIN POST ──────────────────────────────────────
export class BulletinPostResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Nový kroužek robotiky' }) title: string;
  @ApiProperty({ example: 'Od příštího týdne spouštíme kroužek...' })
  content: string;
  @ApiProperty({ example: false }) pinned: boolean;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  authorId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) updatedAt: string;
}

// ─── POLL ───────────────────────────────────────────────
export class PollResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Kam na školní výlet?' }) question: string;
  @ApiProperty({
    example: [
      { id: 'o-uuid', text: 'Praha', votes: 12 },
      { id: 'o-uuid2', text: 'Brno', votes: 8 },
    ],
  })
  options: any[];
  @ApiProperty({ example: false }) multiSelect: boolean;
  @ApiPropertyOptional({ example: '2024-04-01T00:00:00.000Z' }) endsAt?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── CALENDAR EVENT (COMMUNITY) ─────────────────────────
export class CommunityEventResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'Školní ples' }) title: string;
  @ApiPropertyOptional({ example: 'Tradiční školní ples pro rodiče a učitele' })
  description?: string;
  @ApiProperty({ example: '2024-04-15T18:00:00.000Z' }) startDate: string;
  @ApiPropertyOptional({ example: '2024-04-15T23:00:00.000Z' })
  endDate?: string;
  @ApiPropertyOptional({ example: 'Školní jídelna' }) location?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── CLASSBOOK ENTRY ────────────────────────────────────
export class ClassbookEntryResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: '2024-03-15T00:00:00.000Z' }) date: string;
  @ApiProperty({ example: 3 }) lessonNumber: number;
  @ApiPropertyOptional({ example: 'Lineární rovnice – procvičování' })
  topic?: string;
  @ApiPropertyOptional({ example: 'Bylo zadáno DÚ' }) notes?: string;
  @ApiPropertyOptional({ example: 2 }) absentCount?: number;
  @ApiPropertyOptional({ example: 'Matematika' }) subjectName?: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  signedBy?: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  classroomId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── REPORT CARD ────────────────────────────────────────
export class ReportCardResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  subjectInstanceId: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  semesterId: string;
  @ApiPropertyOptional({ example: '2' }) finalGrade?: string;
  @ApiPropertyOptional({ example: 'Žák pracuje svědomitě...' })
  verbalEvaluation?: string;
  @ApiPropertyOptional({ example: false }) aiPolished?: boolean;
  @ApiProperty({ example: '2024-06-20T10:30:00.000Z' }) createdAt: string;
}

// ─── GRADING TYPES ──────────────────────────────────────
export class GradingTypeResponseDto {
  @ApiProperty({ example: 'NUMERIC' }) type: string;
  @ApiPropertyOptional({ example: 'Číselná stupnice 1-5' })
  description?: string;
}

// ─── BEHAVIOR GRADE ─────────────────────────────────────
export class BehaviorGradeResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  semesterId: string;
  @ApiProperty({
    example: 1,
    description: '1=velmi dobré, 2=uspokojivé, 3=neuspokojivé',
  })
  grade: number;
  @ApiPropertyOptional({ example: 'Výborné chování' }) note?: string;
}

// ─── COMPETENCY GRADE ───────────────────────────────────
export class CompetencyGradeResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  competencyId: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  subjectInstanceId: string;
  @ApiProperty({ example: 'c3a1f2d4-3333-3333-3333-1a2b3c4d5e6f' })
  semesterId: string;
  @ApiProperty({ example: 3 }) level: number;
  @ApiPropertyOptional({ example: 'Dobře zvládá základy' }) note?: string;
}

// ─── MEASURE ────────────────────────────────────────────
export class MeasureResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiProperty({ example: 'PRAISE' }) type: string;
  @ApiProperty({ example: 'Výborné výsledky v matematické soutěži' })
  reason: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── GRADE HISTORY ──────────────────────────────────────
export class GradeHistoryEntryDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'UPDATE' }) action: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  gradeId?: string;
  @ApiPropertyOptional({ example: '{ "value": "3" }' }) oldValue?: string;
  @ApiPropertyOptional({ example: '{ "value": "2" }' }) newValue?: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── COMMISSION EXAM ────────────────────────────────────
export class CommissionExamResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;
  @ApiPropertyOptional({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  subjectInstanceId?: string;
  @ApiPropertyOptional({ example: '2024-06-15T09:00:00.000Z' }) date?: string;
  @ApiPropertyOptional({ example: '3' }) result?: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: '2024-05-15T10:30:00.000Z' }) createdAt: string;
}

// ─── GRADING DEADLINE ───────────────────────────────────
export class GradingDeadlineResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiPropertyOptional({ example: '2024-06-20T23:59:00.000Z' })
  deadline?: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  schoolId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  semesterId: string;
}

// ─── DASHBOARD ──────────────────────────────────────────
export class SchoolDashboardResponseDto {
  @ApiProperty({ example: 150 }) totalStudents: number;
  @ApiProperty({ example: 25 }) totalTeachers: number;
  @ApiProperty({ example: 8 }) totalClassrooms: number;
  @ApiProperty({ example: 12 }) totalSubjects: number;
}

// ─── SHARED ROOM ────────────────────────────────────────
export class SharedRoomResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  roomId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  ownerSchoolId: string;
  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  sharedWithSchoolId: string;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── SSO IDENTITY ───────────────────────────────────────
export class SsoIdentityResponseDto {
  @ApiProperty({ example: 'google' }) provider: string;
  @ApiProperty({ example: '109876543210987654321' }) providerId: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
}

// ─── UPLOAD RESULT ──────────────────────────────────────
export class UploadResultDto {
  @ApiProperty({ example: '/uploads/avatars/c3a1f2d4-5e6b-avatar.jpg' })
  avatarUrl: string;
}

// ─── IMPORT RESULT ──────────────────────────────────────
export class ImportResultDto {
  @ApiProperty({ example: 15 }) created: number;
  @ApiProperty({ example: 2 }) skipped: number;
  @ApiProperty({ example: 0 }) errors: number;
  @ApiPropertyOptional({ example: ['Row 3: invalid email format'] })
  errorDetails?: string[];
}

// ─── STUDENT DATA ───────────────────────────────────────
export class StudentDataResponseDto {
  @ApiProperty({
    description: 'Profil studenta',
    example: {
      id: 'u-uuid',
      email: 'student@example.com',
      firstName: 'Jan',
      lastName: 'Novák',
    },
  })
  profile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  @ApiProperty({ description: 'Známky studenta' }) grades: any[];
  @ApiProperty({ description: 'Rozvrh studenta' }) schedule: any[];
  @ApiProperty({ description: 'Docházka studenta' }) attendance: any[];
}

// ─── CHILD DASHBOARD ────────────────────────────────────
export class ChildDashboardResponseDto {
  @ApiProperty({
    description: 'Profil dítěte',
    example: {
      id: 'u-uuid',
      email: 'student@example.com',
      firstName: 'Jan',
      lastName: 'Novák',
    },
  })
  profile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  @ApiProperty({ description: 'Známky' }) grades: any[];
  @ApiProperty({ description: 'Rozvrh' }) schedule: any[];
}

// ─── PARENT CHILD ───────────────────────────────────────
export class ParentChildResponseDto {
  @ApiProperty({
    example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f',
    description: 'ID studenta (StudentProfile)',
  })
  id: string;
  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  userId: string;
  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  classroomId: string;
  @ApiPropertyOptional({
    description: 'User relation',
    example: { firstName: 'Jan', lastName: 'Novák', email: 'jan@example.com' },
  })
  user?: { firstName: string; lastName: string; email: string };
  @ApiPropertyOptional({
    description: 'Třída',
    example: { id: 'cr-uuid', name: '5.A', grade: 5 },
  })
  classroom?: { id: string; name: string; grade: number };
}

// ─── TEACHER CLASSES ────────────────────────────────────
export class TeacherClassResponseDto {
  @ApiProperty({
    example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f',
    description: 'ID třídy',
  })
  classroomId: string;
  @ApiProperty({ example: '5.A' }) classroomName: string;
  @ApiProperty({ description: 'Studenti ve třídě' }) students: Array<{
    id: string;
    userId: string;
    user: { firstName: string; lastName: string; email: string };
  }>;
}

// ─── SYSTEM DASHBOARD ───────────────────────────────────
export class SystemDashboardResponseDto {
  @ApiProperty({ example: 3 }) totalSchools: number;
  @ApiProperty({ example: 450 }) totalUsers: number;
  @ApiPropertyOptional({ example: 12 }) totalClassrooms?: number;
}

// ─── SCHOOL ─────────────────────────────────────────────
export class SchoolResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: 'ZŠ Příkladná' }) name: string;
  @ApiPropertyOptional({ example: 'Školní 123, Praha 1' }) address?: string;
  @ApiProperty({ example: true }) isActive: boolean;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) createdAt: string;
  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' }) updatedAt: string;
}

// ─── SSO CONFIG ─────────────────────────────────────────
export class SsoConfigResponseDto {
  @ApiPropertyOptional({ example: '123456789-abc.apps.googleusercontent.com' })
  googleClientId?: string;
  @ApiPropertyOptional({ example: true }) googleEnabled?: boolean;
  @ApiPropertyOptional({ example: 'abc-12345-def-67890' })
  microsoftClientId?: string;
  @ApiPropertyOptional({ example: false }) microsoftEnabled?: boolean;
}

// ─── AI CONFIG ──────────────────────────────────────────
export class AiConfigResponseDto {
  @ApiPropertyOptional({ example: 'google' }) provider?: string;
  @ApiPropertyOptional({ example: 'gemini-2.0-flash' }) model?: string;
  @ApiProperty({ example: true }) enabled: boolean;
}

// ─── AI USAGE ───────────────────────────────────────────
export class AiUsageResponseDto {
  @ApiProperty({ example: 1250 }) totalRequests: number;
  @ApiProperty({ example: 45000 }) totalTokens: number;
  @ApiProperty({
    description: 'Denní breakdown',
    example: [{ date: '2024-03-15', requests: 45, tokens: 12000 }],
  })
  daily: Array<{
    date: string;
    requests: number;
    tokens: number;
  }>;
}

// ─── AI TEXT RESULT ─────────────────────────────────────
export class AiTextResponseDto {
  @ApiProperty({
    example: 'Žák prokazuje dobré znalosti základů lineární algebry...',
  })
  text: string;
}

// ─── BACKUP ─────────────────────────────────────────────
export class BackupResponseDto {
  @ApiProperty({ example: 'backup-2024-03-15-10-30.sql.gz' }) filename: string;
  @ApiProperty({ example: 1048576 }) size: number;
  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── HEALTH CHECK ───────────────────────────────────────
export class HealthCheckResponseDto {
  @ApiProperty({ example: 'ok' }) status: string;
  @ApiProperty({ example: true }) database: boolean;
  @ApiProperty({ example: true }) mail: boolean;
  @ApiPropertyOptional({ example: true }) mcp?: boolean;
}

// ─── METRICS ────────────────────────────────────────────
export class MetricsResponseDto {
  @ApiProperty({ example: 12.5 }) cpuPercent: number;
  @ApiProperty({ example: 256 }) memoryMb: number;
  @ApiProperty({ example: '2d 5h 30m' }) uptime: string;
}

export class RvpAreaDto {
  @ApiProperty({ example: 'Jazyk a jazyková komunikace' }) name: string;
  @ApiProperty({ example: ['Český jazyk', 'Cizí jazyk'] }) subjects: string[];
}

export class RvpPreviewDto {
  @ApiProperty({ type: [RvpAreaDto] }) areas: RvpAreaDto[];
}

// ─── RVP ────────────────────────────────────────────────
export class RvpUploadResponseDto {
  @ApiProperty({ description: 'Náhled dat z RVP souboru' })
  preview: RvpPreviewDto;

  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' })
  uploadId: string;
}

// ─── COMPETENCY MATRIX ──────────────────────────────────
export class CompetencyMatrixResponseDto {
  @ApiProperty({
    description: 'Matice kompetencí → předměty',
    example: {
      'Kompetence k učení': { Matematika: true, 'Český jazyk': false },
    },
  })
  matrix: Record<string, Record<string, boolean>>;
}

// ─── COMPARISONS / DIFFS ────────────────────────────────
export class CurriculumDiffResponseDto {
  @ApiProperty({ description: 'Přidané záznamy' }) added: Array<{
    subjectTemplateId: string;
    gradeLevelId: string;
    hoursPerWeek: number;
  }>;
  @ApiProperty({ description: 'Odebrané záznamy' }) removed: Array<{
    id: string;
    subjectName: string;
  }>;
  @ApiProperty({ description: 'Změněné záznamy' }) changed: Array<{
    id: string;
    oldHours: number;
    newHours: number;
    subjectName: string;
  }>;
}

export class ScheduleDiffResponseDto {
  @ApiProperty({ description: 'Přidané události' }) added: Array<{
    dayOfWeek: number;
    lessonNumber: number;
    subjectInstanceId: string;
  }>;
  @ApiProperty({ description: 'Odebrané události' }) removed: Array<{
    id: string;
    dayOfWeek: number;
    lessonNumber: number;
  }>;
  @ApiProperty({ description: 'Změněné události' }) changed: Array<{
    id: string;
    oldLessonNumber: number;
    newLessonNumber: number;
  }>;
}

// ─── GENERATE SCHEDULE RESULT ───────────────────────────
export class GenerateScheduleResultDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 45 }) eventsCreated: number;
  @ApiProperty({ example: ['Učitel Novák má kolizi v pondělí 3. hodinu'] })
  warnings: string[];
}

// ─── GDPR DATA EXPORT ──────────────────────────────────
export class GdprDataResponseDto {
  @ApiProperty({ description: 'Profil uživatele' }) profile: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  @ApiProperty({ description: 'Známky' }) grades: any[];
  @ApiProperty({ description: 'Docházka' }) attendance: any[];
  @ApiProperty({ description: 'Zprávy' }) messages: any[];
  @ApiProperty({ description: 'Audit log' }) auditLog: any[];
}

// ─── INIT STATUS ────────────────────────────────────────
export class InitStatusResponseDto {
  @ApiProperty({ example: true }) initialized: boolean;
}

// ─── REPORT STATS ───────────────────────────────────────
export class ReportStatsResponseDto {
  @ApiProperty({
    description: 'Statistická data',
    example: {
      average: 2.1,
      median: 2,
      stdDev: 0.8,
      distribution: { '1': 5, '2': 12, '3': 7, '4': 2, '5': 1 },
    },
  })
  data: {
    average: number;
    median: number;
    stdDev: number;
    distribution: Record<string, number>;
  };
  @ApiPropertyOptional({
    description: 'Metadata',
    example: { period: '2024/2025 1. pololetí', classroomName: '5.A' },
  })
  meta?: {
    period: string;
    classroomName: string;
    [key: string]: string;
  };
}

export class RegistryStudentUserDto {
  @ApiProperty({ example: 'Jan' }) firstName: string;
  @ApiProperty({ example: 'Novák' }) lastName: string;
}

export class RegistryStudentDto {
  @ApiProperty({ example: 'sp-uuid' }) id: string;
  @ApiProperty({ example: 'u-uuid' }) userId: string;
  @ApiProperty({ type: RegistryStudentUserDto }) user: RegistryStudentUserDto;
}

// ─── CLASSROOM FOR REGISTRY ─────────────────────────────
export class RegistryClassroomResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' }) id: string;
  @ApiProperty({ example: '5.A' }) name: string;
  @ApiProperty({ example: 5 }) grade: number;
  @ApiProperty({
    description: 'Studenti s uživatelskými daty',
    type: [RegistryStudentDto],
  })
  students: RegistryStudentDto[];
}

// ─── SETTINGS ───────────────────────────────────────────
export class SystemSettingsResponseDto {
  @ApiPropertyOptional({ example: 'cs' }) defaultLanguage?: string;
  @ApiPropertyOptional({ example: false }) maintenanceMode?: boolean;
  @ApiPropertyOptional({ example: true }) registrationEnabled?: boolean;
}

// ─── PAGINATED RESPONSE ─────────────────────────────────
export class PaginatedUsersResponseDto {
  @ApiProperty({ description: 'Pole uživatelů', type: [SchoolUserResponseDto] })
  data: SchoolUserResponseDto[];
  @ApiProperty({ example: 150 }) total: number;
  @ApiProperty({ example: 0 }) skip: number;
  @ApiProperty({ example: 20 }) take: number;
}
