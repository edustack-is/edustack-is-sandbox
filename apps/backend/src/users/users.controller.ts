import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Get,
  Query,
  Param,
  Req,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UserRole, UserStatus } from '../database/types';
import { LogSensitiveRead } from '../auth/log-sensitive-read.decorator';
import { LogSensitiveReadInterceptor } from '../auth/log-sensitive-read.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  ImportResultDto,
  PaginatedUsersResponseDto,
  SchoolUserResponseDto,
} from '../common/dto/response.dto';
@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private ensureTenant(req: any) {
    if (!req.user.schoolId) {
      throw new ForbiddenException('School context required.');
    }
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import uživatelů z CSV' })
  @ApiResponse({
    status: 201,
    description: 'Výsledek importu – počet vytvořených.',
    type: ImportResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  @ApiResponse({
    status: 400,
    description: 'Neplatný požadavek – chyba validace vstupních dat.',
  })
  async importUsers(@Req() req: any, @UploadedFile() file: any) {
    this.ensureTenant(req);
    return this.usersService.importUsersFromCsv(file.buffer, req.user.schoolId);
  }

  @Get()
  @ApiOperation({ summary: 'Seznam všech uživatelů' })
  @ApiResponse({
    status: 200,
    description: 'Seznam uživatelů s paginací.',
    type: PaginatedUsersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  async findAll(
    @Query()
    query: {
      skip?: number;
      take?: number;
      role?: UserRole;
      status?: UserStatus;
    },
  ) {
    return this.usersService.findAll({
      skip: query.skip ? Number(query.skip) : undefined,
      take: query.take ? Number(query.take) : undefined,
      role: query.role,
      status: query.status,
    });
  }

  @Get(':id')
  @UseInterceptors(LogSensitiveReadInterceptor)
  @LogSensitiveRead()
  @ApiOperation({ summary: 'Detail uživatele' })
  @ApiResponse({
    status: 200,
    description: 'Detail uživatele.',
    type: SchoolUserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Neautorizovaný přístup – chybí nebo neplatný JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Nedostatečná oprávnění pro tuto operaci.',
  })
  @ApiResponse({ status: 404, description: 'Záznam nebyl nalezen.' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
