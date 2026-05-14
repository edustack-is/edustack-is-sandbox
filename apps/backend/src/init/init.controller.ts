import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { InitService, SetupDto } from './init.service';
import { SetupTokenGuard } from './setup-token.guard';
import { FileInterceptor } from '@nestjs/platform-express';

import { InitStatusResponseDto } from '../common/dto/response.dto';
import { LoginResponseDto } from '../common/dto/api.dto';

@ApiTags('init')
@Controller('api/init')
export class InitController {
  constructor(private readonly initService: InitService) {}

  /**
   * GET /api/init/status
   * Public — needed by frontend to decide whether to show setup or login.
   * Frontend hits this on every page load, so 60 req/min is a generous-but-bounded value.
   */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
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

  @Public()
  @UseGuards(SetupTokenGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('restore-backup')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Obnovit systém ze zálohy (.sqlite)',
    description:
      'Přepíše aktuální databázi nahraným souborem zálohy. Funguje pouze pokud systém ještě není inicializovaný.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async restoreBackup(@UploadedFile() file: Express.Multer.File) {
    return this.initService.restoreFromSqlite(file);
  }
}
