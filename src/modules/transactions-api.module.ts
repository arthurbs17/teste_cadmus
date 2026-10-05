import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransactionQuery } from '../application/ports/transaction-query.port';
import { ListTransactionsUseCase } from '../application/use-cases/list-transactions.use-case';
import { HttpMetricsInterceptor } from '../adapters/inbound/http/http-metrics.interceptor';
import { TransactionsController } from '../adapters/inbound/http/transactions.controller';
import { PrismaTransactionQuery } from '../adapters/outbound/persistence/prisma-transaction.query';
import { InfrastructureModule } from './infrastructure.module';

@Module({
  imports: [InfrastructureModule],
  controllers: [TransactionsController],
  providers: [
    { provide: TransactionQuery, useClass: PrismaTransactionQuery },
    {
      provide: ListTransactionsUseCase,
      inject: [TransactionQuery],
      useFactory: (transactions: TransactionQuery) => new ListTransactionsUseCase(transactions),
    },
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class TransactionsApiModule {}
