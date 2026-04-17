import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { NotificationService } from './notification.service';

@Module({
  imports: [PrismaModule],
  controllers: [MessagingController],
  providers: [MessagingService, NotificationService],
  exports: [NotificationService],
})
export class MessagingModule {}
