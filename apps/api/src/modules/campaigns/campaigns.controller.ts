import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CampaignsService } from './campaigns.service.js';
import {
  closeCampaignSchema,
  contributeSchema,
  createCampaignSchema,
  issueReceiptSchema,
  listCampaignsSchema,
  recordExpenseSchema,
  updateCampaignSchema,
  type CloseCampaignDto,
  type ContributeDto,
  type CreateCampaignDto,
  type IssueReceiptDto,
  type ListCampaignsDto,
  type RecordCampaignExpenseDto,
  type UpdateCampaignDto,
} from './dto/campaign.schemas.js';

@ApiTags('campaigns')
@Controller('campaigns')
@RequireModule('CAMP')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'ایجاد کمپین (CAMP-01/02/03)' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createCampaignSchema)) dto: CreateCampaignDto,
  ) {
    return this.campaigns.create(tenantId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CAMP_READ)
  @ApiOperation({ summary: 'فهرست کمپین‌ها' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @Query(new ZodValidationPipe(listCampaignsSchema)) dto: ListCampaignsDto,
  ) {
    return this.campaigns.list(tenantId, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CAMP_READ)
  @ApiOperation({ summary: 'جزئیات کمپین با پیشرفت (CAMP-06)' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.campaigns.findOnePublic(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'ویرایش کمپین' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCampaignSchema)) dto: UpdateCampaignDto,
  ) {
    return this.campaigns.update(tenantId, id, dto);
  }

  @Post(':id/activate')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'فعال‌سازی کمپین' })
  activate(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.campaigns.activate(tenantId, id);
  }

  @Post(':id/contributions')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'ثبت کمک (CAMP-04/05)' })
  contribute(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(contributeSchema)) dto: ContributeDto,
  ) {
    return this.campaigns.contribute(tenantId, id, dto);
  }

  @Post(':id/expenses')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'ثبت هزینه کمپین (CAMP-07)' })
  recordExpense(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(recordExpenseSchema)) dto: RecordCampaignExpenseDto,
  ) {
    return this.campaigns.recordExpense(tenantId, id, dto);
  }

  @Post(':id/close')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'بستن کمپین و تصمیم وجه اضافه (CAMP-08)' })
  close(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(closeCampaignSchema)) dto: CloseCampaignDto,
  ) {
    return this.campaigns.close(tenantId, id, dto);
  }

  @Post(':id/receipts')
  @RequirePermissions(PERMISSIONS.CAMP_WRITE)
  @ApiOperation({ summary: 'صدور رسید رسمی (CAMP-10)' })
  issueReceipt(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(issueReceiptSchema)) dto: IssueReceiptDto,
  ) {
    return this.campaigns.issueReceipt(tenantId, id, dto);
  }

  @Get(':id/report')
  @RequirePermissions(PERMISSIONS.CAMP_READ)
  @ApiOperation({ summary: 'گزارش نهایی کمپین (CAMP-09)' })
  report(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.campaigns.report(tenantId, id);
  }
}
