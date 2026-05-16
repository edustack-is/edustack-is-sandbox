import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsUUID,
  IsEnum,
  IsDateString,
  ValidateNested,
  IsUrl,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── AUTH DTOs ──────────────────────────────────────────

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  access_token: string;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invitation token z e-mailu' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Nové heslo uživatele', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token z e-mailu' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Nové heslo', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'Současné heslo' })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({ description: 'Nové heslo', minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class SelectSchoolResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  access_token: string;
}

export class UserProfileDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jan' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isSystemAdmin: boolean;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @IsDateString()
  createdAt: string;

  @ApiPropertyOptional({
    description: 'Profil studenta (null pokud není student)',
    example: {
      id: 'sp-uuid',
      classroomId: 'cr-uuid',
      classroom: { id: 'cr-uuid', name: '5.A', homeroomTeacher: null },
    },
  })
  @IsOptional()
  studentProfile?: any;

  @ApiPropertyOptional({
    description: 'Profil učitele (null pokud není učitel)',
    example: { id: 'tp-uuid', homeroomClass: { id: 'cr-uuid', name: '5.A' } },
  })
  @IsOptional()
  teacherProfile?: any;
}

export class SchoolListItemDto {
  @ApiProperty({
    example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f',
    description: 'ID členství (SchoolMembership)',
  })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  @IsUUID()
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
  @IsEnum([
    'STUDENT',
    'TEACHER',
    'PARENT',
    'DEPUTY',
    'PRINCIPAL',
    'ADMIN',
    'DIRECTOR',
  ])
  role: string;

  @ApiProperty({ example: 'ACTIVE' })
  @IsString()
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
  @IsNotEmpty()
  school: any;
}

/** @deprecated getSsoOptions vrací string[] (pole názvů providerů), ne objekt */
export class SsoOptionDto {
  @ApiProperty({
    example: 'google',
    description:
      'Endpoint vrací pole stringů, např. ["google","microsoft"]. Tato třída slouží jako reference.',
  })
  @IsString()
  provider: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}

export class InviteUserBodyDto {
  @ApiPropertyOptional({ description: 'ID studenta pro propojení s rodičem' })
  @IsOptional()
  @IsUUID()
  studentId?: string;
}

// ─── GRADING DTOs ───────────────────────────────────────

export class CreateGradeDto {
  @ApiProperty({ example: 'uuid-student-id' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: 'uuid-subject-instance-id' })
  @IsUUID()
  subjectInstanceId: string;

  @ApiProperty({ example: '2', description: 'Hodnota známky (1-5 nebo N)' })
  @IsString()
  @IsNotEmpty()
  value: string;

  @ApiProperty({ example: 1, description: 'Váha známky (1-10)', minimum: 1 })
  @IsNumber()
  @Min(1)
  @Max(10)
  weight: number;

  @ApiPropertyOptional({ example: 'Písemka z rovnic' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'EXAM',
    enum: ['EXAM', 'TEST', 'HOMEWORK', 'PROJECT', 'ORAL', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['EXAM', 'TEST', 'HOMEWORK', 'PROJECT', 'ORAL', 'OTHER'])
  type?: string;

  @ApiPropertyOptional({ description: 'Slovní hodnocení' })
  @IsOptional()
  @IsString()
  verbalText?: string;

  @ApiPropertyOptional({
    example: 'algebra',
    description: 'Tematická kategorie',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'uuid-semester-id' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;
}

export class UpdateGradeDto {
  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  weight?: number;

  @ApiPropertyOptional({ example: 'Opravená písemka' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verbalText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}

export class GradeResponseDto {
  @ApiProperty({ example: 'c3a1f2d4-5e6b-7c8d-9e0f-1a2b3c4d5e6f' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: '2' })
  @IsString()
  value: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  weight: number;

  @ApiPropertyOptional({ example: 'Písemka z rovnic' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'EXAM' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 'algebra' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Dobře zvládnuté základy.' })
  @IsOptional()
  @IsString()
  verbalText?: string;

  @ApiProperty({ example: 'c3a1f2d4-0000-0000-0000-1a2b3c4d5e6f' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: 'c3a1f2d4-1111-1111-1111-1a2b3c4d5e6f' })
  @IsUUID()
  subjectInstanceId: string;

  @ApiProperty({ example: 'c3a1f2d4-2222-2222-2222-1a2b3c4d5e6f' })
  @IsUUID()
  teacherProfileId: string;

  @ApiPropertyOptional({ example: 'c3a1f2d4-3333-3333-3333-1a2b3c4d5e6f' })
  @IsOptional()
  @IsUUID()
  semesterId?: string;

  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' })
  @IsDateString()
  createdAt: string;

  @ApiProperty({ example: '2024-03-15T10:30:00.000Z' })
  @IsDateString()
  updatedAt: string;
}

export class UpsertReportCardDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  subjectInstanceId: string;

  @ApiProperty()
  @IsUUID()
  semesterId: string;

  @ApiPropertyOptional({
    example: '2',
    description: 'Výsledná známka na vysvědčení',
  })
  @IsOptional()
  @IsString()
  finalGrade?: string;

  @ApiPropertyOptional({ description: 'Slovní hodnocení na vysvědčení' })
  @IsOptional()
  @IsString()
  verbalEvaluation?: string;

  @ApiPropertyOptional({ description: 'Zda bylo slovní hodnocení AI upraveno' })
  @IsOptional()
  @IsBoolean()
  aiPolished?: boolean;
}

export class PolishTextDto {
  @ApiProperty({ description: 'Text k vylepšení' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ example: 'Jan Novák' })
  @IsString()
  @IsNotEmpty()
  studentName: string;

  @ApiProperty({ example: 'Matematika' })
  @IsString()
  @IsNotEmpty()
  subjectName: string;

  // Optional refinement prompt from the teacher when they iterate on
  // the variants. Empty / undefined on the first call.
  @ApiProperty({ required: false, example: 'Více pozitivní, méně formální.' })
  @IsString()
  @IsOptional()
  feedback?: string;

  // ISO 639-1 code (cs/en …). Backend tells the model which language
  // to produce, so the teacher gets variants in their UI language by
  // default. Defaults to Czech for backwards compatibility.
  @ApiProperty({ required: false, example: 'cs' })
  @IsString()
  @IsOptional()
  language?: string;
}

export class TranslateTextDto {
  @ApiProperty({ description: 'Text to translate' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'Target language (ISO 639-1)', example: 'en' })
  @IsString()
  @IsNotEmpty()
  targetLanguage: string;
}

export class BehaviorGradeDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  semesterId: string;

  @ApiProperty({
    example: 1,
    description: '1 = velmi dobré, 2 = uspokojivé, 3 = neuspokojivé',
  })
  @IsInt()
  @Min(1)
  @Max(3)
  grade: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CompetencyGradeDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  competencyId: string;

  @ApiProperty()
  @IsUUID()
  subjectInstanceId: string;

  @ApiProperty()
  @IsUUID()
  semesterId: string;

  @ApiProperty({ example: 3, description: 'Úroveň 1-5' })
  @IsInt()
  @Min(1)
  @Max(5)
  level: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class MeasureDto {
  @ApiProperty()
  @IsUUID()
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
  @IsEnum([
    'PRAISE',
    'REPRIMAND',
    'CLASS_REPRIMAND',
    'PRINCIPAL_REPRIMAND',
    'REDUCED_BEHAVIOR',
  ])
  type: string;

  @ApiProperty({ example: 'Výborné výsledky v soutěži' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  semesterId?: string;
}

export class CreateCommissionExamDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  subjectInstanceId: string;

  @ApiProperty()
  @IsUUID()
  semesterId: string;

  @ApiProperty({ example: '4' })
  @IsString()
  @IsNotEmpty()
  originalGrade: string;

  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  newGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCommissionExamDto {
  @ApiPropertyOptional({ example: '3' })
  @IsOptional()
  @IsString()
  newGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertDeadlineDto {
  @ApiProperty()
  @IsUUID()
  semesterId: string;

  @ApiProperty({ example: '2024-06-30' })
  @IsDateString()
  deadline: string;
}

export class LockClassificationDto {
  @ApiProperty()
  @IsUUID()
  semesterId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  lock: boolean;
}

// ─── ATTENDANCE DTOs ────────────────────────────────────

export class AttendanceRecordItemDto {
  @ApiProperty({ example: 'uuid-student-id' })
  @IsUUID()
  studentId: string;

  @ApiProperty({
    example: 'PRESENT',
    enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'UNEXCUSED'],
  })
  @IsEnum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'UNEXCUSED'])
  status: string;

  @ApiPropertyOptional({ example: 'Přišel pozdě 5 minut' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RecordAttendanceDto {
  @ApiProperty({ example: '2024-03-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 3, description: 'Číslo vyučovací hodiny' })
  @IsInt()
  @Min(0)
  lessonNumber: number;

  @ApiProperty({ example: 'uuid-classroom-id' })
  @IsUUID()
  classroomId: string;

  @ApiProperty({ type: [AttendanceRecordItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records: AttendanceRecordItemDto[];
}

export class CreateExcuseDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: 'Nemoc' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ example: '2024-03-15' })
  @IsDateString()
  dateFrom: string;

  @ApiProperty({ example: '2024-03-17' })
  @IsDateString()
  dateTo: string;
}

export class ReviewExcuseDto {
  @ApiProperty({ example: 'APPROVED', enum: ['APPROVED', 'REJECTED'] })
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}

// ─── SCHEDULE DTOs ──────────────────────────────────────

export class TimeSlotDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  lessonNumber: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ example: '08:45' })
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({ example: '1. hodina' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Přestávka po hodině (minuty)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  breakAfter?: number;
}

export class UpsertTimeSlotsDto {
  @ApiProperty({ type: [TimeSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimeSlotDto)
  slots: TimeSlotDto[];
}

export class CreateScheduleEventDto {
  @ApiProperty({ example: 1, description: 'Den v týdnu (1=Po, 5=Pá)' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: 3, description: 'Číslo hodiny' })
  @IsInt()
  @Min(0)
  lessonNumber: number;

  @ApiProperty()
  @IsUUID()
  subjectInstanceId: string;

  @ApiProperty()
  @IsUUID()
  classroomId: string;

  @ApiProperty()
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty()
  @IsUUID()
  academicYearId: string;
}

export class UpdateScheduleEventDto {
  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lessonNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  subjectInstanceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;
}

export class CreateSubstitutionDto {
  @ApiProperty({ example: '2024-03-15' })
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsUUID()
  originalEventId: string;

  @ApiProperty({
    example: 'SUBSTITUTION',
    enum: ['SUBSTITUTION', 'CANCELLED', 'MERGED', 'ROOM_CHANGE'],
  })
  @IsEnum(['SUBSTITUTION', 'CANCELLED', 'MERGED', 'ROOM_CHANGE'])
  type: string;

  @ApiPropertyOptional({ example: 'Učitel nemocen' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  substituteTeacherId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  substituteRoomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  substituteSubjectId?: string;
}

// ─── MESSAGING DTOs ─────────────────────────────────────

export class CreateConversationDto {
  @ApiProperty({ type: [String], description: 'ID příjemců' })
  @IsArray()
  @IsUUID('4', { each: true })
  recipientIds: string[];

  @ApiPropertyOptional({ example: 'Dotaz k domácímu úkolu' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    example: 'DIRECT',
    enum: ['DIRECT', 'GROUP', 'CLASS'],
  })
  @IsOptional()
  @IsEnum(['DIRECT', 'GROUP', 'CLASS'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiPropertyOptional({ example: 'Dobrý den, mám dotaz...' })
  @IsOptional()
  @IsString()
  initialMessage?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Text zprávy' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ClassBroadcastDto {
  @ApiProperty()
  @IsUUID()
  classroomId: string;

  @ApiProperty({ example: 'Informace o výletu' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'Vážení rodiče...' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

export class SchoolBroadcastDto {
  @ApiProperty({ example: 'Ředitelské volno' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'Oznamujeme...' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

// ─── COMMUNITY DTOs ─────────────────────────────────────

export class CreateBulletinPostDto {
  @ApiProperty({ example: 'Nový kroužek robotiky' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Od příštího týdne spouštíme...' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreatePollDto {
  @ApiProperty({ example: 'Kam na školní výlet?' })
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ type: [String], example: ['Praha', 'Brno', 'Olomouc'] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  options: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  multiSelect?: boolean;

  @ApiPropertyOptional({ example: '2024-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Školní výlet' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'Jednodenní výlet do Prahy' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-04-15T08:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2024-04-15T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Praha' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class RsvpDto {
  @ApiProperty({ example: 'YES', enum: ['YES', 'NO', 'MAYBE'] })
  @IsEnum(['YES', 'NO', 'MAYBE'])
  status: 'YES' | 'NO' | 'MAYBE';
}

// ─── CLASSBOOK DTOs ─────────────────────────────────────

export class UpsertClassbookEntryDto {
  @ApiProperty()
  @IsUUID()
  classroomId: string;

  @ApiProperty({ example: '2024-03-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(0)
  lessonNumber: number;

  @ApiPropertyOptional({ example: 'Lineární rovnice – procvičování' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ example: 'Bylo zadáno DÚ' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  absentCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  scheduleEventId?: string;

  @ApiPropertyOptional({ example: 'Matematika' })
  @IsOptional()
  @IsString()
  subjectName?: string;
}

// ─── DEPUTY DTOs ────────────────────────────────────────

export class CreateClassroomDto {
  @ApiProperty({ example: '5.A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Max(13)
  grade: number;
}

export class CreateStudentProfileDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 'Jan' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classroomId?: string | null;
}

export class CreateTeacherProfileDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ example: 'Mgr.' })
  @IsOptional()
  @IsString()
  degree?: string | null;

  @ApiPropertyOptional({ example: 'Matematika, Fyzika' })
  @IsOptional()
  @IsString()
  approbation?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  homeroomClassId?: string | null;
}

export class CreateSubjectDto {
  @ApiProperty({ example: 'Matematika' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MAT' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ description: 'Popis v ŠVP' })
  @IsOptional()
  @IsString()
  svpDescription?: string;
}

export class CreateRoomDto {
  @ApiProperty({ example: 'Učebna 101' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isComputerLab?: boolean;

  @ApiPropertyOptional({
    type: [String],
    example: ['projektor', 'interaktivní tabule'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialEquipment?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  buildingId?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  floor?: number;
}

export class InviteSchoolUserDto {
  @ApiProperty({ example: 'novak@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jan' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  @IsString()
  @IsNotEmpty()
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
  @IsEnum([
    'STUDENT',
    'TEACHER',
    'PARENT',
    'DEPUTY',
    'PRINCIPAL',
    'ADMIN',
    'DIRECTOR',
  ])
  role: string;

  @ApiPropertyOptional({ example: 100, description: 'Procentuální úvazek' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  workloadPercentage?: number;
}

export class CreateSchoolEventDto {
  @ApiProperty({ example: 'Pedagogická rada' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2024-03-20' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: '2024-03-20' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: 'MEETING',
    enum: ['MEETING', 'HOLIDAY', 'EXAM', 'TRIP', 'OTHER'],
  })
  @IsOptional()
  @IsEnum(['MEETING', 'HOLIDAY', 'EXAM', 'TRIP', 'OTHER'])
  type?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}

// ─── GENERIC RESPONSES ──────────────────────────────────

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiPropertyOptional({ example: 'Operace proběhla úspěšně.' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class CountResponseDto {
  @ApiProperty({ example: 5 })
  @IsInt()
  count: number;
}

export class ToggleResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

export class LoginHelperUserDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jan' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Novák' })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: [{ schoolName: 'ZŠ Příkladná', role: 'ADMIN' }],
    description: 'Seznam škol a rolí uživatele',
  })
  @IsArray()
  memberships: Array<{ schoolName: string; role: string }>;
}

export class LoginHelperConfigDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: 'Heslo123!' })
  @IsOptional()
  @IsString()
  defaultPassword?: string;
}
