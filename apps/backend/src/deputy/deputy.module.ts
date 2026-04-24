import { Module } from '@nestjs/common';
import { DeputyService } from './deputy.service';
import { DeputyController } from './deputy.controller';
import { DeputyCurriculumService } from './deputy-curriculum.service';
import { DeputyCurriculumController } from './deputy-curriculum.controller';
import { MailModule } from '../mail/mail.module';
import { RvpImportService } from './rvp-import.service';
import { CryptoModule } from '../shared/crypto/crypto.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [MailModule, CryptoModule, JwtModule.register({})],
  controllers: [DeputyController, DeputyCurriculumController],
  providers: [DeputyService, DeputyCurriculumService, RvpImportService],
})
export class DeputyModule {}
