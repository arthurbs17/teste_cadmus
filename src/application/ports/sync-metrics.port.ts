export type SyncOutcome = 'succeeded' | 'rate_limited' | 'failed' | 'skipped';

export abstract class SyncMetrics {
  abstract recordSyncRun(institutionId: string, outcome: SyncOutcome, durationMs: number): void;
  abstract recordTransactionsUpserted(institutionId: string, count: number): void;
  abstract recordPartnerRateLimited(institutionId: string): void;
}
