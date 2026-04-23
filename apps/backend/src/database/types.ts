export enum UserRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  ADMIN = 'ADMIN',
  TEACHER = 'TEACHER',
  DEPUTY = 'DEPUTY',
  PRINCIPAL = 'PRINCIPAL',
  STUDENT = 'STUDENT',
  PARENT = 'PARENT',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INVITED = 'INVITED',
  REJECTED = 'REJECTED',
}

export enum SecretType {
  AI = 'AI',
  SSO = 'SSO',
}

export enum SubstitutionType {
  CANCELED = 'CANCELED',
  SUBSTITUTION = 'SUBSTITUTION',
  ROOM_CHANGE = 'ROOM_ROOM_CHANGE',
  OTHER = 'OTHER',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
  UNEXCUSED = 'UNEXCUSED',
}

export interface SystemLog {
  id: number;
  message: string;
  createdAt: Date;
}

export interface School {
  id: string;
  name: string;
  address: string | null;
  contactEmail: string | null;
  allowStudentSelfRegistration: boolean;
  requireSsoEmailMatch: boolean;
  ssoConfig: string | null; // JSON string
  aiConfig: string | null; // JSON string
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  avatarUrl: string | null;
  isSystemAdmin: boolean;
  emailNotificationsEnabled: boolean;
  invitationToken: string | null;
  invitationExpires: Date | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLogin: Date | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface SchoolMembership {
  id: string;
  userId: string;
  schoolId: string;
  role:
    | 'SYSTEM_ADMIN'
    | 'ADMIN'
    | 'TEACHER'
    | 'DEPUTY'
    | 'PRINCIPAL'
    | 'STUDENT'
    | 'PARENT';
  status: 'PENDING' | 'ACTIVE' | 'INVITED' | 'REJECTED';
  workloadPercentage: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParentStudent {
  id: string;
  parentId: string;
  studentId: string;
  createdAt: Date;
}

export interface Identity {
  id: string;
  provider: string;
  providerId: string;
  userId: string;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string | null;
  schoolId: string | null;
  oldValues: string | null; // JSON string
  newValues: string | null; // JSON string
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface Classroom {
  id: string;
  name: string;
  grade: number;
  schoolId: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  rc: string | null;
  classroomId: string | null;
}

export interface TeacherProfile {
  id: string;
  userId: string;
  degree: string | null;
  approbation: string | null;
  homeroomClassId: string | null;
}

export interface SubjectTemplate {
  id: string;
  name: string;
  code: string;
  svpDescription: string | null;
  schoolId: string;
  curriculumVersionId: string | null;
}

export interface SubjectInstance {
  id: string;
  hoursPerWeek: number;
  templateId: string;
  academicYearId: string;
  gradeLevelId: string;
  curriculumVersionId: string | null;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Grade {
  id: string;
  value: string;
  weight: number;
  description: string | null;
  date: Date;
  type: 'NUMERIC' | 'VERBAL' | 'PASS_FAIL';
  verbalText: string | null;
  category: string | null;
  schoolId: string;
  studentId: string;
  subjectInstanceId: string;
  teacherId: string;
  academicYearId: string | null;
  semesterId: string | null;
  createdAt: Date;
}

export interface ReportCard {
  id: string;
  finalGrade: string | null;
  verbalEvaluation: string | null;
  aiPolished: boolean;
  studentId: string;
  subjectInstanceId: string;
  semesterId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleEvent {
  id: string;
  dayOfWeek: number;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  schoolId: string;
  subjectInstanceId: string;
  classroomId: string;
  teacherId: string;
  roomId: string | null;
  academicYearId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonTimeSlot {
  id: string;
  lessonNumber: number;
  startTime: string;
  endTime: string;
  label: string | null;
  breakAfter: number;
  schoolId: string;
}

export interface ScheduleSubstitution {
  id: string;
  date: Date;
  type: string;
  note: string | null;
  originalEventId: string;
  substituteTeacherId: string | null;
  substituteRoomId: string | null;
  substituteSubjectId: string | null;
  createdById: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attendance {
  id: string;
  date: Date;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'UNEXCUSED';
  note: string | null;
  lessonNumber: number | null;
  schoolId: string;
  studentId: string;
  teacherId: string;
  createdAt: Date;
}

export interface AbsenceExcuse {
  id: string;
  reason: string;
  dateFrom: Date;
  dateTo: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  parentId: string;
  studentId: string;
  schoolId: string;
  reviewedById: string | null;
  createdAt: Date;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number | null;
  isComputerLab: boolean;
  specialEquipment: string | null; // JSON string
  schoolId: string;
  buildingId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Building {
  id: string;
  name: string;
  address: string | null;
  floors: number;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoomSharing {
  id: string;
  roomId: string;
  sharedWithSchoolId: string;
  createdAt: Date;
}

export interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  date: Date;
  endDate: Date | null;
  type: string;
  allDay: boolean;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  schoolId: string;
  curriculumVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GradeLevel {
  id: string;
  name: string;
  levelNumber: number;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentEnrollment {
  id: string;
  studentId: string;
  academicYearId: string;
  gradeLevelId: string;
  classroomId: string | null;
  residentialAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherWorkload {
  id: string;
  teacherId: string;
  academicYearId: string;
  workloadPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffWorkload {
  id: string;
  userId: string;
  academicYearId: string;
  versionLabel: string;
  validFrom: Date;
  teachingLoad: number;
  adminLoad: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffSubjectAssignment {
  id: string;
  staffWorkloadId: string;
  subjectTemplateId: string;
  gradeLevelIds: string; // JSON string
  canSubstitute: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Semester {
  id: string;
  number: number;
  name: string;
  startDate: Date;
  endDate: Date;
  academicYearId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurriculumVersion {
  id: string;
  name: string;
  validFrom: Date;
  validTo: Date | null;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CurriculumEntry {
  id: string;
  hoursPerWeek: number;
  rvpDescription: string | null;
  svpApproach: string | null;
  equipmentRequirements: string | null; // JSON string
  needsComputerLab: boolean;
  gradingType: string;
  curriculumVersionId: string;
  subjectTemplateId: string;
  gradeLevelId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SystemSettings {
  id: string;
  geminiApiKey: string | null;
  openAiApiKey: string | null;
  anthropicApiKey: string | null;
  updatedAt: Date;
}

export interface SystemSecret {
  id: string;
  type: string;
  service: string;
  key: string;
  value: string;
  isActive: boolean;
  metadata: string | null; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

export interface AiTokenUsage {
  id: string;
  userId: string;
  schoolId: string | null;
  provider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  promptType: string;
  createdAt: Date;
}

export interface GlobalConfig {
  key: string;
  value: string;
  updatedAt: Date;
}

export interface ThematicPlan {
  id: string;
  title: string;
  subjectTemplateId: string;
  academicYearId: string;
  gradeLevelId: string;
  teacherId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThematicPlanWeek {
  id: string;
  weekNumber: number;
  topic: string;
  objectives: string | null;
  methods: string | null;
  resources: string | null;
  crossCurricular: string | null;
  notes: string | null;
  planId: string;
}

export interface LessonPreparation {
  id: string;
  title: string;
  date: Date;
  duration: number;
  topic: string;
  objectives: string | null;
  activities: string | null;
  materials: string | null;
  homework: string | null;
  evaluation: string | null;
  subjectTemplateId: string;
  teacherId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeachingMaterial {
  id: string;
  title: string;
  description: string | null;
  url: string;
  type: string;
  subjectTemplateId: string | null;
  gradeLevelId: string | null;
  uploadedById: string;
  schoolId: string;
  createdAt: Date;
}

export interface RvpCompetency {
  id: string;
  code: string;
  name: string;
  area: string;
  description: string | null;
  schoolId: string;
}

export interface CompetencyMapping {
  id: string;
  competencyId: string;
  subjectTemplateId: string;
  gradeLevelId: string;
  fulfilled: boolean;
  note: string | null;
}

export interface BehaviorGrade {
  id: string;
  grade: number;
  note: string | null;
  studentId: string;
  semesterId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetencyGrade {
  id: string;
  level: number;
  note: string | null;
  studentId: string;
  competencyId: string;
  subjectInstanceId: string;
  semesterId: string;
  schoolId: string;
  teacherId: string;
  createdAt: Date;
}

export interface EducationalMeasure {
  id: string;
  type: string;
  reason: string;
  date: Date;
  studentId: string;
  issuedById: string;
  schoolId: string;
  semesterId: string | null;
  createdAt: Date;
}

export interface CommissionExam {
  id: string;
  date: Date;
  originalGrade: string;
  newGrade: string | null;
  note: string | null;
  studentId: string;
  subjectInstanceId: string;
  semesterId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassificationDeadline {
  id: string;
  deadline: Date;
  isLocked: boolean;
  semesterId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulletinPost {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  authorId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Poll {
  id: string;
  question: string;
  multiSelect: boolean;
  endsAt: Date | null;
  authorId: string;
  schoolId: string;
  createdAt: Date;
}

export interface PollOption {
  id: string;
  text: string;
  pollId: string;
}

export interface PollVote {
  id: string;
  userId: string;
  optionId: string;
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  authorId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventRsvp {
  id: string;
  userId: string;
  eventId: string;
  status: string;
  createdAt: Date;
}

export interface ClassBookEntry {
  id: string;
  date: Date;
  lessonNumber: number;
  topic: string | null;
  notes: string | null;
  absentCount: number | null;
  schoolId: string;
  classroomId: string;
  teacherId: string;
  scheduleEventId: string | null;
  subjectName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeacherSignature {
  id: string;
  classBookEntryId: string;
  teacherId: string;
  signedAt: Date;
  ipAddress: string | null;
}
