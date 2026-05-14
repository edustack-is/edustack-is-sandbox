import { IsString, IsOptional, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Each key is optional, but if provided as a non-empty string it must be
// at least 10 characters. An empty string is allowed to mean "clear the key".
export class UpsertAiSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @ValidateIf((_o, v) => typeof v === 'string' && v.length > 0)
  @MinLength(10)
  geminiApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @ValidateIf((_o, v) => typeof v === 'string' && v.length > 0)
  @MinLength(10)
  openAiApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @ValidateIf((_o, v) => typeof v === 'string' && v.length > 0)
  @MinLength(10)
  anthropicApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @ValidateIf((_o, v) => typeof v === 'string' && v.length > 0)
  @MinLength(10)
  opencodeApiKey?: string;
}
