import { Controller, Post, Get, Delete, Param, Res, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { BackupService } from './backup.service';

@Controller('api/system/backups')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class BackupController {
    constructor(private readonly backupService: BackupService) { }

    @Post()
    async createBackup() {
        return this.backupService.createBackup();
    }

    @Get()
    listBackups() {
        return this.backupService.listBackups();
    }

    @Get(':filename/download')
    downloadBackup(@Param('filename') filename: string, @Res() res: Response) {
        try {
            const filepath = this.backupService.getBackupPath(filename);
            res.download(filepath, filename);
        } catch {
            throw new BadRequestException('Backup file not found');
        }
    }

    @Post(':filename/restore')
    async restoreBackup(@Param('filename') filename: string) {
        await this.backupService.restoreBackup(filename);
        return { message: 'Database restored successfully' };
    }

    @Delete(':filename')
    deleteBackup(@Param('filename') filename: string) {
        this.backupService.deleteBackup(filename);
        return { message: 'Backup deleted' };
    }
}
