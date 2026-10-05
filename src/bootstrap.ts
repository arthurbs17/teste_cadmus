import { Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { Env } from './config/env';

export async function bootstrap(module: Type, portKey: 'API_PORT' | 'WORKER_PORT'): Promise<void> {
  const app = await NestFactory.create(module, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);

  await app.listen(config.get(portKey, { infer: true }));
}
