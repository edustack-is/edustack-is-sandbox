import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { SystemAdminAiController } from './system-admin-ai.controller';
import { SystemAdminAiService } from './system-admin-ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../utils/crypto.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [SystemAdminController, SystemAdminAiController],
    providers: [SystemAdminService, SystemAdminAiService, PrismaService],
    exports: [SystemAdminAiService],
})
export class SystemAdminModule { }
