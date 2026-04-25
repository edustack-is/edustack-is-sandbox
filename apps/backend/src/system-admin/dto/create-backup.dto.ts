import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBackupDto {
  @ApiPropertyOptional({
    description: 'Volitelný název zálohy (bez přípony .sqlite)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;
}
