import { Module } from '@nestjs/common';
import { DeputyController } from './deputy.controller';
import { DeputyService } from './deputy.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [DeputyController],
    providers: [DeputyService],
    exports: [DeputyService],
})
export class DeputyModule { }
