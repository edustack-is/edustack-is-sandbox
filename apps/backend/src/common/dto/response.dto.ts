import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ════════════════════════════════════════════════════════
// RESPONSE DTOs for entity returns (Prisma objects)
// ════════════════════════════════════════════════════════

// ─── CLASSROOM ──────────────────────────────────────────
export class ClassroomResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: '5.A' }) name: string;
    @ApiProperty({ example: 5 }) grade: number;
    @ApiProperty({ example: '2024-01-01T00:00:00.000Z' }) createdAt: string;
}

// ─── SUBJECT TEMPLATE ───────────────────────────────────
export class SubjectResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Matematika' }) name: string;
    @ApiProperty({ example: 'MAT' }) code: string;
    @ApiPropertyOptional() svpDescription?: string;
}

// ─── ROOM ───────────────────────────────────────────────
export class RoomResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Učebna 101' }) name: string;
    @ApiPropertyOptional({ example: 30 }) capacity?: number;
    @ApiPropertyOptional({ example: true }) isComputerLab?: boolean;
}

// ─── BUILDING ───────────────────────────────────────────
export class BuildingResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Hlavní budova' }) name: string;
    @ApiPropertyOptional({ example: 'Školní 123, Praha' }) address?: string;
}

// ─── EVENT ──────────────────────────────────────────────
export class SchoolEventResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Pedagogická rada' }) title: string;
    @ApiPropertyOptional() description?: string;
    @ApiProperty({ example: '2024-03-20' }) date: string;
    @ApiPropertyOptional() type?: string;
}

// ─── SCHOOL USER ────────────────────────────────────────
export class SchoolUserResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'jan@example.com' }) email: string;
    @ApiProperty({ example: 'Jan' }) firstName: string;
    @ApiProperty({ example: 'Novák' }) lastName: string;
    @ApiProperty({ example: 'TEACHER' }) role: string;
    @ApiProperty({ example: 'ACTIVE' }) status: string;
}

// ─── STUDENT WITH FAMILY ────────────────────────────────
export class StudentFamilyResponseDto {
    @ApiProperty() student: SchoolUserResponseDto;
    @ApiPropertyOptional() parent?: SchoolUserResponseDto;
}

// ─── AUDIT LOG ENTRY ────────────────────────────────────
export class AuditLogEntryDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'UPDATE' }) action: string;
    @ApiProperty({ example: 'User' }) entityType: string;
    @ApiPropertyOptional() entityId?: string;
    @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) timestamp: string;
    @ApiPropertyOptional() userId?: string;
}

// ─── SCHOOL SETTINGS ────────────────────────────────────
export class SchoolSettingsResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiPropertyOptional({ example: 'ZŠ Příkladná' }) name?: string;
    @ApiPropertyOptional({ example: 'NUMERIC' }) gradingSystem?: string;
    @ApiPropertyOptional({ example: true }) requireSsoEmailMatch?: boolean;
}

// ─── ACADEMIC YEAR ──────────────────────────────────────
export class AcademicYearResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: '2024/2025' }) name: string;
    @ApiProperty({ example: '2024-09-01' }) startDate: string;
    @ApiProperty({ example: '2025-06-30' }) endDate: string;
    @ApiProperty({ example: true }) isCurrent: boolean;
}

// ─── GRADE LEVEL ────────────────────────────────────────
export class GradeLevelResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: '5. ročník' }) name: string;
    @ApiProperty({ example: 5 }) levelNumber: number;
}

// ─── SUBJECT INSTANCE ───────────────────────────────────
export class SubjectInstanceResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 2 }) hoursPerWeek: number;
    @ApiPropertyOptional() template?: SubjectResponseDto;
    @ApiPropertyOptional() gradeLevel?: GradeLevelResponseDto;
}

// ─── TEACHER WORKLOAD ───────────────────────────────────
export class TeacherWorkloadResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 100 }) workloadPercentage: number;
    @ApiPropertyOptional() teacher?: SchoolUserResponseDto;
}

// ─── CURRICULUM VERSION ─────────────────────────────────
export class CurriculumVersionResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'ŠVP 2024 v1' }) name: string;
    @ApiProperty({ example: '2024-09-01' }) validFrom: string;
    @ApiPropertyOptional({ example: '2025-06-30' }) validTo?: string;
}

// ─── CURRICULUM ENTRY ───────────────────────────────────
export class CurriculumEntryResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 2 }) hoursPerWeek: number;
    @ApiPropertyOptional() gradingType?: string;
    @ApiPropertyOptional() rvpDescription?: string;
    @ApiPropertyOptional() svpApproach?: string;
}

// ─── COMPETENCY ─────────────────────────────────────────
export class CompetencyResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Kompetence k učení' }) name: string;
    @ApiPropertyOptional() description?: string;
}

// ─── SEMESTER ───────────────────────────────────────────
export class SemesterResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 1 }) number: number;
    @ApiProperty({ example: '1. pololetí' }) name: string;
    @ApiProperty({ example: '2024-09-01' }) startDate: string;
    @ApiProperty({ example: '2025-01-31' }) endDate: string;
}

// ─── THEMATIC PLAN ──────────────────────────────────────
export class ThematicPlanResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiPropertyOptional() weekNumber?: number;
    @ApiPropertyOptional() topic?: string;
    @ApiPropertyOptional() objectives?: string;
}

// ─── TEACHING MATERIAL ──────────────────────────────────
export class TeachingMaterialResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Pracovní list – rovnice' }) title: string;
    @ApiPropertyOptional() type?: string;
    @ApiPropertyOptional() url?: string;
}

// ─── LESSON PLAN ────────────────────────────────────────
export class LessonPlanResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiPropertyOptional() title?: string;
    @ApiPropertyOptional() objectives?: string;
    @ApiPropertyOptional() activities?: string;
}

// ─── ENROLLMENT ─────────────────────────────────────────
export class EnrollmentResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty() gradeLevelId: string;
    @ApiProperty() classroomId: string;
}

// ─── SCHEDULE EVENT ─────────────────────────────────────
export class ScheduleEventResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 1 }) dayOfWeek: number;
    @ApiProperty({ example: 3 }) lessonNumber: number;
    @ApiPropertyOptional() teacher?: SchoolUserResponseDto;
    @ApiPropertyOptional() room?: RoomResponseDto;
}

// ─── SCHEDULE MATRIX ────────────────────────────────────
export class ScheduleMatrixResponseDto {
    @ApiProperty({ description: 'Matice rozvrhu [den][hodina] → událost' })
    events: ScheduleEventResponseDto[];

    @ApiProperty({ description: 'Časové sloty (zvonění)' })
    timeSlots: any[];
}

// ─── SUBSTITUTION ───────────────────────────────────────
export class SubstitutionResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: '2024-03-15' }) date: string;
    @ApiProperty({ example: 'SUBSTITUTION' }) type: string;
    @ApiPropertyOptional() note?: string;
}

// ─── COLLISION RESULT ──────────────────────────────────
export class CollisionResultDto {
    @ApiProperty({ example: false }) hasCollision: boolean;
    @ApiPropertyOptional({ type: [String] }) collisions?: string[];
}

// ─── SNAPSHOT ───────────────────────────────────────────
export class SnapshotResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Snapshot 15.3.2024' }) name: string;
    @ApiProperty({ example: '2024-03-15T10:00:00.000Z' }) createdAt: string;
}

// ─── RECURRING EVENT ────────────────────────────────────
export class RecurringEventResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Kroužek robotiky' }) title: string;
}

// ─── ATTENDANCE RECORD ──────────────────────────────────
export class AttendanceRecordResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty({ example: 'PRESENT' }) status: string;
    @ApiPropertyOptional() note?: string;
}

// ─── EXCUSE ─────────────────────────────────────────────
export class ExcuseResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty({ example: 'Nemoc' }) reason: string;
    @ApiProperty({ example: 'PENDING' }) status: string;
    @ApiProperty({ example: '2024-03-15' }) dateFrom: string;
    @ApiProperty({ example: '2024-03-17' }) dateTo: string;
}

// ─── ATTENDANCE STATS ───────────────────────────────────
export class AttendanceStatsResponseDto {
    @ApiProperty({ example: 25 }) totalStudents: number;
    @ApiProperty({ example: 450 }) totalLessons: number;
    @ApiProperty({ example: 95.2 }) averageAttendancePercent: number;
    @ApiProperty({ description: 'Per-student breakdown' }) students: any[];
}

// ─── UNEXCUSED ALERT ────────────────────────────────────
export class UnexcusedAlertDto {
    @ApiProperty() studentId: string;
    @ApiProperty({ example: 'Jan Novák' }) studentName: string;
    @ApiProperty({ example: 7 }) unexcusedCount: number;
}

// ─── CONVERSATION ───────────────────────────────────────
export class ConversationResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiPropertyOptional({ example: 'Dotaz k DÚ' }) subject?: string;
    @ApiProperty({ example: 'DIRECT' }) type: string;
    @ApiProperty({ description: 'Účastníci', type: [SchoolUserResponseDto] }) participants: SchoolUserResponseDto[];
    @ApiPropertyOptional() lastMessage?: string;
}

// ─── MESSAGE ────────────────────────────────────────────
export class MessageResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Text zprávy' }) content: string;
    @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
    @ApiProperty() senderId: string;
}

// ─── NOTIFICATION ───────────────────────────────────────
export class NotificationResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Nová zpráva' }) title: string;
    @ApiPropertyOptional({ example: 'Jan Novák vám poslal zprávu.' }) body?: string;
    @ApiProperty({ example: false }) read: boolean;
    @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── RECIPIENT ──────────────────────────────────────────
export class RecipientResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Jan Novák' }) name: string;
    @ApiProperty({ example: 'TEACHER' }) role: string;
}

// ─── BULLETIN POST ──────────────────────────────────────
export class BulletinPostResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Nový kroužek' }) title: string;
    @ApiProperty({ example: 'Od příštího týdne...' }) content: string;
    @ApiProperty({ example: false }) pinned: boolean;
    @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) createdAt: string;
}

// ─── POLL ───────────────────────────────────────────────
export class PollResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Kam na výlet?' }) question: string;
    @ApiProperty({ description: 'Pole možností s počtem hlasů' }) options: any[];
    @ApiProperty({ example: false }) multiSelect: boolean;
}

// ─── CALENDAR EVENT (COMMUNITY) ─────────────────────────
export class CommunityEventResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Školní ples' }) title: string;
    @ApiPropertyOptional() description?: string;
    @ApiProperty({ example: '2024-04-15T18:00:00.000Z' }) startDate: string;
}

// ─── CLASSBOOK ENTRY ────────────────────────────────────
export class ClassbookEntryResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: '2024-03-15' }) date: string;
    @ApiProperty({ example: 3 }) lessonNumber: number;
    @ApiPropertyOptional({ example: 'Lineární rovnice' }) topic?: string;
    @ApiPropertyOptional() notes?: string;
    @ApiPropertyOptional() signedBy?: string;
}

// ─── REPORT CARD ────────────────────────────────────────
export class ReportCardResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty() subjectInstanceId: string;
    @ApiPropertyOptional({ example: '2' }) finalGrade?: string;
    @ApiPropertyOptional() verbalEvaluation?: string;
}

// ─── GRADING TYPES ──────────────────────────────────────
export class GradingTypeResponseDto {
    @ApiProperty({ example: 'NUMERIC' }) type: string;
    @ApiPropertyOptional({ example: 'Číselná stupnice 1-5' }) description?: string;
}

// ─── BEHAVIOR GRADE ─────────────────────────────────────
export class BehaviorGradeResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty({ example: 1 }) grade: number;
    @ApiPropertyOptional() note?: string;
}

// ─── COMPETENCY GRADE ───────────────────────────────────
export class CompetencyGradeResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty() competencyId: string;
    @ApiProperty({ example: 3 }) level: number;
}

// ─── MEASURE ────────────────────────────────────────────
export class MeasureResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiProperty({ example: 'PRAISE' }) type: string;
    @ApiProperty({ example: 'Výborné výsledky' }) reason: string;
    @ApiProperty({ example: '2024-03-15T00:00:00.000Z' }) createdAt: string;
}

// ─── GRADE HISTORY ──────────────────────────────────────
export class GradeHistoryEntryDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'UPDATE' }) action: string;
    @ApiProperty({ example: '2024-03-15T10:30:00.000Z' }) timestamp: string;
    @ApiPropertyOptional() oldValue?: string;
    @ApiPropertyOptional() newValue?: string;
}

// ─── COMMISSION EXAM ────────────────────────────────────
export class CommissionExamResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty() studentId: string;
    @ApiPropertyOptional() subjectInstanceId?: string;
    @ApiPropertyOptional({ example: '2024-06-15' }) date?: string;
    @ApiPropertyOptional({ example: '3' }) result?: string;
}

// ─── GRADING DEADLINE ───────────────────────────────────
export class GradingDeadlineResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiPropertyOptional({ example: '2024-06-20' }) deadline?: string;
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
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Tělocvična' }) roomName: string;
    @ApiProperty({ example: 'ZŠ Sousední' }) sharedWithSchool: string;
}

// ─── SSO IDENTITY ───────────────────────────────────────
export class SsoIdentityResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'google' }) provider: string;
    @ApiProperty({ example: 'user@gmail.com' }) providerEmail: string;
}

// ─── UPLOAD RESULT ──────────────────────────────────────
export class UploadResultDto {
    @ApiProperty({ example: 'https://example.com/avatar.jpg' }) url: string;
}

// ─── IMPORT RESULT ──────────────────────────────────────
export class ImportResultDto {
    @ApiProperty({ example: 15 }) created: number;
    @ApiProperty({ example: 2 }) skipped: number;
    @ApiProperty({ example: 0 }) errors: number;
}

// ─── STUDENT DATA ───────────────────────────────────────
export class StudentDataResponseDto {
    @ApiProperty() profile: SchoolUserResponseDto;
    @ApiProperty({ description: 'Známky' }) grades: any[];
    @ApiProperty({ description: 'Rozvrh' }) schedule: any[];
    @ApiProperty({ description: 'Docházka' }) attendance: any[];
}

// ─── CHILD DASHBOARD ────────────────────────────────────
export class ChildDashboardResponseDto {
    @ApiProperty() profile: SchoolUserResponseDto;
    @ApiProperty({ description: 'Známky' }) grades: any[];
    @ApiProperty({ description: 'Rozvrh' }) schedule: any[];
}

// ─── PARENT CHILD ───────────────────────────────────────
export class ParentChildResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'Jan Novák' }) name: string;
    @ApiProperty({ example: '5.A' }) classroom: string;
}

// ─── TEACHER CLASSES ────────────────────────────────────
export class TeacherClassResponseDto {
    @ApiProperty({ example: 'uuid' }) classroomId: string;
    @ApiProperty({ example: '5.A' }) classroomName: string;
    @ApiProperty({ description: 'Studenti', type: [SchoolUserResponseDto] }) students: SchoolUserResponseDto[];
}

// ─── SYSTEM DASHBOARD ───────────────────────────────────
export class SystemDashboardResponseDto {
    @ApiProperty({ example: 3 }) totalSchools: number;
    @ApiProperty({ example: 450 }) totalUsers: number;
    @ApiProperty({ example: '2024-03-15T10:00:00.000Z' }) uptime: string;
}

// ─── SCHOOL ─────────────────────────────────────────────
export class SchoolResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: 'ZŠ Příkladná' }) name: string;
    @ApiPropertyOptional({ example: 'Školní 123, Praha' }) address?: string;
    @ApiProperty({ example: true }) isActive: boolean;
}

// ─── SSO CONFIG ─────────────────────────────────────────
export class SsoConfigResponseDto {
    @ApiPropertyOptional({ example: 'client-id-xxx' }) googleClientId?: string;
    @ApiPropertyOptional({ example: true }) googleEnabled?: boolean;
    @ApiPropertyOptional({ example: 'client-id-xxx' }) microsoftClientId?: string;
    @ApiPropertyOptional({ example: false }) microsoftEnabled?: boolean;
}

// ─── AI CONFIG ──────────────────────────────────────────
export class AiConfigResponseDto {
    @ApiPropertyOptional({ example: 'google' }) provider?: string;
    @ApiPropertyOptional({ example: 'gemini-1.5-flash' }) model?: string;
    @ApiProperty({ example: true }) enabled: boolean;
}

// ─── AI USAGE ───────────────────────────────────────────
export class AiUsageResponseDto {
    @ApiProperty({ example: 1250 }) totalRequests: number;
    @ApiProperty({ example: 45000 }) totalTokens: number;
    @ApiProperty({ description: 'Denní breakdown' }) daily: any[];
}

// ─── AI TEXT RESULT ─────────────────────────────────────
export class AiTextResponseDto {
    @ApiProperty({ example: 'Vylepšený text...' }) text: string;
}

// ─── BACKUP ─────────────────────────────────────────────
export class BackupResponseDto {
    @ApiProperty({ example: 'backup-2024-03-15.sql.gz' }) filename: string;
    @ApiProperty({ example: 1048576 }) size: number;
    @ApiProperty({ example: '2024-03-15T10:00:00.000Z' }) createdAt: string;
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

// ─── RVP ────────────────────────────────────────────────
export class RvpUploadResponseDto {
    @ApiProperty({ description: 'Náhled dat z RVP' }) preview: any;
    @ApiProperty({ example: 'uuid' }) uploadId: string;
}

// ─── COMPETENCY MATRIX ──────────────────────────────────
export class CompetencyMatrixResponseDto {
    @ApiProperty({ description: 'Matice kompetencí → předměty' }) matrix: any;
}

// ─── COMPARISONS / DIFFS ────────────────────────────────
export class CurriculumDiffResponseDto {
    @ApiProperty({ description: 'Rozdíly mezi verzemi' }) added: any[];
    @ApiProperty() removed: any[];
    @ApiProperty() changed: any[];
}

export class ScheduleDiffResponseDto {
    @ApiProperty({ description: 'Rozdíly mezi snapshoty' }) added: any[];
    @ApiProperty() removed: any[];
    @ApiProperty() changed: any[];
}

// ─── GENERATE SCHEDULE RESULT ───────────────────────────
export class GenerateScheduleResultDto {
    @ApiProperty({ example: true }) success: boolean;
    @ApiProperty({ example: 45 }) eventsCreated: number;
    @ApiProperty({ description: 'Varování' }) warnings: string[];
}

// ─── GDPR DATA EXPORT ──────────────────────────────────
export class GdprDataResponseDto {
    @ApiProperty() profile: SchoolUserResponseDto;
    @ApiProperty({ description: 'Známky' }) grades: any[];
    @ApiProperty({ description: 'Docházka' }) attendance: any[];
    @ApiProperty({ description: 'Zprávy' }) messages: any[];
    @ApiProperty({ description: 'Audit log' }) auditLog: any[];
}

// ─── INIT STATUS ────────────────────────────────────────
export class InitStatusResponseDto {
    @ApiProperty({ example: true }) initialized: boolean;
}

// ─── SEED FILE ──────────────────────────────────────────
export class SeedFileResponseDto {
    @ApiProperty({ example: 'demo-school.json' }) filename: string;
    @ApiPropertyOptional({ example: 'Demo škola s 50 studenty' }) description?: string;
}

// ─── REPORT STATS ───────────────────────────────────────
export class ReportStatsResponseDto {
    @ApiProperty({ description: 'Statistická data' }) data: any;
    @ApiPropertyOptional({ description: 'Metadata' }) meta?: any;
}

// ─── CLASSROOM FOR REGISTRY ─────────────────────────────
export class RegistryClassroomResponseDto {
    @ApiProperty({ example: 'uuid' }) id: string;
    @ApiProperty({ example: '5.A' }) name: string;
    @ApiProperty({ example: 5 }) grade: number;
    @ApiProperty({ description: 'Studenti', type: [SchoolUserResponseDto] }) students: SchoolUserResponseDto[];
}

// ─── SETTINGS ───────────────────────────────────────────
export class SystemSettingsResponseDto {
    @ApiPropertyOptional({ example: 'cs' }) defaultLanguage?: string;
    @ApiPropertyOptional({ example: true }) maintenanceMode?: boolean;
    @ApiPropertyOptional({ example: true }) registrationEnabled?: boolean;
}

// ─── PAGINATED RESPONSE ─────────────────────────────────
export class PaginatedUsersResponseDto {
    @ApiProperty({ type: [SchoolUserResponseDto] }) data: SchoolUserResponseDto[];
    @ApiProperty({ example: 150 }) total: number;
    @ApiProperty({ example: 0 }) skip: number;
    @ApiProperty({ example: 20 }) take: number;
}
