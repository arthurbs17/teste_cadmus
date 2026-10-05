export type TransactionStatus = 'PENDING' | 'BOOKED';

export interface NormalizedTransaction {
  externalTransactionId: string;
  bookedAt: Date;
  amount: string;
  currency: string;
  description: string;
  status: TransactionStatus;
  contentHash: string;
}

export interface TransactionView {
  id: string;
  accountId: string;
  bookedAt: Date;
  amount: string;
  currency: string;
  description: string;
  status: TransactionStatus;
}
