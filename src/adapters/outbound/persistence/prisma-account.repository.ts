import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../../application/ports/account-repository.port';
import { Consent } from '../../../domain/consent/consent';
import { ExternalAccount } from '../../../domain/transaction/external-transaction';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaAccountRepository extends AccountRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async upsertForConsent(
    consent: Consent,
    accounts: ExternalAccount[],
  ): Promise<Map<string, string>> {
    const rows = await this.prisma.$transaction(
      accounts.map((account) =>
        this.prisma.account.upsert({
          where: {
            institutionId_externalAccountId: {
              institutionId: consent.institutionId,
              externalAccountId: account.externalAccountId,
            },
          },
          create: {
            consentId: consent.id,
            customerId: consent.customerId,
            institutionId: consent.institutionId,
            externalAccountId: account.externalAccountId,
            type: account.type,
            currency: account.currency,
          },
          update: { consentId: consent.id, type: account.type, currency: account.currency },
          select: { id: true, externalAccountId: true },
        }),
      ),
    );
    return new Map(rows.map((row) => [row.externalAccountId, row.id]));
  }
}
