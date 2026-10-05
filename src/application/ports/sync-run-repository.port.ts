import { SyncCheckpoint } from '../../domain/sync/sync-checkpoint';
import { SyncRun } from '../../domain/sync/sync-run';
import { NormalizedTransaction } from '../../domain/transaction/transaction';

export interface StartSyncRun {
  consentId: string;
  correlationId: string;
  attempt: number;
  checkpoint: SyncCheckpoint;
}

export interface SyncPage {
  accountId: string;
  customerId: string;
  transactions: NormalizedTransaction[];
  checkpoint: SyncCheckpoint;
}

export abstract class SyncRunRepository {
  abstract findResumable(consentId: string): Promise<SyncRun | null>;
  abstract start(run: StartSyncRun): Promise<SyncRun>;
  abstract resume(runId: string, correlationId: string, attempt: number): Promise<void>;
  abstract recordPage(runId: string, page: SyncPage): Promise<number>;
  abstract markSucceeded(runId: string, consentId: string, finishedAt: Date): Promise<void>;
  abstract markRateLimited(runId: string, reason: string): Promise<void>;
  abstract markFailed(runId: string, reason: string): Promise<void>;
}
