import { createHash } from 'node:crypto';
import { InvalidPartnerPayloadError } from '../sync/sync-errors';
import { ExternalTransaction } from './external-transaction';
import { toSignedAmount } from './money';
import { NormalizedTransaction } from './transaction';

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function normalizeTransaction(external: ExternalTransaction): NormalizedTransaction {
  const externalTransactionId = external.transactionId?.trim();

  if (!externalTransactionId) {
    throw new InvalidPartnerPayloadError('transaction without stable transactionId');
  }

  const bookedAt = new Date(external.bookingDateTime);

  if (Number.isNaN(bookedAt.getTime())) {
    throw new InvalidPartnerPayloadError(
      `invalid bookingDateTime for transaction ${externalTransactionId}`,
    );
  }

  const currency = external.currency.trim().toUpperCase();

  if (!CURRENCY_PATTERN.test(currency)) {
    throw new InvalidPartnerPayloadError(
      `invalid currency for transaction ${externalTransactionId}`,
    );
  }

  const amount = toSignedAmount(external.amount, external.creditDebitIndicator);
  const description = external.description.trim().replace(/\s+/g, ' ');

  const content = {
    externalTransactionId,
    bookedAt,
    amount,
    currency,
    description,
    status: external.status,
  };

  return { ...content, contentHash: hashContent(content) };
}

function hashContent(content: Omit<NormalizedTransaction, 'contentHash'>): string {
  return createHash('sha256')
    .update(
      [
        content.externalTransactionId,
        content.bookedAt.toISOString(),
        content.amount,
        content.currency,
        content.description,
        content.status,
      ].join('|'),
    )
    .digest('hex');
}
