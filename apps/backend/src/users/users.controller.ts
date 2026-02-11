import { Controller, Get, Post, Body, UseInterceptors, UploadedFile, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { Prisma, User, Role, UserStatus } from '@prisma/client';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    async create(@Body() createUserDto: Prisma.UserCreateInput): Promise<User> {
        return this.usersService.create(createUserDto);
    }

    @Get()
    async findAll(@Query() query: {
        page?: string;
        limit?: string;
        role?: Role;
        status?: UserStatus
    }) {
        const page = query.page ? parseInt(query.page) : 1;
        const limit = query.limit ? parseInt(query.limit) : 20;
        const skip = (page - 1) * limit;

        return this.usersService.findAll({
            skip,
            take: limit,
            role: query.role,
            status: query.status,
        });
    }

    @Post('import')
    @UseInterceptors(FileInterceptor('file'))
    async importUsers(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new Error('File not provided');
        return this.usersService.importUsersFromCsv(file.buffer);
    }
}
