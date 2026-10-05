export class InvalidCursorError extends Error {
  constructor() {
    super('invalid pagination cursor');
    this.name = 'InvalidCursorError';
  }
}

export interface TransactionCursor {
  bookedAt: Date;
  id: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: TransactionCursor): string {
  return Buffer.from(`${cursor.bookedAt.toISOString()}|${cursor.id}`).toString('base64url');
}

export function decodeCursor(raw: string): TransactionCursor {
  const [bookedAtRaw, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');

  const bookedAt = new Date(bookedAtRaw ?? '');

  if (Number.isNaN(bookedAt.getTime()) || !id || !UUID_PATTERN.test(id)) {
    throw new InvalidCursorError();
  }

  return { bookedAt, id };
}
