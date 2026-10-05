import { TransactionView } from '../../domain/transaction/transaction';
import { TransactionQuery } from '../ports/transaction-query.port';
import { decodeCursor, encodeCursor } from './transaction-cursor';

export interface ListTransactionsCommand {
  customerId: string;
  accountId?: string;
  limit: number;
  cursor?: string;
}

export interface TransactionListPage {
  items: TransactionView[];
  nextCursor: string | null;
}

export class ListTransactionsUseCase {
  constructor(private readonly transactions: TransactionQuery) {}

  async execute(command: ListTransactionsCommand): Promise<TransactionListPage> {
    const rows = await this.transactions.listByCustomer({
      customerId: command.customerId,
      accountId: command.accountId,
      limit: command.limit + 1,
      after: command.cursor ? decodeCursor(command.cursor) : undefined,
    });

    const items = rows.slice(0, command.limit);
    const last = items.at(-1);
    const nextCursor = rows.length > command.limit && last ? encodeCursor(last) : null;

    return { items, nextCursor };
  }
}
