import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CampaignsExtraService } from './campaigns-extra.service.js';
import {
  contributeOnlineSchema,
  setSplitsSchema,
  thankYouSchema,
  type ContributeOnlineDto,
  type SetSplitsDto,
  type ThankYouDto,
} from './dto/campaign-extra.schemas.js';

@ApiTags('campaigns-extra')
@Controller('campaigns')
@RequireModule('CAMP')
export class CampaignsExtraController {
  constructor(private readonly campaigns: CampaignsExtraService) {}

  @Post(':id/splits')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'سهم‌بندی کمپین (CAMP-03)' })
  setSplits(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setSplitsSchema)) dto: SetSplitsDto,
  ) {
    return this.campaigns.setSplits(tenantId, id, dto);
  }

  @Post(':id/contributions/online')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'کمک آنلاین به کمپین (CAMP-04)' })
  contributeOnline(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(contributeOnlineSchema)) dto: ContributeOnlineDto,
  ) {
    return this.campaigns.contributeOnline(tenantId, id, dto);
  }

  @Post(':id/thank-you')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'ارسال پیام تشکر (CAMP-09)' })
  thankYou(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(thankYouSchema)) dto: ThankYouDto,
  ) {
    return this.campaigns.sendThankYou(tenantId, id, dto);
  }
}
