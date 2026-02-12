import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { InitService, SetupDto } from './init.service';

@Controller('api/init')
export class InitController {
    constructor(private readonly initService: InitService) { }

    @Public()
    @Get('status')
    async getStatus() {
        return this.initService.getStatus();
    }

    @Public()
    @Post('setup')
    async setup(@Body() body: SetupDto) {
        return this.initService.setup(body);
    }
}
