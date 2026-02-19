import { Controller, Post, Get, Delete, Param, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { BackupService } from './backup.service';

import { SuccessResponseDto } from '../common/dto/api.dto';
import { BackupResponseDto } from '../common/dto/response.dto';

@ApiTags('system')
@ApiBearerAuth('JWT-auth')
@Controller('api/system/backups')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class BackupController {
    constructor(private readonly backupService: BackupService) { }

    @Post()
    @ApiOperation({ summary: 'Vytvoření zálohy' })
    @ApiResponse({ status: 201, description: 'Záloha vytvořena.', type: BackupResponseDto })
    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })
    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })
    @ApiResponse({ status: 400, description: 'Neplatný požadavek – chyba validace vstupních dat.' })
    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

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
    @ApiOperation({ summary: 'Obnovení ze zálohy' })
    @ApiResponse({ status: 200, description: 'Záloha obnovena.', type: SuccessResponseDto })
    @ApiResponse({ status: 401, description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.' })
    @ApiResponse({ status: 403, description: 'Nedostatečná oprávnění pro tuto operaci.' })
    @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })

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
