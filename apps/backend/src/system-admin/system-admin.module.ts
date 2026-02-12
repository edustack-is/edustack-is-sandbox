import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
    controllers: [SystemAdminController],
    providers: [SystemAdminService, PrismaService],
})
export class SystemAdminModule { }
