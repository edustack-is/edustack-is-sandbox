import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── AUTH DTOs ──────────────────────────────────────────

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'password123' })
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invitation token z e-mailu' })
  token: string;

  @ApiProperty({ description: 'Nové heslo uživatele', minLength: 6 })
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token z e-mailu' })
  token: string;

  @ApiProperty({ description: 'Nové heslo', minLength: 6 })
  password: string;
}

export class SelectSchoolResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;
}

export class UserProfileDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'Jan' })
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  lastName: string;

  @ApiProperty({ example: false })
  isSystemAdmin: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({
    description: 'Profil studenta (null pokud není student)',
    example: {
      id: 'sp-uuid',
      classroomId: 'cr-uuid',
      classroom: { id: 'cr-uuid', name: '5.A', homeroomTeacher: null },
    },
  })
  studentProfile?: any;

  @ApiPropertyOptional({
    description: 'Profil učitele (null pokud není učitel)',
    example: { id: 'tp-uuid', homeroomClass: { id: 'cr-uuid', name: '5.A' } },
  })
  teacherProfile?: any;
}

export class SchoolListItemDto {
  @ApiProperty({
    example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f',
    description: 'ID členství (SchoolMembership)',
  })
  id: string;

  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  userId: string;

  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  schoolId: string;

  @ApiProperty({
    example: 'TEACHER',
    enum: [
      'STUDENT',
      'TEACHER',
      'PARENT',
      'DEPUTY',
      'PRINCIPAL',
      'ADMIN',
      'DIRECTOR',
    ],
  })
  role: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({
    description: 'Škola',
    example: {
      id: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f',
      name: 'ZŠ Příkladná',
      address: 'Školní 123, Praha',
      isActive: true,
    },
  })
  school: any;
}

/** @deprecated getSsoOptions vrací string[] (pole názvů providerů), ne objekt */
export class SsoOptionDto {
  @ApiProperty({
    example: 'google',
    description:
      'Endpoint vrací pole stringů, např. ["google","microsoft"]. Tato třída slouží jako reference.',
  })
  provider: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;
}

export class InviteUserBodyDto {
  @ApiPropertyOptional({ description: 'ID studenta pro propojení s rodičem' })
  studentId?: string;
}

// ─── GRADING DTOs ───────────────────────────────────────

export class CreateGradeDto {
  @ApiProperty({ example: 'uuid-student-id' })
  studentId: string;

  @ApiProperty({ example: 'uuid-subject-instance-id' })
  subjectInstanceId: string;

  @ApiProperty({ example: '2', description: 'Hodnota známky (1-5 nebo N)' })
  value: string;

  @ApiProperty({ example: 1, description: 'Váha známky (1-10)', minimum: 1 })
  weight: number;

  @ApiPropertyOptional({ example: 'Písemka z rovnic' })
  description?: string;

  @ApiPropertyOptional({
    example: 'EXAM',
    enum: ['EXAM', 'TEST', 'HOMEWORK', 'PROJECT', 'ORAL', 'OTHER'],
  })
  type?: string;

  @ApiPropertyOptional({ description: 'Slovní hodnocení' })
  verbalText?: string;

  @ApiPropertyOptional({
    example: 'algebra',
    description: 'Tematická kategorie',
  })
  category?: string;

  @ApiPropertyOptional({ example: 'uuid-semester-id' })
  semesterId?: string;
}

export class UpdateGradeDto {
  @ApiPropertyOptional({ example: '1' })
  value?: string;

  @ApiPropertyOptional({ example: 2 })
  weight?: number;

  @ApiPropertyOptional({ example: 'Opravená písemka' })
  description?: string;

  @ApiPropertyOptional()
  verbalText?: string;

  @ApiPropertyOptional()
  category?: string;
}

export class GradeResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: '2' })
  value: string;

  @ApiProperty({ example: 1 })
  weight: number;

  @ApiPropertyOptional({ example: 'Písemka z rovnic' })
  description?: string;

  @ApiPropertyOptional({ example: 'EXAM' })
  type?: string;

  @ApiPropertyOptional({ example: 'algebra' })
  category?: string;

  @ApiPropertyOptional({ example: 'Dobře zvládnuté základy.' })
  verbalText?: string;

  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  studentId: string;

  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  subjectInstanceId: string;

  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  teacherProfileId: string;

  @ApiPropertyOptional({ example: 'c3a1f2d4-3333-3333-3333-1a2b3c4d5e6f' })
  semesterId?: string;

  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' })
  updatedAt: string;
}

export class UpsertReportCardDto {
  @ApiProperty()
  studentId: string;

  @ApiProperty()
  subjectInstanceId: string;

  @ApiProperty()
  semesterId: string;

  @ApiPropertyOptional({
    example: '2',
    description: 'Výsledná známka na vysvědčení',
  })
  finalGrade?: string;

  @ApiPropertyOptional({ description: 'Slovní hodnocení na vysvědčení' })
  verbalEvaluation?: string;

  @ApiPropertyOptional({ description: 'Zda bylo slovní hodnocení AI upraveno' })
  aiPolished?: boolean;
}

export class PolishTextDto {
  @ApiProperty({ description: 'Text k vylepšení' })
  text: string;

  @ApiProperty({ example: 'Jan Novák' })
  studentName: string;

  @ApiProperty({ example: 'Matematika' })
  subjectName: string;
}

export class BehaviorGradeDto {
  @ApiProperty()
  studentId: string;

  @ApiProperty()
  semesterId: string;

  @ApiProperty({
    example: 1,
    description: '1 = velmi dobré, 2 = uspokojivé, 3 = neuspokojivé',
  })
  grade: number;

  @ApiPropertyOptional()
  note?: string;
}

export class CompetencyGradeDto {
  @ApiProperty()
  studentId: string;

  @ApiProperty()
  competencyId: string;

  @ApiProperty()
  subjectInstanceId: string;

  @ApiProperty()
  semesterId: string;

  @ApiProperty({ example: 3, description: 'Úroveň 1-5' })
  level: number;

  @ApiPropertyOptional()
  note?: string;
}

export class MeasureDto {
  @ApiProperty()
  studentId: string;

  @ApiProperty({
    example: 'PRAISE',
    enum: [
      'PRAISE',
      'REPRIMAND',
      'CLASS_REPRIMAND',
      'PRINCIPAL_REPRIMAND',
      'REDUCED_BEHAVIOR',
    ],
  })
  type: string;

  @ApiProperty({ example: 'Výborné výsledky v soutěži' })
  reason: string;

  @ApiPropertyOptional()
  semesterId?: string;
}

// ─── ATTENDANCE DTOs ────────────────────────────────────

export class AttendanceRecordItemDto {
  @ApiProperty({ example: 'uuid-student-id' })
  studentId: string;

  @ApiProperty({
    example: 'PRESENT',
    enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'UNEXCUSED'],
  })
  status: string;

  @ApiPropertyOptional({ example: 'Přišel pozdě 5 minut' })
  note?: string;
}

export class RecordAttendanceDto {
  @ApiProperty({ example: '2024-03-15' })
  date: string;

  @ApiProperty({ example: 3, description: 'Číslo vyučovací hodiny' })
  lessonNumber: number;

  @ApiProperty({ example: 'uuid-classroom-id' })
  classroomId: string;

  @ApiProperty({ type: [AttendanceRecordItemDto] })
  records: AttendanceRecordItemDto[];
}

export class CreateExcuseDto {
  @ApiProperty()
  studentId: string;

  @ApiProperty({ example: 'Nemoc' })
  reason: string;

  @ApiProperty({ example: '2024-03-15' })
  dateFrom: string;

  @ApiProperty({ example: '2024-03-17' })
  dateTo: string;
}

export class ReviewExcuseDto {
  @ApiProperty({ example: 'APPROVED', enum: ['APPROVED', 'REJECTED'] })
  status: 'APPROVED' | 'REJECTED';
}

// ─── SCHEDULE DTOs ──────────────────────────────────────

export class TimeSlotDto {
  @ApiProperty({ example: 1 })
  lessonNumber: number;

  @ApiProperty({ example: '08:00' })
  startTime: string;

  @ApiProperty({ example: '08:45' })
  endTime: string;

  @ApiPropertyOptional({ example: '1. hodina' })
  label?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Přestávka po hodině (minuty)',
  })
  breakAfter?: number;
}

export class UpsertTimeSlotsDto {
  @ApiProperty({ type: [TimeSlotDto] })
  slots: TimeSlotDto[];
}

export class CreateScheduleEventDto {
  @ApiProperty({ example: 1, description: 'Den v týdnu (1=Po, 5=Pá)' })
  dayOfWeek: number;

  @ApiProperty({ example: 3, description: 'Číslo hodiny' })
  lessonNumber: number;

  @ApiProperty()
  subjectInstanceId: string;

  @ApiProperty()
  classroomId: string;

  @ApiProperty()
  teacherId: string;

  @ApiPropertyOptional()
  roomId?: string;

  @ApiProperty()
  academicYearId: string;
}

export class UpdateScheduleEventDto {
  @ApiPropertyOptional({ example: 2 })
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: 4 })
  lessonNumber?: number;

  @ApiPropertyOptional()
  subjectInstanceId?: string;

  @ApiPropertyOptional()
  classroomId?: string;

  @ApiPropertyOptional()
  teacherId?: string;

  @ApiPropertyOptional()
  roomId?: string;
}

export class CreateSubstitutionDto {
  @ApiProperty({ example: '2024-03-15' })
  date: string;

  @ApiProperty()
  originalEventId: string;

  @ApiProperty({
    example: 'SUBSTITUTION',
    enum: ['SUBSTITUTION', 'CANCELLED', 'MERGED', 'ROOM_CHANGE'],
  })
  type: string;

  @ApiPropertyOptional({ example: 'Učitel nemocen' })
  note?: string;

  @ApiPropertyOptional()
  substituteTeacherId?: string;

  @ApiPropertyOptional()
  substituteRoomId?: string;

  @ApiPropertyOptional()
  substituteSubjectId?: string;
}

// ─── MESSAGING DTOs ─────────────────────────────────────

export class CreateConversationDto {
  @ApiProperty({ type: [String], description: 'ID příjemců' })
  recipientIds: string[];

  @ApiPropertyOptional({ example: 'Dotaz k domácímu úkolu' })
  subject?: string;

  @ApiPropertyOptional({
    example: 'DIRECT',
    enum: ['DIRECT', 'GROUP', 'CLASS'],
  })
  type?: string;

  @ApiPropertyOptional()
  classroomId?: string;

  @ApiPropertyOptional({ example: 'Dobrý den, mám dotaz...' })
  initialMessage?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Text zprávy' })
  content: string;
}

export class ClassBroadcastDto {
  @ApiProperty()
  classroomId: string;

  @ApiProperty({ example: 'Informace o výletu' })
  subject: string;

  @ApiProperty({ example: 'Vážení rodiče...' })
  message: string;
}

export class SchoolBroadcastDto {
  @ApiProperty({ example: 'Ředitelské volno' })
  subject: string;

  @ApiProperty({ example: 'Oznamujeme...' })
  message: string;
}

// ─── COMMUNITY DTOs ─────────────────────────────────────

export class CreateBulletinPostDto {
  @ApiProperty({ example: 'Nový kroužek robotiky' })
  title: string;

  @ApiProperty({ example: 'Od příštího týdne spouštíme...' })
  content: string;

  @ApiPropertyOptional({ example: false })
  pinned?: boolean;
}

export class CreatePollDto {
  @ApiProperty({ example: 'Kam na školní výlet?' })
  question: string;

  @ApiProperty({ type: [String], example: ['Praha', 'Brno', 'Olomouc'] })
  options: string[];

  @ApiPropertyOptional({ example: false })
  multiSelect?: boolean;

  @ApiPropertyOptional({ example: '2024-04-01T00:00:00.000Z' })
  endsAt?: string;
}

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Školní výlet' })
  title: string;

  @ApiPropertyOptional({ example: 'Jednodenní výlet do Prahy' })
  description?: string;

  @ApiProperty({ example: '2024-04-15T08:00:00.000Z' })
  startDate: string;

  @ApiPropertyOptional({ example: '2024-04-15T17:00:00.000Z' })
  endDate?: string;

  @ApiPropertyOptional({ example: 'Praha' })
  location?: string;
}

export class RsvpDto {
  @ApiProperty({ example: 'YES', enum: ['YES', 'NO', 'MAYBE'] })
  status: 'YES' | 'NO' | 'MAYBE';
}

// ─── CLASSBOOK DTOs ─────────────────────────────────────

export class UpsertClassbookEntryDto {
  @ApiProperty()
  classroomId: string;

  @ApiProperty({ example: '2024-03-15' })
  date: string;

  @ApiProperty({ example: 3 })
  lessonNumber: number;

  @ApiPropertyOptional({ example: 'Lineární rovnice – procvičování' })
  topic?: string;

  @ApiPropertyOptional({ example: 'Bylo zadáno DÚ' })
  notes?: string;

  @ApiPropertyOptional({ example: 2 })
  absentCount?: number;

  @ApiPropertyOptional()
  scheduleEventId?: string;

  @ApiPropertyOptional({ example: 'Matematika' })
  subjectName?: string;
}

// ─── DEPUTY DTOs ────────────────────────────────────────

export class CreateClassroomDto {
  @ApiProperty({ example: '5.A' })
  name: string;

  @ApiProperty({ example: 5 })
  grade: number;
}

export class CreateSubjectDto {
  @ApiProperty({ example: 'Matematika' })
  name: string;

  @ApiProperty({ example: 'MAT' })
  code: string;

  @ApiPropertyOptional({ description: 'Popis v ŠVP' })
  svpDescription?: string;
}

export class CreateRoomDto {
  @ApiProperty({ example: 'Učebna 101' })
  name: string;

  @ApiPropertyOptional({ example: 30 })
  capacity?: number;

  @ApiPropertyOptional({ example: true })
  isComputerLab?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['projektor', 'interaktivní tabule'],
  })
  specialEquipment?: string[];

  @ApiPropertyOptional()
  buildingId?: string;

  @ApiPropertyOptional({ example: 1 })
  floor?: number;
}

export class InviteSchoolUserDto {
  @ApiProperty({ example: 'novak@example.com' })
  email: string;

  @ApiProperty({ example: 'Jan' })
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  lastName: string;

  @ApiProperty({
    example: 'TEACHER',
    enum: [
      'STUDENT',
      'TEACHER',
      'PARENT',
      'DEPUTY',
      'PRINCIPAL',
      'ADMIN',
      'DIRECTOR',
    ],
  })
  role: string;

  @ApiPropertyOptional({ example: 100, description: 'Procentuální úvazek' })
  workloadPercentage?: number;
}

export class CreateSchoolEventDto {
  @ApiProperty({ example: 'Pedagogická rada' })
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ example: '2024-03-20' })
  date: string;

  @ApiPropertyOptional({ example: '2024-03-20' })
  endDate?: string;

  @ApiPropertyOptional({
    example: 'MEETING',
    enum: ['MEETING', 'HOLIDAY', 'EXAM', 'TRIP', 'OTHER'],
  })
  type?: string;

  @ApiPropertyOptional({ example: false })
  allDay?: boolean;
}

// ─── GENERIC RESPONSES ──────────────────────────────────

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional({ example: 'Operace proběhla úspěšně.' })
  message?: string;
}

export class CountResponseDto {
  @ApiProperty({ example: 5 })
  count: number;
}

export class ToggleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: true })
  enabled: boolean;
}

export class LoginHelperUserDto {
  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ example: 'Jan' })
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  lastName: string;

  @ApiProperty({
    example: [{ schoolName: 'ZŠ Příkladná', role: 'ADMIN' }],
    description: 'Seznam škol a rolí uživatele',
  })
  memberships: Array<{ schoolName: string; role: string }>;
}

export class LoginHelperConfigDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: 'Heslo123!' })
  defaultPassword?: string;
}
