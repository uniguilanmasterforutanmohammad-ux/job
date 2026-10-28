import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  BulkImportDto,
  MoveLeadDto,
  OnlineFormDto,
  PipelineQueryDto,
  ReEngagementDto,
} from './dto/crm-ext.schemas.js';

@Injectable()
export class CrmExtService {
  private readonly logger = new Logger(CrmExtService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** CRM-04 — customers who have not visited within `days`. */
  async reEngagement(tenantId: string, dto: ReEngagementDto) {
    const threshold = new Date(Date.now() - dto.days * 24 * 60 * 60 * 1000);
    const customers = await this.prisma.client.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(dto.tag ? { tags: { has: dto.tag } } : {}),
      },
      include: {
        appointments: { orderBy: { startsAt: 'desc' }, take: 1, select: { startsAt: true } },
      },
    });
    return customers
      .map((c) => ({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        lastVisit: c.appointments[0]?.startsAt ?? null,
      }))
      .filter((c) => !c.lastVisit || c.lastVisit < threshold)
      .sort((a, b) => (a.lastVisit?.getTime() ?? 0) - (b.lastVisit?.getTime() ?? 0));
  }

  /** CRM-05 — likely duplicates by phone or normalized name. */
  async findDuplicates(tenantId: string) {
    const customers = await this.prisma.client.customer.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, fullName: true, phone: true, createdAt: true },
    });

    const groups = new Map<string, typeof customers>();
    for (const c of customers) {
      const key = c.phone ?? c.fullName.trim().replace(/\s+/g, ' ').toLowerCase();
      const bucket = groups.get(key) ?? [];
      bucket.push(c);
      groups.set(key, bucket);
    }
    return [...groups.entries()]
      .filter(([, bucket]) => bucket.length > 1)
      .map(([key, bucket]) => ({ key, customers: bucket }));
  }

  /** CRM-06 — bulk import from parsed Excel/CSV rows. */
  async bulkImport(tenantId: string, dto: BulkImportDto) {
    const results = { created: 0, skipped: 0, duplicates: 0 };
    for (const row of dto.rows) {
      if (row.phone) {
        const existing = await this.prisma.client.customer.findUnique({
          where: { tenantId_phone: { tenantId, phone: row.phone } },
        });
        if (existing) {
          results.duplicates += 1;
          if (dto.skipDuplicates) {
            results.skipped += 1;
            continue;
          }
        }
      }
      await this.prisma.client.customer.create({
        data: {
          tenantId,
          fullName: row.fullName,
          phone: row.phone ?? null,
          email: row.email ?? null,
          city: row.city ?? null,
          tags: row.tags ?? [],
          notes: row.notes ?? null,
          source: 'import',
        },
      });
      results.created += 1;
    }
    this.logger.log(`Bulk import tenant=${tenantId} created=${results.created}`);
    return results;
  }

  /** CRM-08 — lead pipeline with filters. */
  async pipeline(tenantId: string, dto: PipelineQueryDto) {
    const customers = await this.prisma.client.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(dto.city ? { city: dto.city } : {}),
        ...(dto.tag ? { tags: { has: dto.tag } } : {}),
      },
      include: {
        invoices: { select: { total: true, paidTotal: true } },
        appointments: { orderBy: { startsAt: 'desc' }, take: 1, select: { startsAt: true } },
      },
    });

    const stages: Record<string, unknown[]> = { LEAD: [], NEGOTIATION: [], WON: [], LOST: [] };
    for (const c of customers) {
      const spend = c.invoices.reduce((s, i) => s + Number(i.paidTotal), 0);
      if (dto.minSpend && spend < dto.minSpend) continue;
      const lastVisit = c.appointments[0]?.startsAt ?? null;
      if (dto.lastVisitBefore && lastVisit && lastVisit >= dto.lastVisitBefore) continue;
      stages[c.leadStage].push({
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        spend,
        lastVisit,
      });
    }
    return {
      pipeline: Object.entries(stages).map(([stage, items]) => ({ stage, count: items.length, items })),
    };
  }

  async moveLead(tenantId: string, customerId: string, dto: MoveLeadDto) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, tenantId, deletedAt: null },
    });
    if (!customer) throw DomainException.notFound('مشتری');
    return this.prisma.client.customer.update({
      where: { id: customerId },
      data: { leadStage: dto.leadStage },
    });
  }

  /** CRM-07 — public online form that registers directly into the CRM. */
  async submitOnlineForm(tenantId: string, dto: OnlineFormDto) {
    const existing = await this.prisma.client.customer.findUnique({
      where: { tenantId_phone: { tenantId, phone: dto.phone } },
    });
    if (existing) {
      return this.prisma.client.customer.update({
        where: { id: existing.id },
        data: {
          notes: [existing.notes, dto.message].filter(Boolean).join('\n'),
          source: existing.source ?? dto.source,
        },
      });
    }
    return this.prisma.client.customer.create({
      data: {
        tenantId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email ?? null,
        source: dto.source,
        notes: dto.message ?? null,
        leadStage: 'LEAD',
      },
    });
  }
}
