import { InvalidPartnerPayloadError } from '../sync/sync-errors';
import { CreditDebitIndicator } from './external-transaction';

const SCALE = 4;
const AMOUNT_PATTERN = /^\d{1,15}(\.\d{1,4})?$/;

export function toSignedAmount(amount: string, indicator: CreditDebitIndicator): string {
  const trimmed = amount.trim();

  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new InvalidPartnerPayloadError(`invalid amount format: "${amount}"`);
  }

  const [integerPart, fractionPart = ''] = trimmed.split('.');
  const normalizedInteger = BigInt(integerPart).toString();
  const normalized = `${normalizedInteger}.${fractionPart.padEnd(SCALE, '0')}`;
  const isZero = /^0\.0+$/.test(normalized);

  return indicator === 'DEBIT' && !isZero ? `-${normalized}` : normalized;
}
