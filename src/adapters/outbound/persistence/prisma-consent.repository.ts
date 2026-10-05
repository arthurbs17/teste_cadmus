import { Injectable } from '@nestjs/common';
import { ConsentRepository } from '../../../application/ports/consent-repository.port';
import { Consent } from '../../../domain/consent/consent';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaConsentRepository extends ConsentRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findById(consentId: string): Promise<Consent | null> {
    const row = await this.prisma.consent.findUnique({ where: { id: consentId } });
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      customerId: row.customerId,
      institutionId: row.institutionId,
      externalConsentId: row.externalConsentId,
      status: row.status,
      expiresAt: row.expiresAt,
      lastSyncedAt: row.lastSyncedAt,
    };
  }

  async maxSyncStalenessSeconds(): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ staleness: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM now() - MIN(COALESCE(last_synced_at, created_at)))::float8 AS staleness
      FROM consents
      WHERE status = 'ACTIVE' AND expires_at > now()
    `;
    return row?.staleness ?? 0;
  }
}
