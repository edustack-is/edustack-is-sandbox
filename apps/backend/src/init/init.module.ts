import { Module } from '@nestjs/common';
import { InitService } from './init.service';
import { SeedService } from './seed.service';
import { InitController } from './init.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [PrismaModule, JwtModule.register({})],
    controllers: [InitController],
    providers: [InitService, SeedService],
})
export class InitModule { }
