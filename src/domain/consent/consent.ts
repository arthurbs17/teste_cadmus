export type ConsentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface Consent {
  id: string;
  customerId: string;
  institutionId: string;
  externalConsentId: string;
  status: ConsentStatus;
  expiresAt: Date;
  lastSyncedAt: Date | null;
}

export function isSyncable(consent: Consent, now: Date): boolean {
  return consent.status === 'ACTIVE' && consent.expiresAt.getTime() > now.getTime();
}
