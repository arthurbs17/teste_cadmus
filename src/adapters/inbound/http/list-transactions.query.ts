import { z } from 'zod';

export const listTransactionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(512).optional(),
  accountId: z.uuid().optional(),
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
