import { SyncCheckpoint } from './sync-checkpoint';

export type SyncRunStatus = 'RUNNING' | 'SUCCEEDED' | 'RATE_LIMITED' | 'FAILED';

export interface SyncRun {
  id: string;
  consentId: string;
  correlationId: string;
  status: SyncRunStatus;
  checkpoint: SyncCheckpoint;
  attempt: number;
}
