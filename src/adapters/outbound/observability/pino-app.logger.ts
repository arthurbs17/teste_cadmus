import { Inject, Injectable } from '@nestjs/common';
import type { Logger } from 'pino';
import { AppLogger, LogFields } from '../../../application/ports/app-logger.port';
import { PINO } from './pino.logger';

@Injectable()
export class PinoAppLogger extends AppLogger {
  constructor(@Inject(PINO) private readonly pino: Logger) {
    super();
  }

  info(event: string, fields: LogFields = {}): void {
    this.pino.info({ event, ...fields }, event);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.pino.warn({ event, ...fields }, event);
  }

  error(event: string, fields: LogFields = {}): void {
    this.pino.error({ event, ...fields }, event);
  }
}
