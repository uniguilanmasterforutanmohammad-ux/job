import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MarketingExtraService } from './marketing-extra.service.js';
import {
  createSmsCampaignSchema,
  previewSegmentSchema,
  shareCardSchema,
  type CreateSmsCampaignDto,
  type PreviewSegmentDto,
  type ShareCardDto,
} from './dto/marketing-extra.schemas.js';

@ApiTags('marketing-extra')
@Controller('marketing')
@RequireModule('MKT')
export class MarketingExtraController {
  constructor(private readonly marketing: MarketingExtraService) {}

  @Post('sms-campaigns/preview')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'پیش‌نمایش مشتریان هدف کمپین پیامکی (MKT-04)' })
  preview(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(previewSegmentSchema)) dto: PreviewSegmentDto,
  ) {
    return this.marketing.previewSegment(tenantId, dto.segment);
  }

  @Post('sms-campaigns')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'ساخت کمپین پیامکی هدفمند (MKT-04)' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createSmsCampaignSchema)) dto: CreateSmsCampaignDto,
  ) {
    return this.marketing.createCampaign(tenantId, dto);
  }

  @Get('sms-campaigns')
  @RequirePermissions(PERMISSIONS.MKT_READ)
  @ApiOperation({ summary: 'فهرست کمپین‌های پیامکی' })
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.marketing.listCampaigns(tenantId);
  }

  @Post('sms-campaigns/:id/send')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'ارسال کمپین پیامکی' })
  send(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.marketing.sendCampaign(tenantId, id);
  }

  @Post('share-card')
  @RequirePermissions(PERMISSIONS.MKT_WRITE)
  @ApiOperation({ summary: 'ساخت کارت اشتراک شبکه‌های اجتماعی (MKT-08)' })
  shareCard(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(shareCardSchema)) dto: ShareCardDto,
  ) {
    return this.marketing.shareCard(tenantId, dto);
  }
}
