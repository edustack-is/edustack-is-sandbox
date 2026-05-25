import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DatabaseError } from '../../database/database.service';

/**
 * Derive a stable, human-readable error code from an HTTP status so the
 * API contract isn't "every error is INTERNAL_ERROR." Callers (the
 * frontend toasts, integration tests) can branch on the code without
 * scraping the message string. Encoded as a lookup map rather than a
 * switch because `status` arrives as a plain `number` from
 * `HttpException.getStatus()` and ESLint's no-unsafe-enum-comparison
 * rule rejects mixing it with `HttpStatus` cases.
 */
const STATUS_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function codeFromStatus(status: number): string {
  return STATUS_CODES[status] ?? 'INTERNAL_ERROR';
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    // Structured payload (e.g. ConflictException's { conflict }) that
    // callers want to inspect — passed through alongside message so the
    // frontend can branch on details without parsing the string.
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = codeFromStatus(status);
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const r = exceptionResponse as Record<string, unknown>;
        message = (r.message as string | string[]) ?? exception.message;
        code = (r.code as string) ?? code;
        // Carry through anything beyond the standard envelope so the
        // frontend can read e.g. `conflict.reason` on a 409.
        const { message: _m, code: _c, statusCode: _s, error: _e, ...rest } = r;
        if (Object.keys(rest).length > 0) details = rest;
      }
    } else if (exception instanceof DatabaseError) {
      const dbError = exception as DatabaseError;
      status = HttpStatus.BAD_REQUEST;
      message = dbError.message;
      code = dbError.code || 'DATABASE_ERROR';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details ?? {}),
        ...(process.env.NODE_ENV !== 'production' && {
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${Array.isArray(message) ? message.join('; ') : message}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(status).json(errorResponse);
  }
}
