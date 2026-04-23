import { Module } from '@nestjs/common';
import { ClassBookService } from './classbook.service';
import { ClassBookController } from './classbook.controller';

@Module({
  controllers: [ClassBookController],
  providers: [ClassBookService],
})
export class ClassBookModule {}
