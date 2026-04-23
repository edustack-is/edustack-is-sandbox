import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { NotificationService } from './notification.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [MessagingController],
  providers: [MessagingService, NotificationService],
  exports: [MessagingService, NotificationService],
})
export class MessagingModule {}
