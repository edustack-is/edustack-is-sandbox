import { ApiProperty } from '@nestjs/swagger';

/**
 * Unified error response returned by all API endpoints.
 * NestJS HttpException / ValidationPipe format.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'HTTP stavový kód' })
  statusCode: number;

  @ApiProperty({
    example: 'Validation failed',
    description: 'Popis chyby — řetězec nebo pole řetězců (validace)',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiProperty({ example: 'Bad Request', description: 'Název HTTP chyby' })
  error: string;
}
