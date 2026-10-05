import { randomUUID } from 'node:crypto';
import {
  PartnerGateway,
  TransactionsPage,
  TransactionsPageRequest,
} from '../../../application/ports/partner-gateway.port';
import { Clock } from '../../../application/ports/clock.port';
import { Consent } from '../../../domain/consent/consent';
import {
  InvalidPartnerPayloadError,
  PartnerConsentRejectedError,
  PartnerRateLimitedError,
  PartnerRequestRejectedError,
  PartnerUnavailableError,
} from '../../../domain/sync/sync-errors';
import { ExternalAccount } from '../../../domain/transaction/external-transaction';
import { mapAccounts, mapTransactionsPage } from './open-finance.mapper';
import { parseRetryAfter } from './retry-after';

export interface HttpPartnerSettings {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  pageSize: number;
}

export class HttpPartnerGateway extends PartnerGateway {
  private readonly baseUrl: URL;

  constructor(
    private readonly settings: HttpPartnerSettings,
    private readonly clock: Clock,
  ) {
    super();
    this.baseUrl = new URL(settings.baseUrl);
  }

  async listAccounts(consent: Consent): Promise<ExternalAccount[]> {
    const url = new URL('accounts/v2/accounts', this.baseUrl);
    return mapAccounts(await this.get(url, consent));
  }

  async fetchTransactionsPage(request: TransactionsPageRequest): Promise<TransactionsPage> {
    const url = request.cursor
      ? this.trustedNextLink(request.cursor)
      : this.firstTransactionsPage(request);
    const page = mapTransactionsPage(await this.get(url, request.consent));
    return { transactions: page.transactions, nextCursor: page.nextLink };
  }

  private firstTransactionsPage(request: TransactionsPageRequest): URL {
    const path = `accounts/v2/accounts/${encodeURIComponent(request.externalAccountId)}/transactions`;
    const url = new URL(path, this.baseUrl);
    url.searchParams.set('fromBookingDate', request.from.toISOString().slice(0, 10));
    url.searchParams.set('toBookingDate', this.clock.now().toISOString().slice(0, 10));
    url.searchParams.set('page-size', String(this.settings.pageSize));
    return url;
  }

  private trustedNextLink(link: string): URL {
    const url = new URL(link, this.baseUrl);
    if (url.origin !== this.baseUrl.origin) {
      throw new InvalidPartnerPayloadError('pagination link points to an untrusted origin');
    }
    return url;
  }

  private async get(url: URL, consent: Consent): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${this.settings.apiKey}`,
          'x-fapi-interaction-id': randomUUID(),
          'x-consent-id': consent.externalConsentId,
        },
        signal: AbortSignal.timeout(this.settings.timeoutMs),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'unknown';
      throw new PartnerUnavailableError(`partner request failed: ${reason}`);
    }

    if (response.ok) {
      return response.json();
    }
    await response.body?.cancel();

    if (response.status === 429) {
      throw new PartnerRateLimitedError(
        parseRetryAfter(response.headers.get('retry-after'), this.clock.now()),
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new PartnerConsentRejectedError(`partner rejected consent: HTTP ${response.status}`);
    }
    if (response.status >= 500) {
      throw new PartnerUnavailableError(`partner unavailable: HTTP ${response.status}`);
    }
    throw new PartnerRequestRejectedError(`partner rejected request: HTTP ${response.status}`);
  }
}
