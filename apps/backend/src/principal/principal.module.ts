import { Module } from '@nestjs/common';
import { PrincipalController } from './principal.controller';
import { PrincipalService } from './principal.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrincipalController],
  providers: [PrincipalService],
  exports: [PrincipalService],
})
export class PrincipalModule {}
