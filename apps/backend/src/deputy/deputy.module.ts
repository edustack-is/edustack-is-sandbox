import { Module } from '@nestjs/common';
import { DeputyService } from './deputy.service';
import { DeputyController } from './deputy.controller';
import { DeputyCurriculumService } from './deputy-curriculum.service';
import { DeputyCurriculumController } from './deputy-curriculum.controller';
import { MailModule } from '../mail/mail.module';
import { RvpImportService } from './rvp-import.service';
import { CryptoModule } from '../utils/crypto.module';

@Module({
  imports: [MailModule, CryptoModule],
  controllers: [DeputyController, DeputyCurriculumController],
  providers: [DeputyService, DeputyCurriculumService, RvpImportService],
})
export class DeputyModule {}
