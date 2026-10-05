import { Consent } from '../../domain/consent/consent';
import {
  ExternalAccount,
  ExternalTransaction,
} from '../../domain/transaction/external-transaction';

export interface TransactionsPageRequest {
  consent: Consent;
  externalAccountId: string;
  from: Date;
  cursor: string | null;
}

export interface TransactionsPage {
  transactions: ExternalTransaction[];
  nextCursor: string | null;
}

export abstract class PartnerGateway {
  abstract listAccounts(consent: Consent): Promise<ExternalAccount[]>;
  abstract fetchTransactionsPage(request: TransactionsPageRequest): Promise<TransactionsPage>;
}
