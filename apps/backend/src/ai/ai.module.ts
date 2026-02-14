import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiChatService } from './ai-chat.service';
import { AiController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../shared/crypto/crypto.module';

@Module({
  imports: [PrismaModule, CryptoModule, ConfigModule],
  controllers: [AiController],
  providers: [AiService, AiChatService],
  exports: [AiChatService],
})
export class AiModule { }
