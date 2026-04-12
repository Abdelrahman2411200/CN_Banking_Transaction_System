import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'ledger-service',
  },
  transports: [
    new winston.transports.Console(),
  ],
});

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.header('x-request-id') || randomUUID();
  const userId = req.header('x-user-id');
  const startedAt = Date.now();

  res.locals.requestId = requestId;
  res.locals.userId = userId;
  res.setHeader('x-request-id', requestId);

  logger.info('request received', {
    method: req.method,
    url: req.originalUrl,
    requestId,
    userId,
  });

  res.on('finish', () => {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 && statusCode !== 404 ? 'warn' : 'info';

    logger.log(level, 'request completed', {
      statusCode,
      durationMs: Date.now() - startedAt,
      requestId,
      userId,
    });
  });

  next();
};
