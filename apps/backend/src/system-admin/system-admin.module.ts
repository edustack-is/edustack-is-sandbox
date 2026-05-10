import { Module } from '@nestjs/common';
import { SystemAdminService } from './system-admin.service';
import { SystemAdminController } from './system-admin.controller';
import { SystemSettingsService } from './system-settings.service';
import { SystemAdminAiService } from './system-admin-ai.service';
import { CryptoModule } from '../shared/crypto/crypto.module';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupSchedulerService } from './backup-scheduler.service';
import { TestDataService } from './test-data.service';
import { SystemPromptsService } from './system-prompts.service';
import { TestDataController } from './test-data.controller';
import { MonitoringController } from './monitoring.controller';
import { MailModule } from '../mail/mail.module';
import { SystemAdminSsoService } from './system-admin-sso.service';
import { SsoStrategyFactoryService } from '../auth/sso-strategy-factory.service';

@Module({
  imports: [CryptoModule, MailModule],
  controllers: [
    SystemAdminController,
    BackupController,
    TestDataController,
    MonitoringController,
  ],
  providers: [
    SystemAdminService,
    SystemSettingsService,
    SystemAdminAiService,
    SystemAdminSsoService,
    SsoStrategyFactoryService,
    BackupService,
    TestDataService,
    SystemPromptsService,
  ],
  exports: [
    SystemAdminService,
    SystemSettingsService,
    SystemAdminAiService,
    SystemAdminSsoService,
    SsoStrategyFactoryService,
    BackupService,
    TestDataService,
    SystemPromptsService,
  ],
})
export class SystemAdminModule {}
