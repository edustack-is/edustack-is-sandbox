import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { ClsModule } from 'nestjs-cls';
import { UserContextInterceptor } from './auth/user-context.interceptor';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    UsersModule, RegistryModule, GradingModule, ScheduleModule, AiModule, AuthModule, InitModule, SystemAdminModule, StudentModule, ParentModule, TeacherModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
})
export class AppModule { }
