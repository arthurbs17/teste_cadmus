import { z } from 'zod';
import { InvalidPartnerPayloadError } from '../../../domain/sync/sync-errors';
import {
  ExternalAccount,
  ExternalTransaction,
} from '../../../domain/transaction/external-transaction';

const accountsResponseSchema = z.object({
  data: z.array(
    z.object({
      accountId: z.string().min(1),
      type: z.string().min(1),
    }),
  ),
});

const transactionsResponseSchema = z.object({
  data: z.array(
    z.object({
      transactionId: z.string().nullish(),
      completedAuthorisedPaymentType: z.enum([
        'TRANSACAO_EFETIVADA',
        'LANCAMENTO_FUTURO',
        'TRANSACAO_PROCESSANDO',
      ]),
      creditDebitType: z.enum(['CREDITO', 'DEBITO']),
      transactionName: z.string(),
      transactionAmount: z.object({ amount: z.string(), currency: z.string() }),
      transactionDateTime: z.string(),
    }),
  ),
  links: z.object({ next: z.string().nullish() }).optional(),
});

export interface MappedTransactionsPage {
  transactions: ExternalTransaction[];
  nextLink: string | null;
}

const DEFAULT_ACCOUNT_CURRENCY = 'BRL';

export function mapAccounts(body: unknown): ExternalAccount[] {
  const parsed = parse(accountsResponseSchema, body, 'accounts');
  return parsed.data.map((account) => ({
    externalAccountId: account.accountId,
    type: account.type,
    currency: DEFAULT_ACCOUNT_CURRENCY,
  }));
}

export function mapTransactionsPage(body: unknown): MappedTransactionsPage {
  const parsed = parse(transactionsResponseSchema, body, 'transactions');
  return {
    transactions: parsed.data.map((transaction) => ({
      transactionId: transaction.transactionId ?? null,
      bookingDateTime: transaction.transactionDateTime,
      amount: transaction.transactionAmount.amount,
      currency: transaction.transactionAmount.currency,
      creditDebitIndicator: transaction.creditDebitType === 'CREDITO' ? 'CREDIT' : 'DEBIT',
      description: transaction.transactionName,
      status:
        transaction.completedAuthorisedPaymentType === 'TRANSACAO_EFETIVADA' ? 'BOOKED' : 'PENDING',
    })),
    nextLink: parsed.links?.next ?? null,
  };
}

function parse<T>(schema: z.ZodType<T>, body: unknown, resource: string): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new InvalidPartnerPayloadError(`unexpected ${resource} payload from partner`);
  }
  return result.data;
}
