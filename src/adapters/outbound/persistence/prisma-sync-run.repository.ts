import { Injectable } from '@nestjs/common';
import {
  StartSyncRun,
  SyncPage,
  SyncRunRepository,
} from '../../../application/ports/sync-run-repository.port';
import { SyncCheckpoint } from '../../../domain/sync/sync-checkpoint';
import { SyncRun } from '../../../domain/sync/sync-run';
import { NormalizedTransaction } from '../../../domain/transaction/transaction';
import { Prisma, SyncRun as SyncRunRow } from '../../../generated/prisma/client';
import { PrismaService } from './prisma.service';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class PrismaSyncRunRepository extends SyncRunRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findResumable(consentId: string): Promise<SyncRun | null> {
    const latest = await this.prisma.syncRun.findFirst({
      where: { consentId },
      orderBy: { startedAt: 'desc' },
    });
    if (!latest || latest.status === 'SUCCEEDED' || !latest.checkpoint) {
      return null;
    }
    return toDomain(latest);
  }

  async start(run: StartSyncRun): Promise<SyncRun> {
    const row = await this.prisma.syncRun.create({
      data: {
        consentId: run.consentId,
        correlationId: run.correlationId,
        attempt: run.attempt,
        status: 'RUNNING',
        checkpoint: toJson(run.checkpoint),
      },
    });
    return toDomain(row);
  }

  async resume(runId: string, correlationId: string, attempt: number): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', correlationId, attempt, error: null },
    });
  }

  async recordPage(runId: string, page: SyncPage): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const upserted = await upsertTransactions(tx, page);
      await tx.syncRun.update({
        where: { id: runId },
        data: {
          checkpoint: toJson(page.checkpoint),
          pagesFetched: { increment: 1 },
          transactionsUpserted: { increment: upserted },
        },
      });
      return upserted;
    });
  }

  async markSucceeded(runId: string, consentId: string, finishedAt: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.syncRun.update({
        where: { id: runId },
        data: { status: 'SUCCEEDED', finishedAt, error: null },
      }),
      this.prisma.consent.update({ where: { id: consentId }, data: { lastSyncedAt: finishedAt } }),
    ]);
  }

  async markRateLimited(runId: string, reason: string): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id: runId },
      data: { status: 'RATE_LIMITED', error: reason },
    });
  }

  async markFailed(runId: string, reason: string): Promise<void> {
    await this.prisma.syncRun.update({
      where: { id: runId },
      data: { status: 'FAILED', error: reason.slice(0, 2000) },
    });
  }
}

async function upsertTransactions(tx: TransactionClient, page: SyncPage): Promise<number> {
  if (page.transactions.length === 0) {
    return 0;
  }
  const column = <K extends keyof NormalizedTransaction>(key: K) =>
    page.transactions.map((transaction) => transaction[key]);

  return tx.$executeRaw`
    INSERT INTO transactions (
      id, account_id, customer_id, external_transaction_id, booked_at,
      amount, currency, description, status, content_hash, updated_at
    )
    SELECT
      gen_random_uuid(), ${page.accountId}::uuid, ${page.customerId}::uuid, t.external_id,
      t.booked_at, t.amount, t.currency, t.description, t.status::transaction_status,
      t.content_hash, now()
    FROM unnest(
      ${column('externalTransactionId')}::text[],
      ${column('bookedAt').map((date) => date.toISOString())}::timestamptz[],
      ${column('amount')}::numeric[],
      ${column('currency')}::text[],
      ${column('description')}::text[],
      ${column('status')}::text[],
      ${column('contentHash')}::text[]
    ) AS t(external_id, booked_at, amount, currency, description, status, content_hash)
    ON CONFLICT (account_id, external_transaction_id) DO UPDATE SET
      booked_at = EXCLUDED.booked_at,
      amount = EXCLUDED.amount,
      currency = EXCLUDED.currency,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      content_hash = EXCLUDED.content_hash,
      updated_at = now()
    WHERE transactions.content_hash <> EXCLUDED.content_hash
  `;
}

function toJson(checkpoint: SyncCheckpoint): Prisma.InputJsonObject {
  return { ...checkpoint };
}

function toDomain(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    consentId: row.consentId,
    correlationId: row.correlationId,
    status: row.status,
    attempt: row.attempt,
    checkpoint: row.checkpoint as unknown as SyncCheckpoint,
  };
}
