import { Controller, Get, Param, ParseUUIDPipe, Query, UseFilters } from '@nestjs/common';
import {
  ListTransactionsUseCase,
  TransactionListPage,
} from '../../../application/use-cases/list-transactions.use-case';
import { InvalidCursorFilter } from './invalid-cursor.filter';
import type { ListTransactionsQuery } from './list-transactions.query';
import { listTransactionsQuerySchema } from './list-transactions.query';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('customers/:customerId/transactions')
@UseFilters(InvalidCursorFilter)
export class TransactionsController {
  constructor(private readonly listTransactions: ListTransactionsUseCase) {}

  @Get()
  list(
    @Param('customerId', new ParseUUIDPipe()) customerId: string,
    @Query(new ZodValidationPipe(listTransactionsQuerySchema)) query: ListTransactionsQuery,
  ): Promise<TransactionListPage> {
    return this.listTransactions.execute({ customerId, ...query });
  }
}
