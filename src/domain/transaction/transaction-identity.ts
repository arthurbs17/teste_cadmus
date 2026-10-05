import { NormalizedTransaction } from './transaction';

export function deduplicateBatch(transactions: NormalizedTransaction[]): NormalizedTransaction[] {
  const byExternalId = new Map<string, NormalizedTransaction>();

  for (const transaction of transactions) {
    const current = byExternalId.get(transaction.externalTransactionId);

    if (!current || supersedes(transaction, current)) {
      byExternalId.set(transaction.externalTransactionId, transaction);
    }
  }

  return [...byExternalId.values()];
}

function supersedes(candidate: NormalizedTransaction, current: NormalizedTransaction): boolean {
  if (candidate.status !== current.status) {
    return candidate.status === 'BOOKED';
  }

  return true;
}
