import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DeputyController } from './deputy.controller';
import { DeputyService } from './deputy.service';
import { DeputyCurriculumController } from './deputy-curriculum.controller';
import { DeputyCurriculumService } from './deputy-curriculum.service';
import { RvpImportService } from './rvp-import.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: { expiresIn: '60m' },
    }),
  ],
  controllers: [DeputyController, DeputyCurriculumController],
  providers: [DeputyService, DeputyCurriculumService, RvpImportService],
  exports: [DeputyService, DeputyCurriculumService, RvpImportService],
})
export class DeputyModule {}
