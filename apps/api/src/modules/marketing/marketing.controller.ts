import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MarketingService } from './marketing.service.js';
import {
  convertReferralSchema,
  createGiftCardSchema,
  createReferralSchema,
  createReviewSchema,
  createSurveySchema,
  earnPointsSchema,
  listReviewsSchema,
  moderateReviewSchema,
  redeemGiftCardSchema,
  redeemPointsSchema,
  respondSurveySchema,
  type ConvertReferralDto,
  type CreateGiftCardDto,
  type CreateReferralDto,
  type CreateReviewDto,
  type CreateSurveyDto,
  type EarnPointsDto,
  type ListReviewsDto,
  type ModerateReviewDto,
  type RedeemGiftCardDto,
  type RedeemPointsDto,
  type RespondSurveyDto,
} from './dto/marketing.schemas.js';

@ApiTags('marketing')
@Controller('marketing')
@RequireModule('MKT')
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('loyalty/:customerId')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'باشگاه مشتری — موجودی امتیاز (MKT-01)' })
  loyalty(@CurrentUser('tenantId') tenantId: string, @Param('customerId') customerId: string) {
    return this.marketing.getLoyalty(tenantId, customerId);
  }

  @Post('loyalty/earn')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'افزودن امتیاز' })
  earn(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(earnPointsSchema)) dto: EarnPointsDto,
  ) {
    return this.marketing.earnPoints(tenantId, dto);
  }

  @Post('loyalty/redeem')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'مصرف امتیاز' })
  redeem(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(redeemPointsSchema)) dto: RedeemPointsDto,
  ) {
    return this.marketing.redeemPoints(tenantId, dto);
  }

  @Post('referrals')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'ثبت معرفی دوست (MKT-02)' })
  createReferral(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createReferralSchema)) dto: CreateReferralDto,
  ) {
    return this.marketing.createReferral(tenantId, dto);
  }

  @Get('referrals')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'فهرست معرفی‌ها' })
  listReferrals(@CurrentUser('tenantId') tenantId: string, @Query('referrerId') referrerId?: string) {
    return this.marketing.listReferrals(tenantId, referrerId);
  }

  @Patch('referrals/:id')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'تبدیل معرفی به مشتری' })
  convertReferral(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(convertReferralSchema)) dto: ConvertReferralDto,
  ) {
    return this.marketing.convertReferral(tenantId, id, dto);
  }

  @Post('gift-cards')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'صدور کارت هدیه (MKT-03)' })
  createGiftCard(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createGiftCardSchema)) dto: CreateGiftCardDto,
  ) {
    return this.marketing.createGiftCard(tenantId, dto);
  }

  @Get('gift-cards')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'فهرست کارت‌های هدیه' })
  listGiftCards(@CurrentUser('tenantId') tenantId: string) {
    return this.marketing.listGiftCards(tenantId);
  }

  @Post('gift-cards/redeem')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'مصرف کارت هدیه' })
  redeemGiftCard(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(redeemGiftCardSchema)) dto: RedeemGiftCardDto,
  ) {
    return this.marketing.redeemGiftCard(tenantId, dto);
  }

  @Post('surveys')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'ساخت نظرسنجی (MKT-05)' })
  createSurvey(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createSurveySchema)) dto: CreateSurveyDto,
  ) {
    return this.marketing.createSurvey(tenantId, dto);
  }

  @Get('surveys')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'فهرست نظرسنجی‌ها' })
  listSurveys(@CurrentUser('tenantId') tenantId: string) {
    return this.marketing.listSurveys(tenantId);
  }

  @Post('surveys/:id/responses')
  @Public()
  @ApiOperation({ summary: 'ثبت پاسخ نظرسنجی' })
  respond(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(respondSurveySchema)) dto: RespondSurveyDto,
  ) {
    return this.marketing.respondSurvey(id, dto);
  }

  @Get('surveys/:id/results')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'نتایج نظرسنجی' })
  results(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.marketing.surveyResults(tenantId, id);
  }

  @Post('reviews')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'ثبت نظر (MKT-06)' })
  createReview(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createReviewSchema)) dto: CreateReviewDto,
  ) {
    return this.marketing.createReview(tenantId, dto);
  }

  @Get('reviews')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'فهرست نظرات' })
  listReviews(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listReviewsSchema)) dto: ListReviewsDto,
  ) {
    return this.marketing.listReviews(tenantId, dto);
  }

  @Patch('reviews/:id')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'تأیید/رد نمایش عمومی نظر' })
  moderate(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moderateReviewSchema)) dto: ModerateReviewDto,
  ) {
    return this.marketing.moderateReview(tenantId, id, dto);
  }

  @Get('public-profile/:tenantId')
  @Public()
  @ApiOperation({ summary: 'صفحه معرفی آنلاین (MKT-07)' })
  publicProfile(@Param('tenantId') tenantId: string) {
    return this.marketing.publicProfile(tenantId);
  }
}
