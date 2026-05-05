import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertAiSettingsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(10)
  geminiApiKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(10)
  openAiApiKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(10)
  anthropicApiKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @MinLength(10)
  opencodeApiKey?: string;
}
