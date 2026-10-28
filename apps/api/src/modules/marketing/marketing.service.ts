import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { buildMeta, toSkipTake } from '../../common/dto/pagination.dto.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import type {
  ConvertReferralDto,
  CreateGiftCardDto,
  CreateReferralDto,
  CreateReviewDto,
  CreateSurveyDto,
  EarnPointsDto,
  ListReviewsDto,
  ModerateReviewDto,
  RedeemGiftCardDto,
  RedeemPointsDto,
  RespondSurveyDto,
} from './dto/marketing.schemas.js';

/** Tier thresholds (points) — PRD MKT-01 bronze/silver/gold. */
const TIERS: Array<{ name: string; min: number }> = [
  { name: 'gold', min: 5000 },
  { name: 'silver', min: 2000 },
  { name: 'bronze', min: 0 },
];

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----- MKT-01 loyalty -----

  private async accountFor(tenantId: string, customerId: string) {
    return this.prisma.client.loyaltyAccount.upsert({
      where: { customerId },
      update: {},
      create: { tenantId, customerId, points: 0, tier: 'bronze' },
    });
  }

  private tierFor(points: number): string {
    return TIERS.find((t) => points >= t.min)?.name ?? 'bronze';
  }

  async getLoyalty(tenantId: string, customerId: string) {
    const account = await this.accountFor(tenantId, customerId);
    return { ...account, nextTier: TIERS.find((t) => t.min > account.points) ?? null };
  }

  async earnPoints(tenantId: string, dto: EarnPointsDto) {
    const account = await this.accountFor(tenantId, dto.customerId);
    const points = Math.max(0, account.points + dto.points);
    return this.prisma.client.loyaltyAccount.update({
      where: { customerId: dto.customerId },
      data: { points, tier: this.tierFor(points) },
    });
  }

  async redeemPoints(tenantId: string, dto: RedeemPointsDto) {
    const account = await this.accountFor(tenantId, dto.customerId);
    if (account.points < dto.points) throw DomainException.badRequest('امتیاز کافی نیست');
    const points = account.points - dto.points;
    return this.prisma.client.loyaltyAccount.update({
      where: { customerId: dto.customerId },
      data: { points, tier: this.tierFor(points) },
    });
  }

  // ----- MKT-02 referrals -----

  async createReferral(tenantId: string, dto: CreateReferralDto) {
    const referrer = await this.prisma.client.customer.findFirst({
      where: { id: dto.referrerId, tenantId },
    });
    if (!referrer) throw DomainException.notFound('مشتری معرف');
    const link = `https://app.local/r/${randomBytes(4).toString('hex')}`;
    const referral = await this.prisma.client.referral.create({
      data: {
        tenantId,
        referrerId: dto.referrerId,
        refereePhone: dto.refereePhone,
        rewardAmount: dto.rewardAmount,
      },
    });
    return { ...referral, link };
  }

  listReferrals(tenantId: string, referrerId?: string) {
    return this.prisma.client.referral.findMany({
      where: { tenantId, ...(referrerId ? { referrerId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** MKT-02 — mark referral converted and credit both sides. */
  async convertReferral(tenantId: string, id: string, dto: ConvertReferralDto) {
    const referral = await this.prisma.client.referral.findFirst({ where: { id, tenantId } });
    if (!referral) throw DomainException.notFound('معرفی');
    const updated = await this.prisma.client.referral.update({
      where: { id },
      data: { converted: dto.converted },
    });
    if (dto.converted && !referral.converted) {
      await this.earnPoints(tenantId, {
        customerId: referral.referrerId,
        points: Math.max(1, Math.round(Number(referral.rewardAmount) / 1000)),
      });
    }
    return updated;
  }

  // ----- MKT-03 gift cards -----

  async createGiftCard(tenantId: string, dto: CreateGiftCardDto) {
    const code = dto.code ?? `GC-${randomBytes(4).toString('hex').toUpperCase()}`;
    return this.prisma.client.giftCard.create({
      data: {
        tenantId,
        code,
        balance: dto.balance,
        expiresAt: dto.expiresAt ?? null,
      },
    });
  }

  listGiftCards(tenantId: string) {
    return this.prisma.client.giftCard.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } });
  }

  async redeemGiftCard(tenantId: string, dto: RedeemGiftCardDto) {
    const card = await this.prisma.client.giftCard.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (!card) throw DomainException.notFound('کارت هدیه');
    if (card.status !== 'ACTIVE') throw DomainException.badRequest('کارت هدیه فعال نیست');
    if (card.expiresAt && card.expiresAt.getTime() < Date.now()) {
      await this.prisma.client.giftCard.update({ where: { id: card.id }, data: { status: 'EXPIRED' } });
      throw DomainException.badRequest('کارت هدیه منقضی شده است');
    }
    const remaining = Number(card.balance) - dto.amount;
    if (remaining < 0) throw DomainException.badRequest('موجودی کارت کافی نیست');
    return this.prisma.client.giftCard.update({
      where: { id: card.id },
      data: { balance: remaining, status: remaining === 0 ? 'USED' : 'ACTIVE' },
    });
  }

  // ----- MKT-05 surveys -----

  createSurvey(tenantId: string, dto: CreateSurveyDto) {
    return this.prisma.client.survey.create({
      data: { tenantId, title: dto.title, questions: dto.questions as never, isActive: dto.isActive },
    });
  }

  listSurveys(tenantId: string) {
    return this.prisma.client.survey.findMany({
      where: { tenantId },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async respondSurvey(surveyId: string, dto: RespondSurveyDto) {
    const survey = await this.prisma.client.survey.findUnique({ where: { id: surveyId } });
    if (!survey) throw DomainException.notFound('نظرسنجی');
    if (!survey.isActive) throw DomainException.badRequest('نظرسنجی فعال نیست');
    return this.prisma.client.surveyResponse.create({
      data: {
        surveyId,
        customerId: dto.customerId ?? null,
        score: dto.score ?? null,
        answers: dto.answers as never,
      },
    });
  }

  async surveyResults(tenantId: string, surveyId: string) {
    const survey = await this.prisma.client.survey.findFirst({
      where: { id: surveyId, tenantId },
      include: { responses: true },
    });
    if (!survey) throw DomainException.notFound('نظرسنجی');
    const scores = survey.responses.map((r) => r.score).filter((s): s is number => s != null);
    const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return { surveyId, responses: survey.responses.length, averageScore: average };
  }

  // ----- MKT-06 reviews -----

  createReview(tenantId: string, dto: CreateReviewDto) {
    return this.prisma.client.review.create({
      data: {
        tenantId,
        customerId: dto.customerId ?? null,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });
  }

  async listReviews(tenantId: string, dto: ListReviewsDto) {
    const where = {
      tenantId,
      ...(dto.isPublic === undefined ? {} : { isPublic: dto.isPublic }),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.review.findMany({ where, ...toSkipTake(dto), orderBy: { createdAt: 'desc' } }),
      this.prisma.client.review.count({ where }),
    ]);
    return { data, meta: buildMeta(total, dto) };
  }

  async moderateReview(tenantId: string, id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.client.review.findFirst({ where: { id, tenantId } });
    if (!review) throw DomainException.notFound('نظر');
    return this.prisma.client.review.update({
      where: { id },
      data: { isPublic: dto.isPublic, approvedAt: dto.isPublic ? new Date() : null },
    });
  }

  /** MKT-07 — public business landing page payload. */
  async publicProfile(tenantId: string) {
    const [tenant, services, reviews] = await this.prisma.client.$transaction([
      this.prisma.client.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, logoUrl: true, address: true, phone: true, industry: true },
      }),
      this.prisma.client.service.findMany({
        where: { tenantId, isActive: true, deletedAt: null },
        select: { id: true, name: true, description: true, durationMinutes: true, price: true },
      }),
      this.prisma.client.review.findMany({
        where: { tenantId, isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, rating: true, comment: true, createdAt: true },
      }),
    ]);
    return { tenant, services, reviews };
  }
}
