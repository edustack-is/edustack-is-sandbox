import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { CryptoModule } from '../shared/crypto/crypto.module';
import { ConfigModule } from '@nestjs/config';
import { SystemAdminModule } from '../system-admin/system-admin.module';

@Module({
  imports: [CryptoModule, ConfigModule, SystemAdminModule],
  controllers: [AiController],
  providers: [AiService, AiChatService],
})
export class AiModule {}
