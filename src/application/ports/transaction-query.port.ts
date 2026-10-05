import { TransactionView } from '../../domain/transaction/transaction';

export interface TransactionPageQuery {
  customerId: string;
  accountId?: string;
  limit: number;
  after?: { bookedAt: Date; id: string };
}

export abstract class TransactionQuery {
  abstract listByCustomer(query: TransactionPageQuery): Promise<TransactionView[]>;
}
