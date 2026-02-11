import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { RegistryModule } from './registry/registry.module';
import { GradingModule } from './grading/grading.module';
import { ScheduleModule } from './schedule/schedule.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [UsersModule, RegistryModule, GradingModule, ScheduleModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
