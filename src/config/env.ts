import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WORKER_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  RABBITMQ_URL: z.url(),
  SYNC_QUEUE: z.string().min(1).default('sync.consent'),
  SYNC_PREFETCH: z.coerce.number().int().positive().default(2),
  SYNC_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  SYNC_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(5000),
  SYNC_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(900000),
  SYNC_LEASE_TTL_MS: z.coerce.number().int().positive().default(120000),
  SYNC_OVERLAP_DAYS: z.coerce.number().int().nonnegative().default(7),
  SYNC_INITIAL_LOOKBACK_DAYS: z.coerce.number().int().positive().default(365),
  PARTNER_BASE_URL: z.url(),
  PARTNER_API_KEY: z.string().min(1),
  PARTNER_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  PARTNER_PAGE_SIZE: z.coerce.number().int().min(1).max(1000).default(500),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const invalidKeys = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`invalid environment configuration: ${invalidKeys}`);
  }

  return result.data;
}
