import { Module } from '@nestjs/common';
import { SystemAdminController } from './system-admin.controller';
import { SystemAdminService } from './system-admin.service';
import { SystemAdminAiController } from './system-admin-ai.controller';
import { SystemAdminAiService } from './system-admin-ai.service';
import { SystemAdminSsoService } from './system-admin-sso.service';
import { TestDataController } from './test-data.controller';
import { TestDataService } from './test-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [AuthModule],
    controllers: [SystemAdminController, SystemAdminAiController, TestDataController],
    providers: [SystemAdminService, SystemAdminAiService, SystemAdminSsoService, TestDataService, PrismaService],
    exports: [SystemAdminAiService],
})
export class SystemAdminModule { }
