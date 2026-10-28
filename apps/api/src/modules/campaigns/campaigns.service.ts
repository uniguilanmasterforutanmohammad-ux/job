import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  CloseCampaignDto,
  ContributeDto,
  CreateCampaignDto,
  IssueReceiptDto,
  ListCampaignsDto,
  RecordCampaignExpenseDto,
  UpdateCampaignDto,
} from './dto/campaign.schemas.js';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateCampaignDto) {
    return this.prisma.client.campaign.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        targetAmount: dto.targetAmount,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount ?? null,
        deadline: dto.deadline ?? null,
        status: 'DRAFT',
      },
    });
  }

  list(tenantId: string, dto: ListCampaignsDto) {
    return this.prisma.client.campaign.findMany({
      where: { tenantId, ...(dto.status ? { status: dto.status } : {}) },
      include: { _count: { select: { contributions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async findOne(tenantId: string, id: string) {
    const campaign = await this.prisma.client.campaign.findFirst({ where: { id, tenantId } });
    if (!campaign) throw DomainException.notFound('کمپین');
    return campaign;
  }

  async findOnePublic(tenantId: string, id: string) {
    const campaign = await this.prisma.client.campaign.findFirst({
      where: { id, tenantId },
      include: {
        contributions: {
          where: { isAnonymous: false },
          select: { id: true, amount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        campaignExpenses: true,
      },
    });
    if (!campaign) throw DomainException.notFound('کمپین');
    return this.withProgress(campaign);
  }

  private withProgress(campaign: {
    targetAmount: unknown;
    collected: unknown;
    contributions: unknown[];
    campaignExpenses?: Array<{ amount: unknown }>;
    [key: string]: unknown;
  }) {
    const target = Number(campaign.targetAmount);
    const collected = Number(campaign.collected);
    const spent = (campaign.campaignExpenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      ...campaign,
      progress: {
        percent: target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0,
        contributors: campaign.contributions.length,
        spent,
        remaining: collected - spent,
      },
    };
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto) {
    await this.findOne(tenantId, id);
    return this.prisma.client.campaign.update({ where: { id }, data: dto });
  }

  async activate(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.client.campaign.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  /** CAMP-04/05/06 — record a contribution and update collected total. */
  async contribute(tenantId: string, id: string, dto: ContributeDto) {
    const campaign = await this.findOne(tenantId, id);
    if (campaign.status !== 'ACTIVE') throw DomainException.badRequest('کمپین فعال نیست');
    if (Number(campaign.minAmount) > 0 && dto.amount < Number(campaign.minAmount)) {
      throw DomainException.badRequest('مبلغ کمک کمتر از حداقل مجاز است');
    }
    if (campaign.maxAmount && dto.amount > Number(campaign.maxAmount)) {
      throw DomainException.badRequest('مبلغ کمک بیشتر از حداکثر مجاز است');
    }

    const contribution = await this.prisma.client.campaignContribution.create({
      data: {
        campaignId: id,
        customerId: dto.customerId ?? null,
        amount: dto.amount,
        isAnonymous: dto.isAnonymous,
        note: dto.note ?? null,
        paymentId: dto.paymentId ?? null,
      },
    });
    const collected = Number(campaign.collected) + dto.amount;
    await this.prisma.client.campaign.update({ where: { id }, data: { collected } });

    // CAMP-08 — auto close when the target is reached.
    if (Number(campaign.targetAmount) > 0 && collected >= Number(campaign.targetAmount)) {
      await this.prisma.client.campaign.update({
        where: { id },
        data: { status: 'COMPLETED', closedAt: new Date() },
      });
    }
    return contribution;
  }

  /** CAMP-07 — record actual campaign spending. */
  recordExpense(tenantId: string, id: string, dto: RecordCampaignExpenseDto) {
    return this.prisma.client.campaignExpense.create({
      data: {
        campaignId: id,
        title: dto.title,
        amount: dto.amount,
        receiptKey: dto.receiptKey ?? null,
        note: dto.note ?? null,
      },
    });
  }

  /** CAMP-08/09 — close campaign and decide on surplus. */
  async close(tenantId: string, id: string, dto: CloseCampaignDto) {
    const campaign = await this.findOne(tenantId, id);
    if (dto.surplusAction === 'TRANSFER' && dto.transferToCampaignId) {
      const target = await this.findOne(tenantId, dto.transferToCampaignId);
      const surplus = Number(campaign.collected) - Number(campaign.targetAmount);
      if (surplus > 0) {
        await this.prisma.client.campaign.update({
          where: { id: target.id },
          data: { collected: Number(target.collected) + surplus },
        });
      }
    }
    return this.prisma.client.campaign.update({
      where: { id },
      data: { status: 'COMPLETED', closedAt: new Date(), surplusAction: dto.surplusAction },
    });
  }

  /** CAMP-10 — attach an official receipt number to a contribution. */
  async issueReceipt(tenantId: string, id: string, dto: IssueReceiptDto) {
    const campaign = await this.findOne(tenantId, id);
    const contribution = await this.prisma.client.campaignContribution.findFirst({
      where: { id: dto.contributionId, campaignId: campaign.id },
    });
    if (!contribution) throw DomainException.notFound('کمک');
    return this.prisma.client.campaignContribution.update({
      where: { id: contribution.id },
      data: { receiptNumber: dto.receiptNumber },
    });
  }

  /** CAMP-09 — final report. */
  async report(tenantId: string, id: string) {
    const campaign = await this.prisma.client.campaign.findFirst({
      where: { id, tenantId },
      include: { contributions: true, campaignExpenses: true },
    });
    if (!campaign) throw DomainException.notFound('کمپین');
    const collected = campaign.contributions.reduce((s, c) => s + Number(c.amount), 0);
    const spent = campaign.campaignExpenses.reduce((s, e) => s + Number(e.amount), 0);
    return {
      campaign: { id: campaign.id, title: campaign.title, status: campaign.status },
      collected,
      spent,
      remaining: collected - spent,
      contributors: campaign.contributions.length,
      anonymous: campaign.contributions.filter((c) => c.isAnonymous).length,
    };
  }
}
