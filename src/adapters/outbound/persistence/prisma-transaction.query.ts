import { Injectable } from '@nestjs/common';
import {
  TransactionPageQuery,
  TransactionQuery,
} from '../../../application/ports/transaction-query.port';
import { TransactionStatus, TransactionView } from '../../../domain/transaction/transaction';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from './prisma.service';

interface TransactionRow {
  id: string;
  accountId: string;
  bookedAt: Date;
  amount: string;
  currency: string;
  description: string;
  status: TransactionStatus;
}

@Injectable()
export class PrismaTransactionQuery extends TransactionQuery {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async listByCustomer(query: TransactionPageQuery): Promise<TransactionView[]> {
    const accountFilter = query.accountId
      ? Prisma.sql`AND account_id = ${query.accountId}::uuid`
      : Prisma.empty;
    const keysetFilter = query.after
      ? Prisma.sql`AND (booked_at, id) < (${query.after.bookedAt.toISOString()}::timestamptz, ${query.after.id}::uuid)`
      : Prisma.empty;

    return this.prisma.$queryRaw<TransactionRow[]>`
      SELECT id, account_id AS "accountId", booked_at AS "bookedAt", amount::text AS amount,
             currency, description, status::text AS status
      FROM transactions
      WHERE customer_id = ${query.customerId}::uuid
        ${accountFilter}
        ${keysetFilter}
      ORDER BY booked_at DESC, id DESC
      LIMIT ${query.limit}
    `;
  }
}
