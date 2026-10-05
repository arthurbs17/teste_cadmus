import { randomUUID } from 'node:crypto';
import { ConsumeMessage } from 'amqplib';
import { z } from 'zod';

export const ATTEMPT_HEADER = 'x-attempt';

const bodySchema = z.object({
  consentId: z.uuid(),
  correlationId: z.string().min(1).max(128).optional(),
});

export interface SyncMessage {
  consentId: string;
  correlationId: string;
  attempt: number;
}

export function parseSyncMessage(message: ConsumeMessage): SyncMessage | null {
  let body: unknown;

  try {
    body = JSON.parse(message.content.toString('utf8'));
  } catch {
    return null;
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return null;
  }

  const attemptHeader = Number(message.properties.headers?.[ATTEMPT_HEADER]);

  return {
    consentId: parsed.data.consentId,
    correlationId: parsed.data.correlationId ?? message.properties.correlationId ?? randomUUID(),
    attempt: Number.isInteger(attemptHeader) && attemptHeader > 0 ? attemptHeader : 1,
  };
}
