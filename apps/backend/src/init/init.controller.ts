import { Controller, Get, Post, Body } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { InitService, SetupDto } from './init.service';
import { SeedService, SeedData } from './seed.service';

@Controller('api/init')
export class InitController {
    constructor(
        private readonly initService: InitService,
        private readonly seedService: SeedService,
    ) { }

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

    /**
     * POST /api/init/setup-with-seed
     * Combined setup: creates admin + seeds demo data in one step.
     */
    @Public()
    @Post('setup-with-seed')
    async setupWithSeed(
        @Body() body: SetupDto & {
            seedFilename?: string;
            seedData?: SeedData;
            aiKeys?: { geminiApiKey?: string; openAiApiKey?: string; anthropicApiKey?: string };
            ssoConfig?: any;
        },
    ) {
        // 1. Create admin user
        const result = await this.initService.setup(body);

        // 2. Seed demo data
        const seedResult = await this.seedService.executeSeed(result.admin.id, {
            filename: body.seedFilename || 'demo-seed.json',
            data: body.seedData,
            overrideAi: body.aiKeys,
            overrideSso: body.ssoConfig,
        });

        return {
            admin: result.admin,
            seed: seedResult,
        };
    }

    /**
     * GET /api/init/seed-files
     * Returns available seed files the user can choose from.
     */
    @Public()
    @Get('seed-files')
    async getSeedFiles() {
        return this.seedService.getAvailableSeedFiles();
    }
}
