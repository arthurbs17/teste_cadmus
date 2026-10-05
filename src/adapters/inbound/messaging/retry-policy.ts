import { SyncConsentResult } from '../../../application/use-cases/sync-consent.use-case';
import { isTransient } from '../../../domain/sync/sync-errors';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export type DeliveryDecision =
  | { action: 'ack' }
  | { action: 'retry'; delayMs: number; nextAttempt: number }
  | { action: 'dead_letter'; reason: string };

export type Random = () => number;

export function decideOnResult(
  result: SyncConsentResult,
  attempt: number,
  policy: RetryPolicy,
  random: Random = Math.random,
): DeliveryDecision {
  if (result.outcome !== 'RATE_LIMITED') {
    return { action: 'ack' };
  }

  if (attempt >= policy.maxAttempts) {
    return { action: 'dead_letter', reason: 'rate limited on every attempt' };
  }

  const delayMs = result.retryAfterMs ?? backoffDelay(attempt, policy, random);
  const jitter = Math.round(delayMs * 0.2 * random());

  return {
    action: 'retry',
    delayMs: Math.min(delayMs + jitter, policy.maxDelayMs),
    nextAttempt: attempt + 1,
  };
}

export function decideOnError(
  error: unknown,
  attempt: number,
  policy: RetryPolicy,
  random: Random = Math.random,
): DeliveryDecision {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  if (!isTransient(error)) {
    return { action: 'dead_letter', reason };
  }

  if (attempt >= policy.maxAttempts) {
    return { action: 'dead_letter', reason: `max attempts reached: ${reason}` };
  }

  return {
    action: 'retry',
    delayMs: backoffDelay(attempt, policy, random),
    nextAttempt: attempt + 1,
  };
}

export function backoffDelay(attempt: number, policy: RetryPolicy, random: Random): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));

  return Math.round(exponential / 2 + (exponential / 2) * random());
}
