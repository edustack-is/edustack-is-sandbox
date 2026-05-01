import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use = (req: Request, res: Response, next: NextFunction) => {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const contentLength = res.get('Content-Length') || 0;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms - ${contentLength}b - ${ip} - ${userAgent}`,
      );
    });

    next();
  };
}
