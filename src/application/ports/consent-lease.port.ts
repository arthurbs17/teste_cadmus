export abstract class ConsentLease {
  abstract tryAcquire(consentId: string, owner: string, ttlMs: number): Promise<boolean>;
  abstract renew(consentId: string, owner: string, ttlMs: number): Promise<boolean>;
  abstract release(consentId: string, owner: string): Promise<void>;
}
