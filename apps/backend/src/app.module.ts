import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 30,
    }]),
    CryptoModule,
    MailModule,
    UsersModule, RegistryModule, GradingModule, ScheduleModule, AiModule, AuthModule, InitModule,
    SystemAdminModule, StudentModule, ParentModule, TeacherModule, DeputyModule, PrincipalModule,
    MessagingModule,
    AttendanceModule,
    CommunityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
})
export class AppModule { }
