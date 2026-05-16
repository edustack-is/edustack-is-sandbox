import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { UsersModule } from './users/users.module';
import { RegistryModule } from './registry/registry.module';
import { GradingModule } from './grading/grading.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { InitModule } from './init/init.module';
import { SystemAdminModule } from './system-admin/system-admin.module';
import { StudentModule } from './student/student.module';
import { ParentModule } from './parent/parent.module';
import { TeacherModule } from './teacher/teacher.module';
import { DeputyModule } from './deputy/deputy.module';
import { PrincipalModule } from './principal/principal.module';
import { ClsModule } from 'nestjs-cls';
import { UserContextInterceptor } from './auth/user-context.interceptor';
import { MailModule } from './mail/mail.module';
import { CryptoModule } from './shared/crypto/crypto.module';
import { MessagingModule } from './messaging/messaging.module';
import { AttendanceModule } from './attendance/attendance.module';
import { CommunityModule } from './community/community.module';
import { ClassBookModule } from './classbook/classbook.module';
import { ExportModule } from './export/export.module';
import { ReportsModule } from './reports/reports.module';
import { GdprModule } from './gdpr/gdpr.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    DatabaseModule,
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        // Production caps the global limit at 400/IP/min — bumped again
        // because the previous 200 ceiling was still tripping real
        // sessions. Dev/test get 8000 so parallel E2E sweeps don't
        // trip it. The per-route limits on /auth/login and /init/status
        // still apply on top of this.
        limit: process.env.NODE_ENV === 'production' ? 400 : 8000,
      },
    ]),
    NestScheduleModule.forRoot(),
    CryptoModule,
    MailModule,
    UsersModule,
    RegistryModule,
    GradingModule,
    ScheduleModule,
    AiModule,
    AuthModule,
    InitModule,
    SystemAdminModule,
    StudentModule,
    ParentModule,
    TeacherModule,
    DeputyModule,
    PrincipalModule,
    MessagingModule,
    AttendanceModule,
    CommunityModule,
    ClassBookModule,
    ExportModule,
    ReportsModule,
    GdprModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guards. Order matters: throttle first (cheap rejects),
    // then JwtAuthGuard (sets req.user, honours @Public), then RolesGuard
    // (reads req.user, no-ops without @Roles).
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
})
export class AppModule {}
