import { Injectable } from '@nestjs/common';
import { SyncMetrics, SyncOutcome } from '../../../application/ports/sync-metrics.port';
import { MetricsRegistry } from './metrics.registry';

@Injectable()
export class PrometheusSyncMetrics extends SyncMetrics {
  constructor(private readonly metrics: MetricsRegistry) {
    super();
  }

  recordSyncRun(institutionId: string, outcome: SyncOutcome, durationMs: number): void {
    this.metrics.syncRuns.inc({ institution: institutionId, outcome });
    if (outcome !== 'skipped') {
      this.metrics.syncDuration.observe({ institution: institutionId, outcome }, durationMs / 1000);
    }
  }

  recordTransactionsUpserted(institutionId: string, count: number): void {
    this.metrics.transactionsUpserted.inc({ institution: institutionId }, count);
  }

  recordPartnerRateLimited(institutionId: string): void {
    this.metrics.partnerRateLimited.inc({ institution: institutionId });
  }
}
