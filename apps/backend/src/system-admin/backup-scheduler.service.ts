import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BackupService } from './backup.service';

@Injectable()
export class BackupSchedulerService {
    private readonly logger = new Logger(BackupSchedulerService.name);

    constructor(private readonly backupService: BackupService) { }

    /**
     * Run automatic backup every day at 2:00 AM.
     * Only runs if AUTO_BACKUP env is set to 'true'.
     */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleAutomaticBackup() {
        if (process.env.AUTO_BACKUP !== 'true') return;

        this.logger.log('Starting automatic scheduled backup...');
        try {
            const result = await this.backupService.createBackup();
            this.logger.log(`Automatic backup completed: ${result.filename}`);

            // Clean old backups — keep only last 7
            await this.cleanOldBackups(7);
        } catch (error) {
            this.logger.error(`Automatic backup failed: ${error}`);
        }
    }

    private async cleanOldBackups(keepCount: number) {
        try {
            const backups = this.backupService.listBackups();
            if (backups.length > keepCount) {
                const toDelete = backups.slice(keepCount); // listBackups returns sorted newest-first
                for (const b of toDelete) {
                    this.backupService.deleteBackup(b.filename);
                    this.logger.log(`Cleaned old backup: ${b.filename}`);
                }
            }
        } catch (error) {
            this.logger.warn(`Cleanup of old backups failed: ${error}`);
        }
    }
}
