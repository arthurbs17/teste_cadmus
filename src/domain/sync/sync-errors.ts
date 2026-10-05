export abstract class SyncError extends Error {
  abstract readonly transient: boolean;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PartnerRateLimitedError extends SyncError {
  readonly transient = true;

  constructor(readonly retryAfterMs: number | null) {
    super('partner responded 429 Too Many Requests');
  }
}

export class PartnerUnavailableError extends SyncError {
  readonly transient = true;
}

export class LeaseLostError extends SyncError {
  readonly transient = true;

  constructor(consentId: string) {
    super(`sync lease lost for consent ${consentId}`);
  }
}

export class InvalidPartnerPayloadError extends SyncError {
  readonly transient = false;
}

export class PartnerConsentRejectedError extends SyncError {
  readonly transient = false;
}

export class PartnerRequestRejectedError extends SyncError {
  readonly transient = false;
}

export function isTransient(error: unknown): boolean {
  if (error instanceof SyncError) {
    return error.transient;
  }
  return true;
}
