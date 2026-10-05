import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export type MessageOutcome = 'ack' | 'retry' | 'dead_letter';

@Injectable()
export class MetricsRegistry {
  readonly registry = new Registry();

  readonly syncRuns = new Counter({
    name: 'sync_runs_total',
    help: 'Consent synchronizations by institution and outcome',
    labelNames: ['institution', 'outcome'],
    registers: [this.registry],
  });

  readonly syncDuration = new Histogram({
    name: 'sync_duration_seconds',
    help: 'Duration of consent synchronizations',
    labelNames: ['institution', 'outcome'],
    buckets: [1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600],
    registers: [this.registry],
  });

  readonly transactionsUpserted = new Counter({
    name: 'sync_transactions_upserted_total',
    help: 'Transactions inserted or updated by synchronizations',
    labelNames: ['institution'],
    registers: [this.registry],
  });

  readonly partnerRateLimited = new Counter({
    name: 'partner_rate_limited_total',
    help: 'HTTP 429 responses received from partner institutions',
    labelNames: ['institution'],
    registers: [this.registry],
  });

  readonly messages = new Counter({
    name: 'sync_messages_total',
    help: 'Sync queue messages by delivery outcome',
    labelNames: ['outcome'],
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 4, 8],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  registerStalenessGauge(collect: () => Promise<number>): void {
    new Gauge({
      name: 'consent_sync_staleness_seconds',
      help: 'Age of the oldest successful sync among active consents',
      registers: [this.registry],
      async collect() {
        this.set(await collect());
      },
    });
  }
}
