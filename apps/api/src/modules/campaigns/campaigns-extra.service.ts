import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { CampaignsService } from './campaigns.service.js';
import type {
  ContributeOnlineDto,
  SetSplitsDto,
  ThankYouDto,
} from './dto/campaign-extra.schemas.js';

/** CAMP-03/04/09 — share splits, online contributions and thank-you messages. */
@Injectable()
export class CampaignsExtraService {
  private readonly logger = new Logger(CampaignsExtraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly payments: PaymentsService,
    private readonly messaging: MessagingService,
  ) {}

  private async findCampaign(tenantId: string, id: string) {
    const campaign = await this.prisma.client.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw DomainException.notFound('کمپین');
    return campaign;
  }

  /**
   * CAMP-03 — stores the split plan in campaign.meta and returns each
   * participant's computed share. EQUAL splits the target evenly; PERCENT uses
   * the provided weights; FREE uses the raw amounts.
   */
  async setSplits(tenantId: string, id: string, dto: SetSplitsDto) {
    const campaign = await this.findCampaign(tenantId, id);
    const target = Number(campaign.targetAmount);

    let shares: Array<{ name: string | null; customerId: string | null; share: number; amount: number }>;
    if (dto.mode === 'EQUAL') {
      const per = Math.round(target / dto.participants.length);
      shares = dto.participants.map((p) => ({
        name: p.name ?? null,
        customerId: p.customerId ?? null,
        share: p.share,
        amount: per,
      }));
    } else if (dto.mode === 'PERCENT') {
      const totalPercent = dto.participants.reduce((s, p) => s + p.share, 0);
      if (Math.round(totalPercent) !== 100) throw DomainException.badRequest('مجموع درصدها باید ۱۰۰ باشد');
      shares = dto.participants.map((p) => ({
        name: p.name ?? null,
        customerId: p.customerId ?? null,
        share: p.share,
        amount: Math.round((target * p.share) / 100),
      }));
    } else {
      shares = dto.participants.map((p) => ({
        name: p.name ?? null,
        customerId: p.customerId ?? null,
        share: p.share,
        amount: p.share,
      }));
    }

    const meta = {
      ...((campaign.meta as Record<string, unknown>) ?? {}),
      splits: { mode: dto.mode, shares },
    };
    await this.prisma.client.campaign.update({ where: { id }, data: { meta: meta as never } });

    return { campaignId: id, mode: dto.mode, shares, total: shares.reduce((s, x) => s + x.amount, 0) };
  }

  /** CAMP-04 — records a contribution that is paid through the gateway. */
  async contributeOnline(tenantId: string, id: string, dto: ContributeOnlineDto) {
    const campaign = await this.findCampaign(tenantId, id);
    if (campaign.status !== 'ACTIVE') throw DomainException.badRequest('کمپین فعال نیست');

    const payment = await this.payments.createOnlinePayment(tenantId, {
      customerId: dto.customerId,
      amount: dto.amount,
      description: `کمک به کمپین ${campaign.title}`,
      provider: dto.provider,
    });

    // Pending contribution, settled on gateway callback (see settleContribution).
    const contribution = await this.prisma.client.campaignContribution.create({
      data: {
        campaignId: id,
        customerId: dto.customerId ?? null,
        amount: dto.amount,
        isAnonymous: dto.isAnonymous,
        note: dto.note ?? null,
        paymentId: null,
      },
    });
    this.logger.log(`Campaign online contribution=${contribution.id} payment=${payment.paymentId}`);
    return { contribution, payment };
  }

  /** Settles a gateway-paid contribution into the campaign total. */
  async settleContribution(tenantId: string, contributionId: string, paymentId: string) {
    const contribution = await this.prisma.client.campaignContribution.findFirst({
      where: { id: contributionId, campaign: { tenantId } },
    });
    if (!contribution) throw DomainException.notFound('کمک');
    const campaign = await this.findCampaign(tenantId, contribution.campaignId);
    const collected = Number(campaign.collected) + Number(contribution.amount);

    await this.prisma.client.$transaction([
      this.prisma.client.campaignContribution.update({
        where: { id: contributionId },
        data: { paymentId },
      }),
      this.prisma.client.campaign.update({ where: { id: campaign.id }, data: { collected } }),
    ]);

    if (Number(campaign.targetAmount) > 0 && collected >= Number(campaign.targetAmount)) {
      await this.prisma.client.campaign.update({
        where: { id: campaign.id },
        data: { status: 'COMPLETED', closedAt: new Date() },
      });
    }
    return { contributionId, collected };
  }

  /** CAMP-09 — sends a thank-you message to all contributors with consent. */
  async sendThankYou(tenantId: string, id: string, dto: ThankYouDto) {
    const campaign = await this.findCampaign(tenantId, id);
    const contributions = await this.prisma.client.campaignContribution.findMany({
      where: { campaignId: id, customerId: { not: null } },
      select: { customerId: true, amount: true },
    });
    const customerIds = [...new Set(contributions.map((c) => c.customerId).filter((x): x is string => !!x))];
    if (!customerIds.length) return { sent: 0, skipped: 0 };

    const body =
      dto.message ??
      `از کمک شما به کمپین «${campaign.title}» صمیمانه سپاسگزاریم. مجموع کمک‌های جمع‌آوری‌شده: ${Number(campaign.collected).toLocaleString('fa-IR')} ریال`;

    if (dto.channel === 'IN_APP' || dto.channel === 'EMAIL') {
      // Non-SMS channels reuse the messaging service (consent-gated).
      const result = await this.messaging.bulkSend(tenantId, {
        customerIds,
        channel: dto.channel,
        body,
      });
      return result;
    }
    const result = await this.messaging.bulkSend(tenantId, { customerIds, channel: 'SMS', body });
    this.logger.log(`Thank-you campaign=${id} queued=${result.queued}`);
    return result;
  }
}
