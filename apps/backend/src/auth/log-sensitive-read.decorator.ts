import { SetMetadata } from '@nestjs/common';

export const LOG_SENSITIVE_READ_KEY = 'logSensitiveRead';
export const LogSensitiveRead = () => SetMetadata(LOG_SENSITIVE_READ_KEY, true);
