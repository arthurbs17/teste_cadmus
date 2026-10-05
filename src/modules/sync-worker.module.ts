import { hostname } from 'node:os';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountRepository } from '../application/ports/account-repository.port';
import { AppLogger } from '../application/ports/app-logger.port';
import { Clock } from '../application/ports/clock.port';
import { ConsentLease } from '../application/ports/consent-lease.port';
import { ConsentRepository } from '../application/ports/consent-repository.port';
import { PartnerGateway } from '../application/ports/partner-gateway.port';
import { SyncMetrics } from '../application/ports/sync-metrics.port';
import { SyncRunRepository } from '../application/ports/sync-run-repository.port';
import { SyncConsentUseCase } from '../application/use-cases/sync-consent.use-case';
import { RabbitMqConnection } from '../adapters/inbound/messaging/rabbitmq.connection';
import { SyncConsentConsumer } from '../adapters/inbound/messaging/sync-consent.consumer';
import { syncTopology } from '../adapters/inbound/messaging/sync-topology';
import { MetricsRegistry } from '../adapters/outbound/observability/metrics.registry';
import { HttpPartnerGateway } from '../adapters/outbound/partner/http-partner.gateway';
import { PrismaAccountRepository } from '../adapters/outbound/persistence/prisma-account.repository';
import { PrismaConsentLease } from '../adapters/outbound/persistence/prisma-consent.lease';
import { PrismaConsentRepository } from '../adapters/outbound/persistence/prisma-consent.repository';
import { PrismaSyncRunRepository } from '../adapters/outbound/persistence/prisma-sync-run.repository';
import { Env } from '../config/env';
import { InfrastructureModule } from './infrastructure.module';

@Module({
  imports: [InfrastructureModule],
  providers: [
    PrismaConsentRepository,
    RabbitMqConnection,
    { provide: ConsentRepository, useExisting: PrismaConsentRepository },
    { provide: ConsentLease, useClass: PrismaConsentLease },
    { provide: AccountRepository, useClass: PrismaAccountRepository },
    { provide: SyncRunRepository, useClass: PrismaSyncRunRepository },
    {
      provide: PartnerGateway,
      inject: [ConfigService, Clock],
      useFactory: (config: ConfigService<Env, true>, clock: Clock) =>
        new HttpPartnerGateway(
          {
            baseUrl: config.get('PARTNER_BASE_URL', { infer: true }),
            apiKey: config.get('PARTNER_API_KEY', { infer: true }),
            timeoutMs: config.get('PARTNER_TIMEOUT_MS', { infer: true }),
            pageSize: config.get('PARTNER_PAGE_SIZE', { infer: true }),
          },
          clock,
        ),
    },
    {
      provide: SyncConsentUseCase,
      inject: [
        ConsentRepository,
        ConsentLease,
        AccountRepository,
        SyncRunRepository,
        PartnerGateway,
        SyncMetrics,
        AppLogger,
        Clock,
        ConfigService,
      ],
      useFactory: (
        consents: ConsentRepository,
        lease: ConsentLease,
        accounts: AccountRepository,
        syncRuns: SyncRunRepository,
        partner: PartnerGateway,
        metrics: SyncMetrics,
        logger: AppLogger,
        clock: Clock,
        config: ConfigService<Env, true>,
      ) =>
        new SyncConsentUseCase(
          consents,
          lease,
          accounts,
          syncRuns,
          partner,
          metrics,
          logger,
          clock,
          {
            workerId: `${hostname()}:${process.pid}`,
            leaseTtlMs: config.get('SYNC_LEASE_TTL_MS', { infer: true }),
            overlapDays: config.get('SYNC_OVERLAP_DAYS', { infer: true }),
            initialLookbackDays: config.get('SYNC_INITIAL_LOOKBACK_DAYS', { infer: true }),
          },
        ),
    },
    {
      provide: SyncConsentConsumer,
      inject: [RabbitMqConnection, SyncConsentUseCase, MetricsRegistry, AppLogger, ConfigService],
      useFactory: (
        connection: RabbitMqConnection,
        syncConsent: SyncConsentUseCase,
        metrics: MetricsRegistry,
        logger: AppLogger,
        config: ConfigService<Env, true>,
      ) =>
        new SyncConsentConsumer(connection, syncConsent, metrics, logger, {
          url: config.get('RABBITMQ_URL', { infer: true }),
          prefetch: config.get('SYNC_PREFETCH', { infer: true }),
          topology: syncTopology(config.get('SYNC_QUEUE', { infer: true })),
          retryPolicy: {
            maxAttempts: config.get('SYNC_MAX_ATTEMPTS', { infer: true }),
            baseDelayMs: config.get('SYNC_RETRY_BASE_DELAY_MS', { infer: true }),
            maxDelayMs: config.get('SYNC_RETRY_MAX_DELAY_MS', { infer: true }),
          },
        }),
    },
  ],
})
export class SyncWorkerModule implements OnModuleInit {
  constructor(
    private readonly metrics: MetricsRegistry,
    private readonly consents: PrismaConsentRepository,
  ) {}

  onModuleInit(): void {
    this.metrics.registerStalenessGauge(() => this.consents.maxSyncStalenessSeconds());
  }
}
