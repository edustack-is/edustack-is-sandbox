import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { InitService, SetupDto } from './init.service';
import { SeedService, SeedData } from './seed.service';
import { SetupTokenGuard } from './setup-token.guard';

import {
  InitStatusResponseDto,
  SeedFileResponseDto,
} from '../common/dto/response.dto';
import { LoginResponseDto } from '../common/dto/api.dto';

@ApiTags('init')
@Controller('api/init')
export class InitController {
  constructor(
    private readonly initService: InitService,
    private readonly seedService: SeedService,
  ) {}

  /**
   * GET /api/init/status
   * Public — needed by frontend to decide whether to show setup or login.
   * Rate-limited to 10 requests per 60 seconds.
   */
  @Public()
  @Throttle({ default: { limit: 1000, ttl: 60000 } })
  @Get('status')
  @ApiOperation({
    summary: 'Stav inicializace',
    description:
      'Vrátí zda je systém inicializovaný (existuje alespoň jeden uživatel).',
  })
  @ApiResponse({
    status: 200,
    description: '{ initialized: boolean }',
    type: InitStatusResponseDto,
  })
  async getStatus() {
    return this.initService.getStatus();
  }

  /**
   * POST /api/init/setup
   * Creates the first system admin user.
   *
   * Protected by:
   *  1. InitService check: refuses if already initialized
   *  2. SetupTokenGuard: if SETUP_TOKEN env is set, requires x-setup-token header
   *  3. Rate limit: 3 attempts per 60 seconds
   */
  @Public()
  @UseGuards(SetupTokenGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('setup')
  @ApiOperation({
    summary: 'Prvotní nastavení systému',
    description:
      'Vytvoří prvního systémového administrátora. Funguje pouze pokud systém ještě není inicializovaný.',
  })
  @ApiBody({ type: SetupDto })
  @ApiResponse({
    status: 201,
    description: 'Vytvořený administrátor.',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Systém je již inicializovaný.' })
  async setup(@Body() body: SetupDto) {
    return this.initService.setup(body);
  }

  /**
   * POST /api/init/setup-with-seed
   * Combined setup: creates admin + seeds demo data in one step.
   *
   * Protected by:
   *  1. InitService check: refuses if already initialized
   *  2. SetupTokenGuard: if SETUP_TOKEN env is set, requires x-setup-token header
   *  3. Rate limit: 3 attempts per 60 seconds
   */
  @Public()
  @UseGuards(SetupTokenGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('setup-with-seed')
  @ApiOperation({
    summary: 'Setup + seed dat',
    description: 'Vytvoří admina a naseeduje demo data v jednom kroku.',
  })
  @ApiResponse({
    status: 201,
    description: 'Admin + seed výsledek.',
    type: LoginResponseDto,
  })
  async setupWithSeed(
    @Body()
    body: SetupDto & {
      seedFilename?: string;
      seedData?: SeedData;
      aiKeys?: {
        geminiApiKey?: string;
        openAiApiKey?: string;
        anthropicApiKey?: string;
      };
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
   * Returns available seed files.
   *
   * Protected by:
   *  1. SetupTokenGuard: if SETUP_TOKEN env is set, requires x-setup-token header
   *  2. Rate limit: 5 requests per 60 seconds
   *
   * This endpoint reveals internal file structure, so it's guarded
   * to only be accessible during legitimate setup workflows.
   */
  @Public()
  @UseGuards(SetupTokenGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('seed-files')
  @ApiOperation({
    summary: 'Dostupné seed soubory',
    description: 'Seznam JSON seed souborů pro inicializaci.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dostupné seed soubory – pole.',
    type: SeedFileResponseDto,
    isArray: true,
  })
  async getSeedFiles() {
    return this.seedService.getAvailableSeedFiles();
  }
}
