import pino, { Logger } from 'pino';

export const PINO = Symbol('PINO');

export function createPinoLogger(level: string): Logger {
  return pino({
    level,
    base: { service: 'account-aggregation' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.apiKey',
        '*.accessToken',
        '*.document',
        '*.cpf',
      ],
      censor: '[REDACTED]',
    },
  });
}
