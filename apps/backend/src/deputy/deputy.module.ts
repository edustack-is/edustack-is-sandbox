import { Module } from '@nestjs/common';
import { DeputyController } from './deputy.controller';
import { DeputyService } from './deputy.service';
import { DeputyCurriculumController } from './deputy-curriculum.controller';
import { DeputyCurriculumService } from './deputy-curriculum.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [DeputyController, DeputyCurriculumController],
    providers: [DeputyService, DeputyCurriculumService],
    exports: [DeputyService, DeputyCurriculumService],
})
export class DeputyModule { }
