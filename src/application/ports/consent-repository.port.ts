import { Consent } from '../../domain/consent/consent';

export abstract class ConsentRepository {
  abstract findById(consentId: string): Promise<Consent | null>;
}
