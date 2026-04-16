import { Controller, Post, Get, Delete, Param, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsSystemAdminGuard } from './guards/is-system-admin.guard';
import { BackupService } from './backup.service';

@ApiTags('system')
@ApiBearerAuth('JWT-auth')
@Controller('api/system/backups')
@UseGuards(JwtAuthGuard, IsSystemAdminGuard)
export class BackupController {
    constructor(private readonly backupService: BackupService) { }

    @Post()
    @ApiOperation({ summary: 'Vytvoření zálohy' })
    @ApiResponse({ status: 201, description: 'Záloha vytvořena.' })
    async createBackup(@Query('name') name?: string) {
        return this.backupService.createBackup(name);
    }

    @Get()
    @ApiOperation({ summary: 'Seznam záloh' })
    async listBackups() {
        return this.backupService.listBackups();
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
            },
        },
    })
    @ApiOperation({ summary: 'Nahrání zálohy z disku' })
    async uploadBackup(@UploadedFile() file: Express.Multer.File) {
        return this.backupService.uploadBackup(file);
    }

    @Delete(':filename')
    @ApiOperation({ summary: 'Smazání zálohy' })
    async deleteBackup(@Param('filename') filename: string) {
        await this.backupService.deleteBackup(filename);
        return { message: 'Backup deleted' };
    }
}

