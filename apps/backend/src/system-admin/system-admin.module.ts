import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { SystemAdminAiController } from './system-admin-ai.controller';
import { SystemAdminAiService } from './system-admin-ai.service';
import { SystemAdminSsoService } from './system-admin-sso.service';
import { SystemSettingsService } from './system-settings.service';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { MonitoringController } from './monitoring.controller';
import { TestDataController } from './test-data.controller';
import { TestDataService } from './test-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { BackupSchedulerService } from './backup-scheduler.service';

@Module({
    imports: [AuthModule],
    controllers: [SystemAdminController, SystemAdminAiController, TestDataController, BackupController, MonitoringController],
    providers: [SystemAdminService, SystemAdminAiService, SystemAdminSsoService, SystemSettingsService, BackupService, BackupSchedulerService, TestDataService, PrismaService],
    exports: [SystemAdminAiService, SystemSettingsService],
})
export class SystemAdminModule { }

