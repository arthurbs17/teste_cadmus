import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { Logger } from 'pino';
import { AppLogger } from '../application/ports/app-logger.port';
import { Clock } from '../application/ports/clock.port';
import { SyncMetrics } from '../application/ports/sync-metrics.port';
import { HealthController } from '../adapters/inbound/http/health.controller';
import { MetricsController } from '../adapters/inbound/http/metrics.controller';
import { MetricsRegistry } from '../adapters/outbound/observability/metrics.registry';
import { PinoAppLogger } from '../adapters/outbound/observability/pino-app.logger';
import { PINO, createPinoLogger } from '../adapters/outbound/observability/pino.logger';
import { PrometheusSyncMetrics } from '../adapters/outbound/observability/prometheus-sync.metrics';
import { PrismaService } from '../adapters/outbound/persistence/prisma.service';
import { SystemClock } from '../adapters/outbound/system/system.clock';
import { Env, validateEnv } from '../config/env';

const pinoProvider = {
  provide: PINO,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) =>
    createPinoLogger(config.get('LOG_LEVEL', { infer: true })),
};

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, expandVariables: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      providers: [pinoProvider],
      inject: [PINO],
      useFactory: (logger: Logger) => ({
        pinoHttp: { logger, autoLogging: { ignore: (req) => req.url === '/metrics' } },
      }),
    }),
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    pinoProvider,
    PrismaService,
    MetricsRegistry,
    { provide: AppLogger, useClass: PinoAppLogger },
    { provide: Clock, useClass: SystemClock },
    { provide: SyncMetrics, useClass: PrometheusSyncMetrics },
  ],
  exports: [PINO, PrismaService, MetricsRegistry, AppLogger, Clock, SyncMetrics],
})
export class InfrastructureModule {}
