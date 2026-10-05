import { Consent } from '../../domain/consent/consent';
import { ExternalAccount } from '../../domain/transaction/external-transaction';

export abstract class AccountRepository {
  abstract upsertForConsent(
    consent: Consent,
    accounts: ExternalAccount[],
  ): Promise<Map<string, string>>;
}
