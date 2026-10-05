import { randomUUID } from 'node:crypto';
import { Consent, isSyncable } from '../../domain/consent/consent';
import {
  advanceCheckpoint,
  initialCheckpoint,
  resumeCursorFor,
} from '../../domain/sync/sync-checkpoint';
import {
  LeaseLostError,
  PartnerRateLimitedError,
  isTransient,
} from '../../domain/sync/sync-errors';
import { SyncRun } from '../../domain/sync/sync-run';
import { syncWindowStart } from '../../domain/sync/sync-window';
import { deduplicateBatch } from '../../domain/transaction/transaction-identity';
import { normalizeTransaction } from '../../domain/transaction/transaction-normalizer';
import { AccountRepository } from '../ports/account-repository.port';
import { AppLogger, LogFields } from '../ports/app-logger.port';
import { Clock } from '../ports/clock.port';
import { ConsentLease } from '../ports/consent-lease.port';
import { ConsentRepository } from '../ports/consent-repository.port';
import { PartnerGateway } from '../ports/partner-gateway.port';
import { SyncMetrics } from '../ports/sync-metrics.port';
import { SyncRunRepository } from '../ports/sync-run-repository.port';

export interface SyncConsentCommand {
  consentId: string;
  correlationId: string;
  attempt: number;
}

export interface SyncSettings {
  workerId: string;
  leaseTtlMs: number;
  overlapDays: number;
  initialLookbackDays: number;
}

export type SyncSkipReason = 'CONSENT_NOT_FOUND' | 'CONSENT_NOT_SYNCABLE' | 'ALREADY_RUNNING';

export type SyncConsentResult =
  | { outcome: 'SUCCEEDED'; syncRunId: string; transactionsUpserted: number }
  | { outcome: 'RATE_LIMITED'; syncRunId: string; retryAfterMs: number | null }
  | { outcome: 'SKIPPED'; reason: SyncSkipReason };

export class SyncConsentUseCase {
  constructor(
    private readonly consents: ConsentRepository,
    private readonly lease: ConsentLease,
    private readonly accounts: AccountRepository,
    private readonly syncRuns: SyncRunRepository,
    private readonly partner: PartnerGateway,
    private readonly metrics: SyncMetrics,
    private readonly logger: AppLogger,
    private readonly clock: Clock,
    private readonly settings: SyncSettings,
  ) {}

  async execute(command: SyncConsentCommand): Promise<SyncConsentResult> {
    const context: LogFields = { ...command };

    const consent = await this.consents.findById(command.consentId);

    if (!consent) {
      this.logger.warn('sync.skipped', { ...context, reason: 'CONSENT_NOT_FOUND' });
      return { outcome: 'SKIPPED', reason: 'CONSENT_NOT_FOUND' };
    }

    context.institutionId = consent.institutionId;

    if (!isSyncable(consent, this.clock.now())) {
      return this.skip(consent, context, 'CONSENT_NOT_SYNCABLE');
    }

    const leaseOwner = `${this.settings.workerId}:${randomUUID()}`;

    if (!(await this.lease.tryAcquire(consent.id, leaseOwner, this.settings.leaseTtlMs))) {
      return this.skip(consent, context, 'ALREADY_RUNNING');
    }

    try {
      return await this.runSync(consent, command, { ...context, leaseOwner });
    } finally {
      await this.lease.release(consent.id, leaseOwner);
    }
  }

  private async runSync(
    consent: Consent,
    command: SyncConsentCommand,
    context: LogFields & { leaseOwner: string },
  ): Promise<SyncConsentResult> {
    const startedAt = this.clock.now();
    const run = await this.openRun(consent, command, startedAt);
    const { leaseOwner, ...logContext } = context;
    const runContext = { ...logContext, syncRunId: run.id };

    this.logger.info('sync.started', { ...runContext, checkpoint: run.checkpoint });

    try {
      const transactionsUpserted = await this.synchronizeAccounts(
        consent,
        run,
        leaseOwner,
        runContext,
      );

      await this.syncRuns.markSucceeded(run.id, consent.id, this.clock.now());

      const durationMs = this.elapsedSince(startedAt);

      this.metrics.recordSyncRun(consent.institutionId, 'succeeded', durationMs);
      this.logger.info('sync.succeeded', { ...runContext, transactionsUpserted, durationMs });

      return { outcome: 'SUCCEEDED', syncRunId: run.id, transactionsUpserted };
    } catch (error) {
      const durationMs = this.elapsedSince(startedAt);

      if (error instanceof PartnerRateLimitedError) {
        await this.syncRuns.markRateLimited(run.id, error.message);

        this.metrics.recordPartnerRateLimited(consent.institutionId);
        this.metrics.recordSyncRun(consent.institutionId, 'rate_limited', durationMs);

        this.logger.warn('sync.rate_limited', {
          ...runContext,
          retryAfterMs: error.retryAfterMs,
          durationMs,
        });

        return { outcome: 'RATE_LIMITED', syncRunId: run.id, retryAfterMs: error.retryAfterMs };
      }

      const reason = error instanceof Error ? error.message : String(error);

      await this.syncRuns.markFailed(run.id, reason);

      this.metrics.recordSyncRun(consent.institutionId, 'failed', durationMs);

      this.logger.error('sync.failed', {
        ...runContext,
        errorType: error instanceof Error ? error.name : typeof error,
        reason,
        transient: isTransient(error),
        durationMs,
      });

      throw error;
    }
  }

  private async openRun(
    consent: Consent,
    command: SyncConsentCommand,
    now: Date,
  ): Promise<SyncRun> {
    const resumable = await this.syncRuns.findResumable(consent.id);

    if (resumable) {
      await this.syncRuns.resume(resumable.id, command.correlationId, command.attempt);
      return { ...resumable, correlationId: command.correlationId, attempt: command.attempt };
    }

    const windowStart = syncWindowStart(
      consent.lastSyncedAt,
      now,
      this.settings.overlapDays,
      this.settings.initialLookbackDays,
    );

    return this.syncRuns.start({
      consentId: consent.id,
      correlationId: command.correlationId,
      attempt: command.attempt,
      checkpoint: initialCheckpoint(windowStart),
    });
  }

  private async synchronizeAccounts(
    consent: Consent,
    run: SyncRun,
    leaseOwner: string,
    context: LogFields,
  ): Promise<number> {
    const externalAccounts = await this.partner.listAccounts(consent);
    const accountIds = await this.accounts.upsertForConsent(consent, externalAccounts);
    const windowStart = new Date(run.checkpoint.windowStart);
    let checkpoint = run.checkpoint;
    let upserted = 0;

    const pendingAccounts = externalAccounts
      .map((account) => account.externalAccountId)
      .filter((externalAccountId) => !checkpoint.completedAccountIds.includes(externalAccountId))
      .sort();

    for (const externalAccountId of pendingAccounts) {
      const accountId = accountIds.get(externalAccountId);

      if (!accountId) {
        throw new Error(`account ${externalAccountId} was not persisted`);
      }

      let cursor = resumeCursorFor(checkpoint, externalAccountId);

      do {
        const page = await this.partner.fetchTransactionsPage({
          consent,
          externalAccountId,
          from: windowStart,
          cursor,
        });

        const transactions = deduplicateBatch(page.transactions.map(normalizeTransaction));
        checkpoint = advanceCheckpoint(checkpoint, externalAccountId, page.nextCursor);

        const count = await this.syncRuns.recordPage(run.id, {
          accountId,
          customerId: consent.customerId,
          transactions,
          checkpoint,
        });

        upserted += count;

        this.metrics.recordTransactionsUpserted(consent.institutionId, count);

        this.logger.info('sync.page_recorded', {
          ...context,
          accountId,
          received: page.transactions.length,
          upserted: count,
          hasMore: page.nextCursor !== null,
        });

        await this.renewLease(consent.id, leaseOwner);

        cursor = page.nextCursor;
      } while (cursor);
    }

    return upserted;
  }

  private async renewLease(consentId: string, leaseOwner: string): Promise<void> {
    if (!(await this.lease.renew(consentId, leaseOwner, this.settings.leaseTtlMs))) {
      throw new LeaseLostError(consentId);
    }
  }

  private skip(consent: Consent, context: LogFields, reason: SyncSkipReason): SyncConsentResult {
    this.metrics.recordSyncRun(consent.institutionId, 'skipped', 0);
    this.logger.info('sync.skipped', { ...context, reason });

    return { outcome: 'SKIPPED', reason };
  }

  private elapsedSince(startedAt: Date): number {
    return this.clock.now().getTime() - startedAt.getTime();
  }
}
