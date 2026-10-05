import { Injectable } from '@nestjs/common';
import { ConsentLease } from '../../../application/ports/consent-lease.port';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaConsentLease extends ConsentLease {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async tryAcquire(consentId: string, owner: string, ttlMs: number): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE consents
      SET sync_lease_owner = ${owner},
          sync_lease_until = now() + make_interval(secs => ${ttlMs / 1000})
      WHERE id = ${consentId}::uuid
        AND (sync_lease_until IS NULL OR sync_lease_until < now())
    `;
    return updated === 1;
  }

  async renew(consentId: string, owner: string, ttlMs: number): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE consents
      SET sync_lease_until = now() + make_interval(secs => ${ttlMs / 1000})
      WHERE id = ${consentId}::uuid AND sync_lease_owner = ${owner}
    `;
    return updated === 1;
  }

  async release(consentId: string, owner: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE consents
      SET sync_lease_owner = NULL, sync_lease_until = NULL
      WHERE id = ${consentId}::uuid AND sync_lease_owner = ${owner}
    `;
  }
}
