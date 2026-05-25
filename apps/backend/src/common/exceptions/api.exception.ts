import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Structured exception used across the codebase so the frontend can
 * localise the message instead of receiving a hard-coded English string.
 *
 * Wire format (after AllExceptionsFilter):
 *   { error: { code, message, messageKey, messageParams, ...extras } }
 *
 * - `messageKey` is an i18next dot-path looked up under the `apiErrors.*`
 *   namespace by the axios response interceptor.
 * - `messageParams` is the interpolation map for that template.
 * - `message` is the English fallback shown to API/CLI clients without
 *   i18n and used by the interceptor when no translation matches.
 * - `extras` (e.g. `conflict`) are passed through unchanged so callers
 *   can branch on structured details without scraping strings.
 *
 * Use the static helpers (notFound, conflict, …) for the common cases;
 * drop to the constructor only when the status doesn't fit one of them.
 */
export type MessageParams = Record<string, string | number>;

export interface ApiExceptionPayload {
  messageKey: string;
  message: string;
  messageParams?: MessageParams;
  [extra: string]: unknown;
}

export class ApiException extends HttpException {
  constructor(status: HttpStatus, payload: ApiExceptionPayload) {
    super(payload, status);
  }

  static badRequest(
    messageKey: string,
    message: string,
    messageParams?: MessageParams,
  ) {
    return new ApiException(HttpStatus.BAD_REQUEST, {
      messageKey,
      message,
      messageParams,
    });
  }

  static unauthorized(
    messageKey: string,
    message: string,
    messageParams?: MessageParams,
  ) {
    return new ApiException(HttpStatus.UNAUTHORIZED, {
      messageKey,
      message,
      messageParams,
    });
  }

  static forbidden(
    messageKey: string,
    message: string,
    messageParams?: MessageParams,
  ) {
    return new ApiException(HttpStatus.FORBIDDEN, {
      messageKey,
      message,
      messageParams,
    });
  }

  static notFound(
    messageKey: string,
    message: string,
    messageParams?: MessageParams,
  ) {
    return new ApiException(HttpStatus.NOT_FOUND, {
      messageKey,
      message,
      messageParams,
    });
  }

  static conflict(
    messageKey: string,
    message: string,
    extras?: Record<string, unknown>,
    messageParams?: MessageParams,
  ) {
    return new ApiException(HttpStatus.CONFLICT, {
      messageKey,
      message,
      messageParams,
      ...(extras ?? {}),
    });
  }

  static unprocessableEntity(
    messageKey: string,
    message: string,
    messageParams?: MessageParams,
  ) {
    return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
      messageKey,
      message,
      messageParams,
    });
  }
}
