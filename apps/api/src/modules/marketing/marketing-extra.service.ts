import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import type {
  CreateSmsCampaignDto,
  ShareCardDto,
  SmsCampaignSegmentDto,
} from './dto/marketing-extra.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** MKT-04 (targeted SMS campaigns) and MKT-08 (social share card). */
@Injectable()
export class MarketingExtraService {
  private readonly logger = new Logger(MarketingExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /** Resolves the customer ids that match a campaign segment. */
  async resolveSegment(tenantId: string, segment: SmsCampaignSegmentDto) {
    const customers = await this.prisma.client.customer.findMany({
      where: {
        tenantId,
        deletedAt: null,
        isActive: true,
        ...(segment.tags?.length ? { tags: { hasSome: segment.tags } } : {}),
        ...(segment.city ? { city: segment.city } : {}),
        ...(segment.leadStage ? { leadStage: segment.leadStage } : {}),
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        invoices: { select: { paidTotal: true } },
        appointments: { orderBy: { startsAt: 'desc' }, take: 1, select: { startsAt: true } },
      },
    });

    return customers
      .filter((c) => {
        if (segment.minSpend) {
          const spend = c.invoices.reduce((s, i) => s + Number(i.paidTotal), 0);
          if (spend < segment.minSpend) return false;
        }
        if (segment.lastVisitBefore) {
          const last = c.appointments[0]?.startsAt ?? null;
          if (last && last >= segment.lastVisitBefore) return false;
        }
        return true;
      })
      .filter((c) => Boolean(c.phone));
  }

  async previewSegment(tenantId: string, segment: SmsCampaignSegmentDto) {
    const matched = await this.resolveSegment(tenantId, segment);
    return { count: matched.length, sample: matched.slice(0, 10).map((c) => ({ fullName: c.fullName, phone: c.phone })) };
  }

  createCampaign(tenantId: string, dto: CreateSmsCampaignDto) {
    return this.prisma.client.smsCampaign.create({
      data: {
        tenantId,
        title: dto.title,
        body: dto.body,
        segment: dto.segment as never,
        status: 'DRAFT',
      },
    });
  }

  listCampaigns(tenantId: string) {
    return this.prisma.client.smsCampaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** MKT-04 — send the campaign (segmented bulk SMS). */
  async sendCampaign(tenantId: string, id: string) {
    const campaign = await this.prisma.client.smsCampaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw DomainException.notFound('کمپین پیامکی');
    if (campaign.status === 'SENT') throw DomainException.conflict('این کمپین قبلاً ارسال شده است');

    const matched = await this.resolveSegment(tenantId, campaign.segment as SmsCampaignSegmentDto);
    if (!matched.length) throw DomainException.badRequest('هیچ مشتری واجد شرایطی یافت نشد');

    await this.prisma.client.smsCampaign.update({
      where: { id },
      data: { status: 'SENDING', totalTargets: matched.length },
    });

    const result = await this.messaging.bulkSend(tenantId, {
      customerIds: matched.map((c) => c.id),
      channel: 'SMS',
      body: campaign.body,
    });

    await this.prisma.client.smsCampaign.update({
      where: { id },
      data: { status: 'SENT', sentCount: result.queued, skippedCount: result.skipped },
    });

    this.logger.log(`SMS campaign=${id} queued=${result.queued} skipped=${result.skipped}`);
    return result;
  }

  /**
   * MKT-08 — builds a shareable social card as SVG. Callers can render it to
   * PNG client-side or upload it via /files/upload; no external image service
   * is required.
   */
  async shareCard(tenantId: string, dto: ShareCardDto) {
    const tenant = await this.prisma.client.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, logoUrl: true },
    });

    const palette =
      dto.theme === 'dark'
        ? { bg: '#0f172a', fg: '#f8fafc', accent: '#38bdf8' }
        : dto.theme === 'light'
          ? { bg: '#f8fafc', fg: '#0f172a', accent: '#2563eb' }
          : { bg: '#1e3a8a', fg: '#ffffff', accent: '#facc15' };

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="Vazirmatn, Tahoma, sans-serif" direction="rtl">
  <rect width="1080" height="1080" fill="${palette.bg}"/>
  <circle cx="920" cy="160" r="180" fill="${palette.accent}" opacity="0.18"/>
  <circle cx="140" cy="920" r="220" fill="${palette.accent}" opacity="0.12"/>
  <text x="540" y="480" fill="${palette.fg}" font-size="86" font-weight="700" text-anchor="middle">${esc(dto.title)}</text>
  ${dto.subtitle ? `<text x="540" y="580" fill="${palette.accent}" font-size="46" text-anchor="middle">${esc(dto.subtitle)}</text>` : ''}
  <text x="540" y="1000" fill="${palette.fg}" font-size="38" opacity="0.75" text-anchor="middle">${esc(dto.footer ?? tenant.name)}</text>
</svg>`;

    return {
      format: 'svg',
      width: 1080,
      height: 1080,
      svg,
      dataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`,
    };
  }
}
