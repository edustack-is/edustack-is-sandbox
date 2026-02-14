import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { SystemAdminAiController } from './system-admin-ai.controller';
import { SystemAdminAiService } from './system-admin-ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';

@Module({
    controllers: [SystemAdminController, SystemAdminAiController],
    providers: [SystemAdminService, SystemAdminAiService, PrismaService, CryptoService],
    exports: [SystemAdminAiService],
})
export class SystemAdminModule { }
