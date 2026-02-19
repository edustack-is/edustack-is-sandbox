import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ErrorResponseDto } from './common/dto/error-response.dto';
import { LoginDto, LoginResponseDto, AcceptInviteDto, ForgotPasswordDto, ResetPasswordDto, SelectSchoolResponseDto, UserProfileDto, SchoolListItemDto, SsoOptionDto, CreateGradeDto, UpdateGradeDto, GradeResponseDto, RecordAttendanceDto, AttendanceRecordItemDto, CreateScheduleEventDto, CreateSubstitutionDto, CreateConversationDto, SendMessageDto, CreateBulletinPostDto, CreatePollDto, CreateCalendarEventDto, UpsertClassbookEntryDto, CreateClassroomDto, CreateSubjectDto, CreateRoomDto, InviteSchoolUserDto, SuccessResponseDto, CountResponseDto, ToggleResponseDto } from './common/dto/api.dto';
import {
  ClassroomResponseDto, SubjectResponseDto, RoomResponseDto, BuildingResponseDto,
  SchoolEventResponseDto, SchoolUserResponseDto, StudentFamilyResponseDto,
  AuditLogEntryDto, SchoolSettingsResponseDto,
  AcademicYearResponseDto, GradeLevelResponseDto, SubjectInstanceResponseDto,
  TeacherWorkloadResponseDto, CurriculumVersionResponseDto, CurriculumEntryResponseDto,
  CompetencyResponseDto, SemesterResponseDto, ThematicPlanResponseDto,
  TeachingMaterialResponseDto, LessonPlanResponseDto, EnrollmentResponseDto,
  ScheduleEventResponseDto, ScheduleMatrixResponseDto, SubstitutionResponseDto,
  CollisionResultDto, SnapshotResponseDto, RecurringEventResponseDto,
  AttendanceRecordResponseDto, ExcuseResponseDto, AttendanceStatsResponseDto, UnexcusedAlertDto,
  ConversationResponseDto, MessageResponseDto, NotificationResponseDto, RecipientResponseDto,
  BulletinPostResponseDto, PollResponseDto, CommunityEventResponseDto,
  ClassbookEntryResponseDto,
  ReportCardResponseDto, GradingTypeResponseDto, BehaviorGradeResponseDto,
  CompetencyGradeResponseDto, MeasureResponseDto, GradeHistoryEntryDto,
  CommissionExamResponseDto, GradingDeadlineResponseDto,
  SchoolDashboardResponseDto, SharedRoomResponseDto,
  SsoIdentityResponseDto, UploadResultDto, ImportResultDto,
  StudentDataResponseDto, ChildDashboardResponseDto, ParentChildResponseDto,
  TeacherClassResponseDto,
  SystemDashboardResponseDto, SchoolResponseDto, SsoConfigResponseDto,
  AiConfigResponseDto, AiUsageResponseDto, AiTextResponseDto,
  BackupResponseDto, HealthCheckResponseDto, MetricsResponseDto,
  RvpUploadResponseDto, CompetencyMatrixResponseDto,
  CurriculumDiffResponseDto, ScheduleDiffResponseDto, GenerateScheduleResultDto,
  GdprDataResponseDto, InitStatusResponseDto, SeedFileResponseDto,
  ReportStatsResponseDto, RegistryClassroomResponseDto,
  SystemSettingsResponseDto, PaginatedUsersResponseDto,
} from './common/dto/response.dto';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { InitService } from './init/init.service';
import { SeedService } from './init/seed.service';
import helmet from 'helmet';

async function bootstrap() {
  // ─── Fail-fast: required environment variables ──────────────
  const missingVars: string[] = [];
  if (!process.env.JWT_SECRET) missingVars.push('JWT_SECRET       (generate with: openssl rand -base64 64)');
  if (!process.env.ENCRYPTION_KEY) missingVars.push('ENCRYPTION_KEY   (generate with: openssl rand -base64 32)');

  if (missingVars.length > 0) {
    console.error(
      '\n❌  Required environment variables are not set!\n' +
      '    The application cannot start without them.\n\n' +
      missingVars.map(v => `    • ${v}`).join('\n') + '\n\n' +
      '    Add them to your .env file and restart.\n',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // ─── Security headers (Helmet) ─────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      }
      : false, // Disable in dev — Swagger UI and Vite HMR need inline scripts
  }));

  // ─── CORS ──────────────────────────────────────────────────────
  // CORS_ORIGIN accepts a single origin or comma-separated list.
  // Examples:
  //   CORS_ORIGIN=https://app.example.com
  //   CORS_ORIGIN=https://app.example.com,https://admin.example.com
  const rawOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const allowedOrigins = rawOrigin.split(',').map(o => o.trim()).filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-setup-token'],
  });

  // ─── Global validation pipe ────────────────────────────────────
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,               // strip properties not in DTO
    forbidNonWhitelisted: true,    // reject requests with unknown properties
    transform: true,               // auto-transform payloads to DTO instances
  }));

  // ─── Swagger / OpenAPI (disabled in production) ─────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('EduStack IS API')
      .setDescription('Školní informační systém – REST API dokumentace')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .addTag('auth', 'Autentizace a pozvánky')
      .addTag('init', 'Inicializace systému')
      .addTag('student', 'Studentský modul')
      .addTag('parent', 'Rodičovský modul')
      .addTag('teacher', 'Učitelský modul')
      .addTag('deputy', 'Zástupce školy – administrativa a kurikulum')
      .addTag('principal', 'Ředitel – audit a vedení')
      .addTag('system', 'Systémová administrace')
      .addTag('users', 'Správa uživatelů a pozvánek')
      .addTag('grading', 'Klasifikace a hodnocení')
      .addTag('schedule', 'Rozvrh a suplování')
      .addTag('messaging', 'Komunikace a notifikace')
      .addTag('attendance', 'Docházka')
      .addTag('community', 'Komunita – nástěnka, ankety, události')
      .addTag('classbook', 'Třídní kniha')
      .addTag('ai', 'AI funkce – generování, analýza, moderace')
      .addTag('registry', 'Matrika – MŠMT registry')
      .addTag('export', 'Export dat – CSV/XML/JSON')
      .addTag('reports', 'Reporty – statistiky, výkazy ČŠI/MŠMT')
      .addTag('gdpr', 'GDPR – export a smazání osobních dat')
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [
        // Error
        ErrorResponseDto,
        // api.dto.ts (request + generic)
        LoginDto, LoginResponseDto, AcceptInviteDto, ForgotPasswordDto, ResetPasswordDto,
        SelectSchoolResponseDto, UserProfileDto, SchoolListItemDto, SsoOptionDto,
        CreateGradeDto, UpdateGradeDto, GradeResponseDto,
        RecordAttendanceDto, AttendanceRecordItemDto,
        CreateScheduleEventDto, CreateSubstitutionDto,
        CreateConversationDto, SendMessageDto,
        CreateBulletinPostDto, CreatePollDto, CreateCalendarEventDto,
        UpsertClassbookEntryDto,
        CreateClassroomDto, CreateSubjectDto, CreateRoomDto, InviteSchoolUserDto,
        SuccessResponseDto, CountResponseDto, ToggleResponseDto,
        // response.dto.ts (entity responses)
        ClassroomResponseDto, SubjectResponseDto, RoomResponseDto, BuildingResponseDto,
        SchoolEventResponseDto, SchoolUserResponseDto, StudentFamilyResponseDto,
        AuditLogEntryDto, SchoolSettingsResponseDto,
        AcademicYearResponseDto, GradeLevelResponseDto, SubjectInstanceResponseDto,
        TeacherWorkloadResponseDto, CurriculumVersionResponseDto, CurriculumEntryResponseDto,
        CompetencyResponseDto, SemesterResponseDto, ThematicPlanResponseDto,
        TeachingMaterialResponseDto, LessonPlanResponseDto, EnrollmentResponseDto,
        ScheduleEventResponseDto, ScheduleMatrixResponseDto, SubstitutionResponseDto,
        CollisionResultDto, SnapshotResponseDto, RecurringEventResponseDto,
        AttendanceRecordResponseDto, ExcuseResponseDto, AttendanceStatsResponseDto, UnexcusedAlertDto,
        ConversationResponseDto, MessageResponseDto, NotificationResponseDto, RecipientResponseDto,
        BulletinPostResponseDto, PollResponseDto, CommunityEventResponseDto,
        ClassbookEntryResponseDto,
        ReportCardResponseDto, GradingTypeResponseDto, BehaviorGradeResponseDto,
        CompetencyGradeResponseDto, MeasureResponseDto, GradeHistoryEntryDto,
        CommissionExamResponseDto, GradingDeadlineResponseDto,
        SchoolDashboardResponseDto, SharedRoomResponseDto,
        SsoIdentityResponseDto, UploadResultDto, ImportResultDto,
        StudentDataResponseDto, ChildDashboardResponseDto, ParentChildResponseDto,
        TeacherClassResponseDto,
        SystemDashboardResponseDto, SchoolResponseDto, SsoConfigResponseDto,
        AiConfigResponseDto, AiUsageResponseDto, AiTextResponseDto,
        BackupResponseDto, HealthCheckResponseDto, MetricsResponseDto,
        RvpUploadResponseDto, CompetencyMatrixResponseDto,
        CurriculumDiffResponseDto, ScheduleDiffResponseDto, GenerateScheduleResultDto,
        GdprDataResponseDto, InitStatusResponseDto, SeedFileResponseDto,
        ReportStatsResponseDto, RegistryClassroomResponseDto,
        SystemSettingsResponseDto, PaginatedUsersResponseDto,
      ],
    });
    SwaggerModule.setup('/api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);

  // ─── Auto-seed (docker-compose.demo.yml) ─────────────────────
  if (process.env.AUTO_SEED === 'true') {
    const logger = new Logger('AutoSeed');
    try {
      const initService = app.get(InitService);
      const seedService = app.get(SeedService);

      const status = await initService.getStatus();
      if (!status.initialized) {
        logger.log('AUTO_SEED: System not initialized – running auto-seed...');

        const adminResult = await initService.setup({
          adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@demo.test',
          adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Heslo123!',
          adminFirstName: process.env.SEED_ADMIN_FIRST_NAME || 'Admin',
          adminLastName: process.env.SEED_ADMIN_LAST_NAME || 'Demo',
        });

        const seedResult = await seedService.executeSeed(adminResult.admin.id, {
          filename: process.env.SEED_FILE || 'demo-seed.json',
          overrideAi: {
            geminiApiKey: process.env.GOOGLE_AI_API_KEY,
            openAiApiKey: process.env.OPENAI_API_KEY,
          },
        });

        logger.log(`AUTO_SEED complete: ${seedResult.summary}`);
      } else {
        logger.log('AUTO_SEED: System already initialized – skipping seed.');
      }
    } catch (err) {
      const logger = new Logger('AutoSeed');
      logger.error('AUTO_SEED failed:', err);
    }
  }
}
bootstrap();
