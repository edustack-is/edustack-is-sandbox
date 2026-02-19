import { Module } from '@nestjs/common';
import { ClassBookService } from './classbook.service';
import { ClassBookController } from './classbook.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ClassBookController],
    providers: [ClassBookService],
})
export class ClassBookModule { }
