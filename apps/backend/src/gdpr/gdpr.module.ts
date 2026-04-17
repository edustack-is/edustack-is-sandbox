import { Module } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GdprController],
})
export class GdprModule {}
