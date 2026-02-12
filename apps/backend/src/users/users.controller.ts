import { Controller, Post, UseInterceptors, UploadedFile, Get, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { Express } from 'express';
import { Multer } from 'multer';

@Controller('users')
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

}
