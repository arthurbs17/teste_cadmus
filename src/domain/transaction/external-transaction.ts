export type CreditDebitIndicator = 'CREDIT' | 'DEBIT';

export type ExternalTransactionStatus = 'PENDING' | 'BOOKED';

export interface ExternalAccount {
  externalAccountId: string;
  type: string;
  currency: string;
}

export interface ExternalTransaction {
  transactionId: string | null;
  bookingDateTime: string;
  amount: string;
  currency: string;
  creditDebitIndicator: CreditDebitIndicator;
  description: string;
  status: ExternalTransactionStatus;
}
