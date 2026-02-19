import { Controller, Post, UseInterceptors, UploadedFile, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UserRole, UserStatus } from '@prisma/client';
import { LogSensitiveRead } from '../auth/log-sensitive-read.decorator';
import { LogSensitiveReadInterceptor } from '../auth/log-sensitive-read.interceptor';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('api/users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    async importUsers(@UploadedFile() file: any) {
        return this.usersService.importUsersFromCsv(file.buffer);
    }

    @Get()
    async findAll(@Query() query: {
        skip?: number;
        take?: number;
        role?: UserRole;
        status?: UserStatus;
    }) {
        return this.usersService.findAll({
            skip: query.skip ? Number(query.skip) : undefined,
            take: query.take ? Number(query.take) : undefined,
            role: query.role,
            status: query.status,
        });
    }

    @Get(':id')
    @UseInterceptors(LogSensitiveReadInterceptor)
    @LogSensitiveRead()
    async findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }
}
